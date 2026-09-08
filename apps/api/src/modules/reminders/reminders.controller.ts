import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { RemindersService } from './reminders.service';

// Read-only - reminders are created/edited/deleted exclusively via the
// create_reminder/update_reminder/delete_reminder tools (Section 10); this
// just makes them observable.
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.remindersService.findAllForUser(user.id);
  }
}
