import { registerAs } from '@nestjs/config';

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  // Requested together at both sign-in and settings-linking time (see
  // ARCHITECTURE.md-style rationale in google-oauth.controller.ts): this app
  // is single-user-per-account scale, so incremental per-feature consent
  // isn't worth the extra round trips.
  scopes: string[];
}

export const googleConfig = registerAs(
  'google',
  (): GoogleConfig => ({
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? '',
    scopes: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar',
    ],
  }),
);
