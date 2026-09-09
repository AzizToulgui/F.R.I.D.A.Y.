import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppConfig } from '../../config/app.config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from './decorators/public.decorator';
import { IssuedTokens, RequestMeta } from './interfaces/auth-tokens.interface';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';

const REFRESH_COOKIE_NAME = 'refresh_token';

interface AuthResponse {
  user: AuthenticatedUser;
  accessToken: string;
  accessTokenExpiresIn: number;
  // Only meaningful to a client that can't rely on the httpOnly cookie (i.e.
  // mobile) - it must persist this itself (e.g. secure storage) and send it
  // back in the body on /auth/refresh and /auth/logout. Web already gets the
  // same token via Set-Cookie and can safely ignore these fields.
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

@Controller('auth')
export class AuthController {
  private readonly refreshCookiePath: string;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    const app = this.configService.get<AppConfig>('app')!;
    this.refreshCookiePath = `/${app.apiPrefix}/auth`;
  }

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const issued = await this.authService.register(dto, this.requestMeta(req));
    return this.respond(issued, reply);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const user = await this.authService.validateCredentials(dto.email, dto.password);
    const issued = await this.authService.login(user, this.requestMeta(req));
    return this.respond(issued, reply);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const rawToken = this.resolveRefreshToken(req, dto);
    const issued = await this.authService.refresh(rawToken, this.requestMeta(req));
    return this.respond(issued, reply);
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] ?? dto.refreshToken;
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    reply.clearCookie(REFRESH_COOKIE_NAME, { path: this.refreshCookiePath });
  }

  // Web relies entirely on the httpOnly cookie; mobile has no cookie jar and
  // sends the refresh token it persisted itself in the request body instead.
  // Cookie wins when both are somehow present - it's the trusted, browser
  // owned channel.
  private resolveRefreshToken(req: FastifyRequest, dto: RefreshDto): string {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME] ?? dto.refreshToken;
    if (!raw) {
      throw new UnauthorizedException('Missing refresh token');
    }
    return raw;
  }

  private requestMeta(req: FastifyRequest): RequestMeta {
    return {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
    };
  }

  private respond(issued: IssuedTokens, reply: FastifyReply): AuthResponse {
    const isProduction = this.configService.get<AppConfig>('app')!.environment === 'production';
    reply.setCookie(REFRESH_COOKIE_NAME, issued.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: this.refreshCookiePath,
      expires: issued.refreshTokenExpiresAt,
    });

    return {
      user: issued.user,
      accessToken: issued.accessToken,
      accessTokenExpiresIn: issued.accessTokenExpiresIn,
      refreshToken: issued.refreshToken,
      refreshTokenExpiresAt: issued.refreshTokenExpiresAt,
    };
  }
}
