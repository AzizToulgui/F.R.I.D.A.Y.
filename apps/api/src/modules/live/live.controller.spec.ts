import { Test } from '@nestjs/testing';
import { LiveController } from './live.controller';
import { AIProvider } from '../ai-provider/ai-provider.interface';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { UsersService } from '../users/users.service';

describe('LiveController', () => {
  it('mints a session token scoped to the registered tool declarations and the user’s voice preferences', async () => {
    const token = {
      token: 'auth_tokens/abc',
      expiresAt: new Date('2026-01-01T00:30:00.000Z'),
      newSessionExpiresAt: new Date('2026-01-01T00:01:00.000Z'),
      model: 'gemini-2.5-flash-native-audio-latest',
    };
    const provider = { mintLiveSessionToken: jest.fn().mockResolvedValue(token) };
    const declarations = [{ name: 'get_current_time', description: 'x', parametersJsonSchema: {} }];
    const toolRegistry = { getDeclarations: jest.fn().mockReturnValue(declarations) };
    const usersService = {
      findById: jest.fn().mockResolvedValue({ voiceName: 'Kore', voiceDeliveryStyle: 'warm-friendly' }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [LiveController],
      providers: [
        { provide: AIProvider, useValue: provider },
        { provide: ToolRegistryService, useValue: toolRegistry },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    const controller = moduleRef.get(LiveController);
    const user: AuthenticatedUser = { id: 'user-1', email: 'a@example.com', displayName: 'A' };

    const result = await controller.createSession(user);

    expect(result).toBe(token);
    expect(usersService.findById).toHaveBeenCalledWith('user-1');
    expect(provider.mintLiveSessionToken).toHaveBeenCalledWith(declarations, {
      voiceName: 'Kore',
      deliveryStyleInstruction: 'Warm, friendly, and conversational - like a helpful colleague, not a formal assistant.',
    });
  });

  it('mints a session token with no voice overrides when the user has none set', async () => {
    const token = {
      token: 'auth_tokens/abc',
      expiresAt: new Date('2026-01-01T00:30:00.000Z'),
      newSessionExpiresAt: new Date('2026-01-01T00:01:00.000Z'),
      model: 'gemini-2.5-flash-native-audio-latest',
    };
    const provider = { mintLiveSessionToken: jest.fn().mockResolvedValue(token) };
    const toolRegistry = { getDeclarations: jest.fn().mockReturnValue([]) };
    const usersService = { findById: jest.fn().mockResolvedValue({ voiceName: null, voiceDeliveryStyle: null }) };

    const moduleRef = await Test.createTestingModule({
      controllers: [LiveController],
      providers: [
        { provide: AIProvider, useValue: provider },
        { provide: ToolRegistryService, useValue: toolRegistry },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    const controller = moduleRef.get(LiveController);
    const user: AuthenticatedUser = { id: 'user-1', email: 'a@example.com', displayName: 'A' };

    await controller.createSession(user);

    expect(provider.mintLiveSessionToken).toHaveBeenCalledWith([], {
      voiceName: undefined,
      deliveryStyleInstruction: undefined,
    });
  });
});
