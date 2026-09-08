import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { google } from 'googleapis';
import { EncryptionConfig } from '../../config/encryption.config';
import { GoogleConfig } from '../../config/google.config';

// `googleapis` re-exports the auth-library classes as values but not as a
// standalone type export from its own package entry - deriving the type from
// the constructor avoids adding `google-auth-library` as a second, separately
// versioned direct dependency just for this annotation.
export type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export interface GoogleOAuthState {
  purpose: 'login' | 'connect';
  /** Only set for `purpose: 'connect'` - the already-authenticated user linking their account. */
  userId?: string;
  nonce: string;
  exp: number;
}

export interface GoogleTokenExchange {
  profile: { sub: string; email: string; name: string };
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number;
  scope: string;
}

const STATE_TTL_SECONDS = 300;

// Stateless OAuth2 mechanics: building the consent URL, exchanging an
// authorization code, refreshing an access token, and signing/verifying the
// `state` round-trip param. Persistence (GoogleAccount rows) lives in
// GoogleAccountService, which calls into this service rather than the
// reverse - keeps this service testable without a database.
@Injectable()
export class GoogleOAuthService {
  private readonly google: GoogleConfig;
  private readonly encryption: EncryptionConfig;

  constructor(configService: ConfigService) {
    this.google = configService.get<GoogleConfig>('google')!;
    this.encryption = configService.get<EncryptionConfig>('encryption')!;
  }

  private assertConfigured(): void {
    if (!this.google.clientId || !this.google.clientSecret || !this.google.redirectUri) {
      throw new InternalServerErrorException(
        'Google OAuth is not configured on this server (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI).',
      );
    }
  }

  private createClient(): OAuth2Client {
    this.assertConfigured();
    return new google.auth.OAuth2(this.google.clientId, this.google.clientSecret, this.google.redirectUri);
  }

  buildAuthUrl(state: Omit<GoogleOAuthState, 'exp' | 'nonce'>): string {
    const client = this.createClient();
    const signedState = this.signState(state);
    return client.generateAuthUrl({
      access_type: 'offline',
      // Forces Google to re-issue a refresh_token even on a repeat consent
      // (it's otherwise only sent on the very first grant) - needed since a
      // user might disconnect and reconnect, or the stored one was lost.
      prompt: 'consent',
      scope: this.google.scopes,
      state: signedState,
    });
  }

  async exchangeCode(code: string): Promise<GoogleTokenExchange> {
    const client = this.createClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token || !tokens.access_token) {
      throw new UnauthorizedException('Google did not return the expected tokens.');
    }

    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: this.google.clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Could not read the Google account profile.');
    }

    return {
      profile: { sub: payload.sub, email: payload.email, name: payload.name ?? payload.email },
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiryDate: tokens.expiry_date ?? Date.now() + 55 * 60 * 1000,
      scope: tokens.scope ?? this.google.scopes.join(' '),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiryDate: number }> {
    const client = this.createClient();
    client.setCredentials({ refresh_token: refreshToken });
    const { token, res } = await client.getAccessToken();
    if (!token) {
      throw new UnauthorizedException('Could not refresh the Google access token - please reconnect your account.');
    }
    const expiryDate = (res?.data?.expiry_date as number | undefined) ?? Date.now() + 55 * 60 * 1000;
    return { accessToken: token, expiryDate };
  }

  /** Builds a ready-to-use googleapis OAuth2Client carrying a live access token. */
  buildClientWithAccessToken(accessToken: string): OAuth2Client {
    const client = this.createClient();
    client.setCredentials({ access_token: accessToken });
    return client;
  }

  signState(state: Omit<GoogleOAuthState, 'exp' | 'nonce'>): string {
    const payload: GoogleOAuthState = {
      ...state,
      nonce: randomBytes(9).toString('hex'),
      exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    };
    const json = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.stateSigningKey()).update(json).digest('base64url');
    return `${json}.${signature}`;
  }

  verifyState(token: string): GoogleOAuthState {
    const [json, signature] = token.split('.');
    if (!json || !signature) {
      throw new UnauthorizedException('Malformed Google OAuth state.');
    }

    const expected = createHmac('sha256', this.stateSigningKey()).update(json).digest('base64url');
    const signatureBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) {
      throw new UnauthorizedException('Invalid Google OAuth state.');
    }

    const payload = JSON.parse(Buffer.from(json, 'base64url').toString('utf8')) as GoogleOAuthState;
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Google OAuth state has expired - please try again.');
    }
    return payload;
  }

  // Derived from the same token-encryption secret rather than a dedicated env
  // var - domain-separated by the ":oauth-state" suffix so this signing key
  // is never equal to the AES-256-GCM key TokenCipherService uses.
  private stateSigningKey(): Buffer {
    if (!this.encryption.tokenEncryptionKey) {
      throw new InternalServerErrorException('TOKEN_ENCRYPTION_KEY is not configured on this server.');
    }
    return createHash('sha256').update(`${this.encryption.tokenEncryptionKey}:oauth-state`).digest();
  }
}
