import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenCipherService } from '../../common/crypto/token-cipher.service';
import { GoogleAccount } from './entities/google-account.entity';
import { GoogleOAuthService, GoogleTokenExchange, OAuth2Client } from './google-oauth.service';

// Refresh proactively once within this many ms of expiry, rather than
// waiting for a live API call to fail with 401.
const REFRESH_SKEW_MS = 60_000;

@Injectable()
export class GoogleAccountService {
  constructor(
    @InjectRepository(GoogleAccount)
    private readonly repository: Repository<GoogleAccount>,
    private readonly tokenCipher: TokenCipherService,
    private readonly googleOAuthService: GoogleOAuthService,
  ) {}

  async findByUserId(userId: string): Promise<GoogleAccount | null> {
    return this.repository.findOne({ where: { userId } });
  }

  async isConnected(userId: string): Promise<boolean> {
    return (await this.findByUserId(userId)) !== null;
  }

  async status(userId: string): Promise<{ connected: boolean; email?: string; scopes?: string[] }> {
    const account = await this.findByUserId(userId);
    if (!account) return { connected: false };
    return { connected: true, email: account.googleEmail, scopes: account.scopes.split(' ') };
  }

  // Called from both the login and connect branches of the OAuth callback -
  // upserts by userId, and (per Google's own behavior) only overwrites the
  // stored refresh token when a new one was actually returned, so a repeat
  // consent that omits it doesn't strand the account without one.
  async upsertFromTokens(userId: string, exchange: GoogleTokenExchange): Promise<GoogleAccount> {
    const existing = await this.findByUserId(userId);
    const accessTokenEncrypted = this.tokenCipher.encrypt(exchange.accessToken);
    const refreshTokenEncrypted = exchange.refreshToken
      ? this.tokenCipher.encrypt(exchange.refreshToken)
      : (existing?.refreshTokenEncrypted ?? null);

    const account = this.repository.create({
      ...existing,
      userId,
      googleUserId: exchange.profile.sub,
      googleEmail: exchange.profile.email,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      accessTokenExpiresAt: new Date(exchange.expiryDate),
      scopes: exchange.scope,
    });
    return this.repository.save(account);
  }

  async disconnect(userId: string): Promise<void> {
    await this.repository.delete({ userId });
  }

  /** Ready-to-use googleapis client for `userId`, refreshing the access token first if it's near expiry. */
  async getAuthorizedClient(userId: string): Promise<OAuth2Client> {
    const account = await this.findByUserId(userId);
    if (!account) {
      throw new UnauthorizedException('Google account is not connected. Ask the user to connect it in Settings.');
    }

    const expiresInMs = account.accessTokenExpiresAt.getTime() - Date.now();
    if (expiresInMs > REFRESH_SKEW_MS) {
      const accessToken = this.tokenCipher.decrypt(account.accessTokenEncrypted);
      return this.googleOAuthService.buildClientWithAccessToken(accessToken);
    }

    if (!account.refreshTokenEncrypted) {
      throw new UnauthorizedException(
        'Google access has expired and no refresh token is on file - ask the user to reconnect their Google account in Settings.',
      );
    }

    const refreshToken = this.tokenCipher.decrypt(account.refreshTokenEncrypted);
    const refreshed = await this.googleOAuthService.refreshAccessToken(refreshToken);
    account.accessTokenEncrypted = this.tokenCipher.encrypt(refreshed.accessToken);
    account.accessTokenExpiresAt = new Date(refreshed.expiryDate);
    await this.repository.save(account);

    return this.googleOAuthService.buildClientWithAccessToken(refreshed.accessToken);
  }
}
