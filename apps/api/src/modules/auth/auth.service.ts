import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { JwtConfig } from '../../config/jwt.config';
import { parseDurationToSeconds } from '../../common/utils/duration.util';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { IssuedTokens, RequestMeta } from './interfaces/auth-tokens.interface';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';

const SELECTOR_BYTES = 9;
const VALIDATOR_BYTES = 32;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtConfig: JwtConfig;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {
    this.jwtConfig = this.configService.get<JwtConfig>('jwt')!;
  }

  async register(dto: RegisterDto, meta: RequestMeta): Promise<IssuedTokens> {
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
    });
    return this.issueTokens(user, meta);
  }

  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    // Same generic error whether the email doesn't exist, the password is
    // wrong, or the account is Google-only (no password_hash) - distinguishing
    // any of these lets an attacker enumerate registered emails / linked accounts.
    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }

  async login(user: User, meta: RequestMeta): Promise<IssuedTokens> {
    return this.issueTokens(user, meta);
  }

  async refresh(rawToken: string, meta: RequestMeta): Promise<IssuedTokens> {
    const { selector, validator } = this.parseRawToken(rawToken);

    const existing = await this.refreshTokenRepository.findOne({ where: { selector } });
    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.revokedAt) {
      // A revoked (already-rotated) token being presented again means it was
      // either replayed by an attacker or leaked - treat as compromise and
      // kill every active session for this user rather than just this token.
      this.logger.warn(`Refresh token reuse detected for user ${existing.userId}`);
      await this.revokeAllForUser(existing.userId);
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const valid = await argon2.verify(existing.tokenHash, validator);
    if (!valid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(existing.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const issued = await this.issueTokens(user, meta);

    existing.revokedAt = new Date();
    existing.replacedByTokenId = issued.refreshTokenRecordId;
    await this.refreshTokenRepository.save(existing);

    return issued;
  }

  async logout(rawToken: string): Promise<void> {
    const { selector } = this.parseRawToken(rawToken);
    const existing = await this.refreshTokenRepository.findOne({ where: { selector } });
    if (existing && !existing.revokedAt) {
      existing.revokedAt = new Date();
      await this.refreshTokenRepository.save(existing);
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  // Best-effort cleanup for a background job/cron later (not scheduled yet in
  // Step 2) - expired rows are harmless but there's no reason to keep them.
  async deleteExpiredTokens(): Promise<number> {
    const result = await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected ?? 0;
  }

  private async issueTokens(user: User, meta: RequestMeta): Promise<IssuedTokens> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.jwtConfig.accessSecret,
      // See auth.module.ts for why this needs the cast: `expiresIn`'s type
      // is a fixed literal union from `ms`, our value is a validated string.
      expiresIn: this.jwtConfig.accessExpiresIn as never,
      issuer: this.jwtConfig.issuer,
      audience: this.jwtConfig.audience,
    });

    const selector = randomBytes(SELECTOR_BYTES).toString('hex');
    const validator = randomBytes(VALIDATOR_BYTES).toString('hex');
    const tokenHash = await argon2.hash(validator);
    const expiresAt = new Date(
      Date.now() + this.jwtConfig.refreshExpiresInDays * 24 * 60 * 60 * 1000,
    );

    const savedToken = await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        userId: user.id,
        selector,
        tokenHash,
        expiresAt,
        revokedAt: null,
        replacedByTokenId: null,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      }),
    );

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };

    return {
      user: authenticatedUser,
      accessToken,
      accessTokenExpiresIn: parseDurationToSeconds(this.jwtConfig.accessExpiresIn),
      refreshToken: `${selector}.${validator}`,
      refreshTokenExpiresAt: expiresAt,
      refreshTokenRecordId: savedToken.id,
    };
  }

  private parseRawToken(rawToken: string): { selector: string; validator: string } {
    const [selector, validator] = rawToken.split('.');
    if (!selector || !validator) {
      throw new UnauthorizedException('Malformed refresh token');
    }
    return { selector, validator };
  }
}
