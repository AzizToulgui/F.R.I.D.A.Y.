import { ConflictException, Injectable } from '@nestjs/common';
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
}
