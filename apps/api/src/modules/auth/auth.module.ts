import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtConfig } from '../../config/jwt.config';
import { UsersModule } from '../users/users.module';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([RefreshToken]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const jwt = config.get<JwtConfig>('jwt')!;
        return {
          secret: jwt.accessSecret,
          signOptions: {
            // @nestjs/jwt types `expiresIn` against a fixed string-literal
            // union (from `ms`) rather than `string`; our value is validated
            // by the Joi duration regex at startup (see validation.schema.ts).
            expiresIn: jwt.accessExpiresIn as never,
            issuer: jwt.issuer,
            audience: jwt.audience,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
