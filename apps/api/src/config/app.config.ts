import { registerAs } from '@nestjs/config';

export interface AppConfig {
  port: number;
  environment: 'development' | 'production' | 'test';
  apiPrefix: string;
  corsOrigin: string;
  logLevel: string;
}

export const appConfig = registerAs(
  'app',
  (): AppConfig => ({
    port: parseInt(process.env.PORT ?? '3000', 10),
    environment: (process.env.NODE_ENV as AppConfig['environment']) ?? 'development',
    apiPrefix: process.env.API_PREFIX ?? 'api',
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    logLevel: process.env.LOG_LEVEL ?? 'info',
  }),
);
