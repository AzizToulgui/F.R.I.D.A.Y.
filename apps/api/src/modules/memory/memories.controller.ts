import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { MemoriesService } from './memories.service';

@Controller('memories')
export class MemoriesController {
  constructor(private readonly memoriesService: MemoriesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.memoriesService.findAllForUser(user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemoryDto,
  ) {
    return this.memoriesService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.memoriesService.remove(user.id, id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAll(@CurrentUser() user: AuthenticatedUser) {
    return this.memoriesService.removeAllForUser(user.id);
  }
}
