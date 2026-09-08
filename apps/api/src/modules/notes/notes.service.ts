import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Note } from './entities/note.entity';

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note)
    private readonly notesRepository: Repository<Note>,
  ) {}

  // Called only from the create/update/delete note tools today, hence no
  // DTO/ownership dance here - `userId` always comes from the authenticated
  // ToolContext (see RemindersService for the identical reasoning).
  async create(userId: string, title: string | null, content: string): Promise<Note> {
    const note = this.notesRepository.create({ userId, title, content });
    return this.notesRepository.save(note);
  }

  async findAllForUser(userId: string): Promise<Note[]> {
    return this.notesRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOneOwned(userId: string, id: string): Promise<Note> {
    const note = await this.notesRepository.findOne({ where: { id } });
    if (!note || note.userId !== userId) {
      throw new NotFoundException('Note not found');
    }
    return note;
  }

  async update(
    userId: string,
    id: string,
    updates: { title?: string | null; content?: string },
  ): Promise<Note> {
    const note = await this.findOneOwned(userId, id);
    if (updates.title !== undefined) note.title = updates.title;
    if (updates.content !== undefined) note.content = updates.content;
    return this.notesRepository.save(note);
  }

  async remove(userId: string, id: string): Promise<void> {
    const note = await this.findOneOwned(userId, id);
    await this.notesRepository.remove(note);
  }
}
