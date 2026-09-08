import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AIProvider } from '../ai-provider/ai-provider.interface';
import { GenerateTextResult } from '../ai-provider/ai-provider.types';
import { ConversationsService } from '../conversations/conversations.service';
import { Conversation, DEFAULT_CONVERSATION_TITLE } from '../conversations/entities/conversation.entity';
import { DocumentsService } from '../documents/documents.service';
import { MemoriesService } from '../memory/memories.service';
import { Message, MessageRole } from '../messages/entities/message.entity';
import { MessagesService } from '../messages/messages.service';
import { ToolExecutionService } from '../tools/tool-execution.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { CONVERSATION_TITLING_QUEUE } from './conversation-titling.queue';
import { ConversationEngineService } from './conversation-engine.service';
import { JARVIS_TEXT_SYSTEM_PROMPT } from '../ai-provider/jarvis-persona';

async function* fakeStream(deltas: string[], result: GenerateTextResult) {
  for (const delta of deltas) yield delta;
  return result;
}

async function drain<T, TReturn>(gen: AsyncGenerator<T, TReturn, void>): Promise<{ values: T[]; result: TReturn }> {
  const values: T[] = [];
  let step = await gen.next();
  while (!step.done) {
    values.push(step.value);
    step = await gen.next();
  }
  return { values, result: step.value };
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    userId: 'user-1',
    title: DEFAULT_CONVERSATION_TITLE,
    summary: null,
    summaryUpToMessageId: null,
    customInstructions: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Conversation;
}

function makeMessage(overrides: Partial<Message>): Message {
  return {
    id: 'm-0',
    conversationId: 'conv-1',
    role: MessageRole.USER,
    content: '',
    tokenCount: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Message;
}

describe('ConversationEngineService', () => {
  let store: Message[];
  let nextId: number;
  let aiProvider: {
    generateText: jest.Mock;
    generateTextStream: jest.Mock;
    countTokens: jest.Mock;
  };
  let conversationsService: { saveInternal: jest.Mock; findOneOwned: jest.Mock };
  let messagesService: {
    findAllForConversation: jest.Mock;
    createInternal: jest.Mock;
    updateTokenCount: jest.Mock;
  };
  let memoriesService: { retrieveRelevant: jest.Mock; enqueueExtraction: jest.Mock };
  let documentsService: { retrieveRelevantChunks: jest.Mock };
  let toolRegistry: { getDeclarations: jest.Mock };
  let toolExecutionService: { invokeAll: jest.Mock };
  let titlingQueue: { add: jest.Mock };
  let buildService: (maxHistoryTokens?: number) => Promise<ConversationEngineService>;

  beforeEach(() => {
    store = [];
    nextId = 0;

    aiProvider = {
      generateText: jest.fn(),
      generateTextStream: jest.fn(),
      countTokens: jest.fn().mockImplementation(({ messages }) =>
        Promise.resolve(messages[0].content.length),
      ),
    };
    conversationsService = {
      saveInternal: jest.fn((c: Conversation) => Promise.resolve(c)),
      findOneOwned: jest.fn(),
    };
    messagesService = {
      findAllForConversation: jest.fn(() => Promise.resolve(store)),
      createInternal: jest.fn((conversationId: string, role: MessageRole, content: string, options) => {
        const message = makeMessage({
          id: `m-${nextId++}`,
          conversationId,
          role,
          content,
          tokenCount: options?.tokenCount ?? null,
          metadata: options?.metadata ?? null,
        });
        store.push(message);
        return Promise.resolve(message);
      }),
      updateTokenCount: jest.fn((id: string, tokenCount: number) => {
        const message = store.find((m) => m.id === id);
        if (message) message.tokenCount = tokenCount;
        return Promise.resolve();
      }),
    };
    memoriesService = {
      retrieveRelevant: jest.fn().mockResolvedValue([]),
      enqueueExtraction: jest.fn().mockResolvedValue(undefined),
    };
    documentsService = { retrieveRelevantChunks: jest.fn().mockResolvedValue([]) };
    toolRegistry = { getDeclarations: jest.fn().mockReturnValue([]) };
    toolExecutionService = { invokeAll: jest.fn().mockResolvedValue([]) };
    titlingQueue = { add: jest.fn().mockResolvedValue(undefined) };

    buildService = async (maxHistoryTokens = 1000) => {
      const configService = {
        get: jest.fn().mockReturnValue({ maxHistoryTokens }),
      } as unknown as ConfigService;

      const moduleRef = await Test.createTestingModule({
        providers: [
          ConversationEngineService,
          { provide: ConversationsService, useValue: conversationsService },
          { provide: MessagesService, useValue: messagesService },
          { provide: MemoriesService, useValue: memoriesService },
          { provide: DocumentsService, useValue: documentsService },
          { provide: ToolRegistryService, useValue: toolRegistry },
          { provide: ToolExecutionService, useValue: toolExecutionService },
          { provide: AIProvider, useValue: aiProvider },
          { provide: getQueueToken(CONVERSATION_TITLING_QUEUE), useValue: titlingQueue },
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();

      return moduleRef.get(ConversationEngineService);
    };
  });

  it('getOwnedConversation delegates to ConversationsService.findOneOwned', async () => {
    conversationsService.findOneOwned.mockResolvedValue(makeConversation());
    const service = await buildService();
    await service.getOwnedConversation('user-1', 'conv-1');
    expect(conversationsService.findOneOwned).toHaveBeenCalledWith('user-1', 'conv-1');
  });

  it('records the user message, streams deltas, and persists the assistant reply with usage', async () => {
    const usage = { promptTokens: 10, completionTokens: 4, totalTokens: 14 };
    aiProvider.generateTextStream.mockReturnValue(fakeStream(['Hi', ' there'], { content: 'Hi there', usage }));

    const service = await buildService();
    const conversation = makeConversation();
    const { values, result } = await drain(service.streamTurn(conversation, 'Hello'));

    expect(values).toEqual(['Hi', ' there']);
    expect(result).toEqual({ messageId: expect.any(String), content: 'Hi there', usage });

    expect(messagesService.createInternal).toHaveBeenNthCalledWith(
      1,
      'conv-1',
      MessageRole.USER,
      'Hello',
      { tokenCount: 5 },
    );
    expect(messagesService.createInternal).toHaveBeenNthCalledWith(
      2,
      'conv-1',
      MessageRole.ASSISTANT,
      'Hi there',
      { tokenCount: 4, metadata: { promptTokens: 10, totalTokens: 14 } },
    );

    const streamCall = aiProvider.generateTextStream.mock.calls[0][0];
    expect(streamCall.systemInstruction).toBe(JARVIS_TEXT_SYSTEM_PROMPT);
    expect(streamCall.messages).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  it('folds custom instructions into the system instruction', async () => {
    aiProvider.generateTextStream.mockReturnValue(
      fakeStream(['ok'], { content: 'ok', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }),
    );
    const service = await buildService();
    const conversation = makeConversation({ customInstructions: 'Reply in French.' });
    await drain(service.streamTurn(conversation, 'hi'));

    const streamCall = aiProvider.generateTextStream.mock.calls[0][0];
    expect(streamCall.systemInstruction).toContain('Reply in French.');
  });

  it('summarizes older messages that fall outside the history token budget and excludes them from context', async () => {
    store.push(
      makeMessage({ id: 'm-old-1', role: MessageRole.USER, content: 'x'.repeat(30), tokenCount: 30 }),
      makeMessage({ id: 'm-old-2', role: MessageRole.ASSISTANT, content: 'y'.repeat(30), tokenCount: 30 }),
    );
    aiProvider.generateText.mockResolvedValue({
      content: 'Summary of the old exchange.',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });
    aiProvider.generateTextStream.mockReturnValue(
      fakeStream(['ok'], { content: 'ok', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }),
    );

    // Budget only fits the new (10-token) message - both 30-token old
    // messages exceed what's left and should get summarized away together.
    const service = await buildService(15);
    const conversation = makeConversation();
    await drain(service.streamTurn(conversation, 'z'.repeat(10)));

    expect(aiProvider.generateText).toHaveBeenCalledTimes(1);
    const summaryPrompt = aiProvider.generateText.mock.calls[0][0].messages[0].content;
    expect(summaryPrompt).toContain('x'.repeat(30));
    expect(summaryPrompt).toContain('y'.repeat(30));

    expect(conversation.summary).toBe('Summary of the old exchange.');
    expect(conversation.summaryUpToMessageId).toBe('m-old-2');
    expect(conversationsService.saveInternal).toHaveBeenCalledWith(conversation);

    const streamCall = aiProvider.generateTextStream.mock.calls[0][0];
    // Only the brand-new user message should be sent verbatim - the two old
    // ones are represented by the summary instead.
    expect(streamCall.messages).toEqual([{ role: 'user', content: 'z'.repeat(10) }]);
    expect(streamCall.systemInstruction).toContain('Summary of the old exchange.');
  });

  it('keeps the newest message in context even if it alone exceeds the budget', async () => {
    aiProvider.generateTextStream.mockReturnValue(
      fakeStream(['ok'], { content: 'ok', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }),
    );
    const service = await buildService(5);
    const conversation = makeConversation();
    await drain(service.streamTurn(conversation, 'this message is longer than the budget'));

    const streamCall = aiProvider.generateTextStream.mock.calls[0][0];
    expect(streamCall.messages).toEqual([
      { role: 'user', content: 'this message is longer than the budget' },
    ]);
  });

  it('does not advance the summary pointer when summarization fails, so those messages are retried next turn', async () => {
    store.push(
      makeMessage({ id: 'm-old-1', role: MessageRole.USER, content: 'x'.repeat(30), tokenCount: 30 }),
      makeMessage({ id: 'm-old-2', role: MessageRole.ASSISTANT, content: 'y'.repeat(30), tokenCount: 30 }),
    );
    aiProvider.generateText.mockRejectedValue(new Error('summarization backend down'));
    aiProvider.generateTextStream.mockReturnValue(
      fakeStream(['ok'], { content: 'ok', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }),
    );

    const service = await buildService(15);
    const conversation = makeConversation();
    const { result } = await drain(service.streamTurn(conversation, 'z'.repeat(10)));

    expect(aiProvider.generateText).toHaveBeenCalledTimes(1);
    expect(result.content).toBe('ok');
    expect(conversation.summary).toBeNull();
    expect(conversation.summaryUpToMessageId).toBeNull();
    // saveInternal is still called once - to bump updated_at for the
    // sidebar's recency ordering - just not as part of summarization.
    expect(conversationsService.saveInternal).toHaveBeenCalledTimes(1);
  });

  it('caches a lazily-computed token count back onto the message row', async () => {
    store.push(makeMessage({ id: 'm-old-1', role: MessageRole.USER, content: 'abcdef', tokenCount: null }));
    aiProvider.generateTextStream.mockReturnValue(
      fakeStream(['ok'], { content: 'ok', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }),
    );
    const service = await buildService();
    const conversation = makeConversation();
    await drain(service.streamTurn(conversation, 'hi'));

    expect(messagesService.updateTokenCount).toHaveBeenCalledWith('m-old-1', 6);
  });

  it('resolves a tool call before producing the final reply, and never persists the round trip as a message', async () => {
    const call = { name: 'get_current_time', args: {} };
    aiProvider.generateTextStream
      .mockReturnValueOnce(fakeStream([], { content: '', usage: { promptTokens: 1, completionTokens: 0, totalTokens: 1 }, functionCalls: [call] }))
      .mockReturnValueOnce(
        fakeStream(['It is ', 'noon.'], {
          content: 'It is noon.',
          usage: { promptTokens: 2, completionTokens: 2, totalTokens: 4 },
        }),
      );
    toolExecutionService.invokeAll.mockResolvedValue([{ name: 'get_current_time', response: { output: { iso: 'noon' } } }]);

    const service = await buildService();
    const conversation = makeConversation();
    const { values, result } = await drain(service.streamTurn(conversation, 'what time is it?'));

    expect(values).toEqual(['It is ', 'noon.']);
    expect(result.content).toBe('It is noon.');
    expect(toolExecutionService.invokeAll).toHaveBeenCalledWith({ userId: 'user-1', conversationId: 'conv-1' }, [call]);

    // Only the user message and the final assistant reply are persisted -
    // the tool-call/tool-response round trip is audited elsewhere (ToolInvocation), not stored as a Message.
    expect(messagesService.createInternal).toHaveBeenCalledTimes(2);
    expect(messagesService.createInternal).toHaveBeenNthCalledWith(
      2,
      'conv-1',
      MessageRole.ASSISTANT,
      'It is noon.',
      { tokenCount: 2, metadata: { promptTokens: 2, totalTokens: 4 } },
    );

    const secondCallMessages = aiProvider.generateTextStream.mock.calls[1][0].messages;
    expect(secondCallMessages).toEqual([
      { role: 'user', content: 'what time is it?' },
      { role: 'model', content: '', functionCalls: [call] },
      { role: 'user', content: '', functionResponses: [{ name: 'get_current_time', response: { output: { iso: 'noon' } } }] },
    ]);
  });

  it('stops requesting tools after MAX_TOOL_ROUNDS and returns whatever the last round produced', async () => {
    const call = { name: 'get_current_time', args: {} };
    // mockImplementation (not mockReturnValue): each round-trip iteration
    // calls generateTextStream again and must get a *fresh* generator - a
    // shared one would already be exhausted after the first `yield*`.
    aiProvider.generateTextStream.mockImplementation(() =>
      fakeStream([], { content: '', usage: { promptTokens: 1, completionTokens: 0, totalTokens: 1 }, functionCalls: [call] }),
    );
    toolExecutionService.invokeAll.mockResolvedValue([{ name: 'get_current_time', response: { output: {} } }]);

    const service = await buildService();
    const conversation = makeConversation();
    await drain(service.streamTurn(conversation, 'loop forever'));

    // MAX_TOOL_ROUNDS (4) tool round trips, plus the final round that isn't followed by another tool execution.
    expect(aiProvider.generateTextStream).toHaveBeenCalledTimes(5);
    expect(toolExecutionService.invokeAll).toHaveBeenCalledTimes(4);
  });

  it('enqueues a titling job while the conversation is still untitled', async () => {
    aiProvider.generateTextStream.mockReturnValue(
      fakeStream(['hi'], { content: 'hi', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }),
    );
    const service = await buildService();
    const conversation = makeConversation({ title: DEFAULT_CONVERSATION_TITLE });
    await drain(service.streamTurn(conversation, 'hello'));

    expect(titlingQueue.add).toHaveBeenCalledWith(
      'title',
      { conversationId: 'conv-1', userId: 'user-1' },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );
  });

  it('does not enqueue a titling job once the conversation already has a real title', async () => {
    aiProvider.generateTextStream.mockReturnValue(
      fakeStream(['hi'], { content: 'hi', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }),
    );
    const service = await buildService();
    const conversation = makeConversation({ title: 'Renamed by the user' });
    await drain(service.streamTurn(conversation, 'hello'));

    expect(titlingQueue.add).not.toHaveBeenCalled();
  });
});
