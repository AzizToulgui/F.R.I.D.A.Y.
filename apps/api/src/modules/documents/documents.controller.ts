import { BadRequestException, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.findAllForUser(user.id);
  }

  // Uses the raw Fastify request (via @fastify/multipart, registered in
  // main.ts) rather than a Nest interceptor - same pattern TurnsController
  // uses for SSE, since Nest's built-in FileInterceptor is Express-only.
  @Post()
  async upload(@CurrentUser() user: AuthenticatedUser, @Req() req: FastifyRequest) {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException('No file was uploaded.');
    }

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch {
      throw new BadRequestException('The file is too large or the upload failed.');
    }

    return this.documentsService.createFromUpload(user.id, file.filename, file.mimetype, buffer);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.remove(user.id, id);
  }
}
