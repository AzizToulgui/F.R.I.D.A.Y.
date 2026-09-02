import { AuthenticatedUser } from './authenticated-user.interface';

export interface IssuedTokens {
  user: AuthenticatedUser;
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  /** Internal DB id of the refresh_tokens row - not returned to clients. */
  refreshTokenRecordId: string;
}

export interface RequestMeta {
  userAgent: string | null;
  ipAddress: string | null;
}
