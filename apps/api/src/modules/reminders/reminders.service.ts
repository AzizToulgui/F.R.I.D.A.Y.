import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reminder } from './entities/reminder.entity';

@Injectable()
export class RemindersService {
  constructor(
    @InjectRepository(Reminder)
    private readonly remindersRepository: Repository<Reminder>,
  ) {}

  // Called only from the create/update/delete reminder tools today, hence no
  // DTO/ownership dance here - `userId` always comes from the authenticated
  // ToolContext.
  async create(userId: string, text: string, dueAt: Date | null): Promise<Reminder> {
    const reminder = this.remindersRepository.create({ userId, text, dueAt, completedAt: null });
    return this.remindersRepository.save(reminder);
  }

  async findAllForUser(userId: string): Promise<Reminder[]> {
    return this.remindersRepository.find({
      where: { userId },
      order: { dueAt: 'ASC', createdAt: 'DESC' },
    });
  }

  async findOneOwned(userId: string, id: string): Promise<Reminder> {
    const reminder = await this.remindersRepository.findOne({ where: { id } });
    if (!reminder || reminder.userId !== userId) {
      throw new NotFoundException('Reminder not found');
    }
    return reminder;
  }

  async update(
    userId: string,
    id: string,
    updates: { text?: string; dueAt?: Date | null; completed?: boolean },
  ): Promise<Reminder> {
    const reminder = await this.findOneOwned(userId, id);
    if (updates.text !== undefined) reminder.text = updates.text;
    if (updates.dueAt !== undefined) reminder.dueAt = updates.dueAt;
    if (updates.completed !== undefined) reminder.completedAt = updates.completed ? new Date() : null;
    return this.remindersRepository.save(reminder);
  }

  async remove(userId: string, id: string): Promise<void> {
    const reminder = await this.findOneOwned(userId, id);
    await this.remindersRepository.remove(reminder);
  }
}
