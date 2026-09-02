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
import { Public } from './decorators/public.decorator';
import { IssuedTokens, RequestMeta } from './interfaces/auth-tokens.interface';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';

const REFRESH_COOKIE_NAME = 'refresh_token';

interface AuthResponse {
  user: AuthenticatedUser;
  accessToken: string;
  accessTokenExpiresIn: number;
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
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const rawToken = this.readRefreshCookie(req);
    const issued = await this.authService.refresh(rawToken, this.requestMeta(req));
    return this.respond(issued, reply);
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    reply.clearCookie(REFRESH_COOKIE_NAME, { path: this.refreshCookiePath });
  }

  private readRefreshCookie(req: FastifyRequest): string {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME];
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
    };
  }
}
