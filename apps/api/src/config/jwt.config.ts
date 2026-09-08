import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: string;
  refreshSecret: string;
  refreshExpiresInDays: number;
  issuer: string;
  audience: string;
}

export const jwtConfig = registerAs(
  'jwt',
  (): JwtConfig => ({
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    refreshExpiresInDays: parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? '7', 10),
    issuer: process.env.JWT_ISSUER ?? 'friday',
    audience: process.env.JWT_AUDIENCE ?? 'friday-clients',
  }),
);
