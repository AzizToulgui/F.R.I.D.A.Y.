import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { TokenCipherService } from '../../common/crypto/token-cipher.service';
import { GoogleAccount } from './entities/google-account.entity';
import { GmailService } from './gmail.service';
import { GoogleAccountService } from './google-account.service';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleOAuthController } from './google-oauth.controller';
import { GoogleOAuthService } from './google-oauth.service';

@Module({
  imports: [TypeOrmModule.forFeature([GoogleAccount]), AuthModule, UsersModule],
  controllers: [GoogleOAuthController],
  providers: [TokenCipherService, GoogleOAuthService, GoogleAccountService, GmailService, GoogleCalendarService],
  exports: [GoogleOAuthService, GoogleAccountService, GmailService, GoogleCalendarService],
})
export class GoogleModule {}
