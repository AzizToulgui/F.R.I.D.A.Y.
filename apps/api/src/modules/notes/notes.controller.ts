import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { NotesService } from './notes.service';

// Read-only, same as RemindersController - notes are created/edited/deleted
// exclusively via the create_note/update_note/delete_note tools; this just
// makes them observable in the app.
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notesService.findAllForUser(user.id);
  }
}
