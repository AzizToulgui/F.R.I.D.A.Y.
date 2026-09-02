import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { Conversation } from './entities/conversation.entity';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let repo: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock; remove: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((entity) => Promise.resolve({ id: 'conv-1', ...entity })),
      remove: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: getRepositoryToken(Conversation), useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(ConversationsService);
  });

  it('creates a conversation defaulting the title', async () => {
    const result = await service.create('user-1', {});
    expect(result.title).toBe('New conversation');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', title: 'New conversation' }),
    );
  });

  it('returns a conversation owned by the requesting user', async () => {
    repo.findOne.mockResolvedValue({ id: 'conv-1', userId: 'user-1' });
    const result = await service.findOneOwned('user-1', 'conv-1');
    expect(result.id).toBe('conv-1');
  });

  it('throws NotFound (not Forbidden) for a conversation owned by someone else', async () => {
    repo.findOne.mockResolvedValue({ id: 'conv-1', userId: 'someone-else' });
    await expect(service.findOneOwned('user-1', 'conv-1')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFound for a nonexistent conversation', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOneOwned('user-1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('sets customInstructions on update, trimmed', async () => {
    repo.findOne.mockResolvedValue({ id: 'conv-1', userId: 'user-1', customInstructions: null });
    const result = await service.update('user-1', 'conv-1', { customInstructions: '  reply in French  ' });
    expect(result.customInstructions).toBe('reply in French');
  });

  it('clears customInstructions when given an empty string', async () => {
    repo.findOne.mockResolvedValue({ id: 'conv-1', userId: 'user-1', customInstructions: 'old' });
    const result = await service.update('user-1', 'conv-1', { customInstructions: '   ' });
    expect(result.customInstructions).toBeNull();
  });

  it('leaves customInstructions untouched when not provided', async () => {
    repo.findOne.mockResolvedValue({ id: 'conv-1', userId: 'user-1', customInstructions: 'old' });
    const result = await service.update('user-1', 'conv-1', { title: 'renamed' });
    expect(result.customInstructions).toBe('old');
  });
});
