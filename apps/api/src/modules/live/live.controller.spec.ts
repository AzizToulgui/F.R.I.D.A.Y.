import { Test } from '@nestjs/testing';
import { LiveController } from './live.controller';
import { AIProvider } from '../ai-provider/ai-provider.interface';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

describe('LiveController', () => {
  it('delegates session minting to the AIProvider and returns its result', async () => {
    const token = {
      token: 'auth_tokens/abc',
      expiresAt: new Date('2026-01-01T00:30:00.000Z'),
      newSessionExpiresAt: new Date('2026-01-01T00:01:00.000Z'),
      model: 'gemini-2.5-flash-native-audio-latest',
    };
    const provider = { mintLiveSessionToken: jest.fn().mockResolvedValue(token) };

    const moduleRef = await Test.createTestingModule({
      controllers: [LiveController],
      providers: [{ provide: AIProvider, useValue: provider }],
    }).compile();

    const controller = moduleRef.get(LiveController);
    const user: AuthenticatedUser = { id: 'user-1', email: 'a@example.com', displayName: 'A' };

    const result = await controller.createSession(user);

    expect(result).toBe(token);
    expect(provider.mintLiveSessionToken).toHaveBeenCalledTimes(1);
  });
});
