import { Controller, Delete, Get, HttpCode, HttpStatus, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppConfig } from '../../config/app.config';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UsersService } from '../users/users.service';
import { GoogleAccountService } from './google-account.service';
import { GoogleOAuthService } from './google-oauth.service';

const REFRESH_COOKIE_NAME = 'refresh_token';

// Two entry points share one callback (see `callback` below):
// - /authorize/login is public and hit by a plain top-level navigation from
//   the login page (no session exists yet to attach as a bearer token).
// - /authorize/connect is authenticated and hit via authFetch from Settings,
//   which then navigates the browser to the returned URL itself - a plain
//   <a href> can't carry the in-memory access token (see AuthProvider.tsx).
@Controller('google')
export class GoogleOAuthController {
  private readonly corsOrigin: string;
  private readonly refreshCookiePath: string;

  constructor(
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly googleAccountService: GoogleAccountService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    const app = this.configService.get<AppConfig>('app')!;
    this.corsOrigin = app.corsOrigin;
    this.refreshCookiePath = `/${app.apiPrefix}/auth`;
  }

  @Public()
  @Get('authorize/login')
  authorizeLogin(@Res() reply: FastifyReply): void {
    const url = this.googleOAuthService.buildAuthUrl({ purpose: 'login' });
    // Explicit 302: Fastify's redirect() only defaults to 302 when the reply
    // has no status code set yet - Nest's Fastify adapter pre-sets 200 on
    // every reply before the handler runs, so an implicit redirect() here
    // would silently stay a 200 with a Location header the browser ignores.
    reply.redirect(url, 302);
  }

  @Post('authorize/connect')
  authorizeConnect(@CurrentUser() user: AuthenticatedUser): { url: string } {
    const url = this.googleOAuthService.buildAuthUrl({ purpose: 'connect', userId: user.id });
    return { url };
  }

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') rawState: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (oauthError || !code || !rawState) {
      reply.redirect(`${this.corsOrigin}/login?google=error`, 302);
      return;
    }

    try {
      const state = this.googleOAuthService.verifyState(rawState);
      const exchange = await this.googleOAuthService.exchangeCode(code);

      if (state.purpose === 'connect') {
        if (!state.userId) throw new Error('Missing userId on a connect-flow state.');
        await this.googleAccountService.upsertFromTokens(state.userId, exchange);
        reply.redirect(`${this.corsOrigin}/?google=connected`, 302);
        return;
      }

      // purpose === 'login': find-or-create the user, then link the account
      // with the tokens we already have (they already carry the Gmail/
      // Calendar scopes, so tool access is ready immediately - no separate
      // "now connect Google" step for anyone who signs in this way).
      let user = await this.usersService.findByEmail(exchange.profile.email);
      if (!user) {
        user = await this.usersService.createFromGoogle({
          email: exchange.profile.email,
          displayName: exchange.profile.name,
        });
      }
      await this.googleAccountService.upsertFromTokens(user.id, exchange);

      const issued = await this.authService.login(user, {
        userAgent: req.headers['user-agent'] ?? null,
        ipAddress: req.ip ?? null,
      });
      const isProduction = this.configService.get<AppConfig>('app')!.environment === 'production';
      reply.setCookie(REFRESH_COOKIE_NAME, issued.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: this.refreshCookiePath,
        expires: issued.refreshTokenExpiresAt,
      });
      // No JSON response here - this request is a browser top-level
      // navigation from Google's redirect, not a fetch(). The frontend picks
      // up the session via AuthProvider's existing cookie-backed /auth/refresh
      // bootstrap call on load, same as reopening the app in a new tab.
      // Plain '/' with no query param (unlike the connect-flow redirect
      // above) - a sign-in/sign-up via Google should land on Home like any
      // other login, not pop open Settings; that's only for the Settings-
      // initiated "Connect Google Account" flow (see AppShell.tsx's
      // ?google=connected handling).
      reply.redirect(`${this.corsOrigin}/`, 302);
    } catch {
      reply.redirect(`${this.corsOrigin}/login?google=error`, 302);
    }
  }

  @Get('status')
  async status(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ connected: boolean; email?: string; scopes?: string[] }> {
    return this.googleAccountService.status(user.id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.googleAccountService.disconnect(user.id);
  }
}
