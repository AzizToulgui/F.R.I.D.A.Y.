import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { GeminiProvider } from './gemini.provider';

const createMock = jest.fn();
const generateContentMock = jest.fn();
const generateContentStreamMock = jest.fn();
const countTokensMock = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    authTokens: { create: createMock },
    models: {
      generateContent: generateContentMock,
      generateContentStream: generateContentStreamMock,
      countTokens: countTokensMock,
    },
  })),
  Modality: { AUDIO: 'AUDIO' },
}));

describe('GeminiProvider.mintLiveSessionToken', () => {
  let configValue: { apiKey: string; textModel: string; liveModel: string; embeddingModel: string };

  const build = async () => {
    const configService = { get: jest.fn().mockReturnValue(configValue) } as unknown as ConfigService;
    const moduleRef = await Test.createTestingModule({
      providers: [GeminiProvider, { provide: ConfigService, useValue: configService }],
    }).compile();
    return moduleRef.get(GeminiProvider);
  };

  beforeEach(() => {
    createMock.mockReset();
    configValue = {
      apiKey: 'test-api-key',
      textModel: 'gemini-2.5-flash',
      liveModel: 'gemini-2.5-flash-native-audio-latest',
      embeddingModel: 'gemini-embedding-001',
    };
  });

  it('throws ServiceUnavailable when no API key is configured', async () => {
    configValue.apiKey = '';
    const provider = await build();
    await expect(provider.mintLiveSessionToken()).rejects.toThrow(ServiceUnavailableException);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('mints a token locking the configured live model and audio modality', async () => {
    createMock.mockResolvedValue({
      name: 'auth_tokens/abc123',
      expireTime: '2026-01-01T00:30:00.000Z',
      newSessionExpireTime: '2026-01-01T00:01:00.000Z',
    });

    const provider = await build();
    const result = await provider.mintLiveSessionToken();

    expect(result).toEqual({
      token: 'auth_tokens/abc123',
      expiresAt: new Date('2026-01-01T00:30:00.000Z'),
      newSessionExpiresAt: new Date('2026-01-01T00:01:00.000Z'),
      model: 'gemini-2.5-flash-native-audio-latest',
    });

    const call = createMock.mock.calls[0][0];
    expect(call.config.uses).toBe(1);
    expect(call.config.liveConnectConstraints.model).toBe('gemini-2.5-flash-native-audio-latest');
    expect(call.config.liveConnectConstraints.config.responseModalities).toEqual(['AUDIO']);
    // The Live session has no per-turn system instruction, so identity and
    // multilingual behavior must be locked into the token itself.
    expect(call.config.liveConnectConstraints.config.systemInstruction).toEqual(
      expect.stringContaining('JARVIS'),
    );
  });

  it('wraps SDK failures in ServiceUnavailable without leaking the raw error', async () => {
    createMock.mockRejectedValue(new Error('upstream exploded with sensitive detail'));
    const provider = await build();
    await expect(provider.mintLiveSessionToken()).rejects.toThrow(ServiceUnavailableException);
    await expect(provider.mintLiveSessionToken()).rejects.not.toThrow(/sensitive detail/);
  });

  it('throws ServiceUnavailable when Gemini returns no token name', async () => {
    createMock.mockResolvedValue({});
    const provider = await build();
    await expect(provider.mintLiveSessionToken()).rejects.toThrow(ServiceUnavailableException);
  });
});

describe('GeminiProvider text generation', () => {
  let configValue: { apiKey: string; textModel: string; liveModel: string; embeddingModel: string };

  const build = async () => {
    const configService = { get: jest.fn().mockReturnValue(configValue) } as unknown as ConfigService;
    const moduleRef = await Test.createTestingModule({
      providers: [GeminiProvider, { provide: ConfigService, useValue: configService }],
    }).compile();
    return moduleRef.get(GeminiProvider);
  };

  beforeEach(() => {
    generateContentMock.mockReset();
    generateContentStreamMock.mockReset();
    countTokensMock.mockReset();
    configValue = {
      apiKey: 'test-api-key',
      textModel: 'gemini-2.5-flash',
      liveModel: 'gemini-2.5-flash-native-audio-latest',
      embeddingModel: 'gemini-embedding-001',
    };
  });

  it('generateText maps content and usage, and disables thinking for chat', async () => {
    generateContentMock.mockResolvedValue({
      text: 'hello there',
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3, totalTokenCount: 8 },
    });

    const provider = await build();
    const result = await provider.generateText({
      messages: [{ role: 'user', content: 'hi' }],
      systemInstruction: 'be terse',
    });

    expect(result).toEqual({
      content: 'hello there',
      usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
    });
    const call = generateContentMock.mock.calls[0][0];
    expect(call.model).toBe('gemini-2.5-flash');
    expect(call.contents).toEqual([{ role: 'user', parts: [{ text: 'hi' }] }]);
    expect(call.config.systemInstruction).toBe('be terse');
    expect(call.config.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it('generateText maps a model-role history entry to Gemini "model"', async () => {
    generateContentMock.mockResolvedValue({ text: 'ok', usageMetadata: {} });
    const provider = await build();
    await provider.generateText({
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'model', content: 'hello' },
      ],
    });
    const call = generateContentMock.mock.calls[0][0];
    expect(call.contents).toEqual([
      { role: 'user', parts: [{ text: 'hi' }] },
      { role: 'model', parts: [{ text: 'hello' }] },
    ]);
  });

  it('generateText wraps SDK failures in ServiceUnavailable', async () => {
    generateContentMock.mockRejectedValue(new Error('upstream exploded'));
    const provider = await build();
    await expect(provider.generateText({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('generateText throws ServiceUnavailable when no API key is configured', async () => {
    configValue.apiKey = '';
    const provider = await build();
    await expect(provider.generateText({ messages: [] })).rejects.toThrow(ServiceUnavailableException);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('generateTextStream yields deltas and returns the final content + usage', async () => {
    async function* fakeStream() {
      yield { text: 'hel' };
      yield { text: 'lo' };
      yield { text: '', usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2, totalTokenCount: 6 } };
    }
    generateContentStreamMock.mockResolvedValue(fakeStream());

    const provider = await build();
    const stream = provider.generateTextStream({ messages: [{ role: 'user', content: 'hi' }] });

    const deltas: string[] = [];
    let next = await stream.next();
    while (!next.done) {
      deltas.push(next.value);
      next = await stream.next();
    }

    expect(deltas).toEqual(['hel', 'lo']);
    expect(next.value).toEqual({
      content: 'hello',
      usage: { promptTokens: 4, completionTokens: 2, totalTokens: 6 },
    });
  });

  it('generateTextStream wraps a mid-stream failure in ServiceUnavailable', async () => {
    async function* fakeStream() {
      yield { text: 'partial' };
      throw new Error('connection dropped');
    }
    generateContentStreamMock.mockResolvedValue(fakeStream());

    const provider = await build();
    const stream = provider.generateTextStream({ messages: [{ role: 'user', content: 'hi' }] });
    await stream.next();
    await expect(stream.next()).rejects.toThrow(ServiceUnavailableException);
  });

  it('countTokens returns the SDK total', async () => {
    countTokensMock.mockResolvedValue({ totalTokens: 42 });
    const provider = await build();
    const total = await provider.countTokens({ messages: [{ role: 'user', content: 'hi' }] });
    expect(total).toBe(42);
  });
});
