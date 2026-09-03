import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { RemindersService } from './reminders.service';

// Read-only for now - reminders are created exclusively via the
// create_reminder tool (Section 10); this just makes them observable.
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.remindersService.findAllForUser(user.id);
  }
}
