import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reminder } from './entities/reminder.entity';

@Injectable()
export class RemindersService {
  constructor(
    @InjectRepository(Reminder)
    private readonly remindersRepository: Repository<Reminder>,
  ) {}

  // Called only from CreateReminderTool.execute today, hence no DTO/ownership
  // dance here - `userId` always comes from the authenticated ToolContext.
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
}
