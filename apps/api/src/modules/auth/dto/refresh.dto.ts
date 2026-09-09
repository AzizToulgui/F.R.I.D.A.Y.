import { IsOptional, IsString } from 'class-validator';

// Web never sends a body here - it relies entirely on the httpOnly cookie.
// Mobile has no cookie jar, so it sends the refresh token it persisted
// itself (see AuthController.resolveRefreshToken).
export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
