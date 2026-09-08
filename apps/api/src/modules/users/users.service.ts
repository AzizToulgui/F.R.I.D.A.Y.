import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email: this.normalizeEmail(email) } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(params: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<User> {
    const email = this.normalizeEmail(params.email);
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = this.usersRepository.create({
      email,
      passwordHash: params.passwordHash,
      displayName: params.displayName,
    });
    return this.usersRepository.save(user);
  }

  // For "Continue with Google" signups - no password is ever set. Unlike
  // `create`, this doesn't throw on an existing email: the caller (Google
  // OAuth callback) already checked `findByEmail` and only reaches here for
  // a genuinely new user.
  async createFromGoogle(params: { email: string; displayName: string }): Promise<User> {
    const user = this.usersRepository.create({
      email: this.normalizeEmail(params.email),
      passwordHash: null,
      displayName: params.displayName,
    });
    return this.usersRepository.save(user);
  }

  // `undefined` fields are left untouched (partial update); pass `null`
  // explicitly to clear a preference back to Gemini's default.
  async updateVoiceSettings(
    userId: string,
    updates: { voiceName?: string | null; voiceDeliveryStyle?: string | null },
  ): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (updates.voiceName !== undefined) user.voiceName = updates.voiceName;
    if (updates.voiceDeliveryStyle !== undefined) user.voiceDeliveryStyle = updates.voiceDeliveryStyle;
    return this.usersRepository.save(user);
  }

  async setToolEnabled(userId: string, toolName: string, enabled: boolean): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const disabled = new Set(user.disabledTools);
    if (enabled) disabled.delete(toolName);
    else disabled.add(toolName);
    user.disabledTools = [...disabled];
    return this.usersRepository.save(user);
  }
}
