import { Injectable, Logger, NotImplementedException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Content, GoogleGenAI, Modality } from '@google/genai';
import type { GenerateContentResponseUsageMetadata } from '@google/genai';
import { GeminiConfig } from '../../../config/gemini.config';
import { AIProvider } from '../ai-provider.interface';
import {
  ChatMessage,
  CountTokensParams,
  EmbeddingResult,
  GenerateTextParams,
  GenerateTextResult,
  LiveSessionToken,
  TokenUsage,
} from '../ai-provider.types';
import { JARVIS_VOICE_SYSTEM_PROMPT } from '../jarvis-persona';

// Ephemeral auth tokens are a Gemini Developer API feature and, per the SDK,
// only available on the v1alpha surface - stable APIs (text/embeddings, once
// wired in later steps) should NOT set this override.
const LIVE_TOKEN_API_VERSION = 'v1alpha';

// The client must open the WebSocket before this many seconds pass, or the
// token is rejected. Short on purpose: the token is minted right before the
// frontend uses it, never stored or reused across requests.
const NEW_SESSION_WINDOW_SECONDS = 60;

// Once connected, how long the session itself may run before Gemini closes
// it and the client must reconnect with a fresh token.
const SESSION_LIFETIME_SECONDS = 30 * 60;

// Chat is a latency- and cost-sensitive path (Section 18) - Gemini 2.5's
// extended "thinking" is worth it for hard reasoning tasks but not for a
// conversational assistant reply, so it's switched off here rather than left
// at the model default.
const CHAT_THINKING_BUDGET = 0;

function toContents(messages: ChatMessage[]): Content[] {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'model' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));
}

function toUsage(usage?: GenerateContentResponseUsageMetadata): TokenUsage {
  return {
    promptTokens: usage?.promptTokenCount ?? 0,
    completionTokens: usage?.candidatesTokenCount ?? 0,
    totalTokens: usage?.totalTokenCount ?? 0,
  };
}

// Concrete Gemini implementation of AIProvider. Live session token minting
// (Step 4), text generation/streaming and token counting (Step 7) are wired
// to the real API; embeddings remain a stub until RAG (Step 11).
@Injectable()
export class GeminiProvider extends AIProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly config: GeminiConfig;
  // Lazily created, reused across calls - separate from the v1alpha client
  // used for ephemeral Live tokens, since stable text/embedding APIs must
  // not carry that override (see mintLiveSessionToken).
  private stableClientInstance: GoogleGenAI | null = null;

  constructor(configService: ConfigService) {
    super();
    this.config = configService.get<GeminiConfig>('gemini')!;
    if (!this.config.apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY is not set - GeminiProvider methods will throw until it is configured.',
      );
    }
  }

  private stableClient(): GoogleGenAI {
    if (!this.config.apiKey) {
      throw new ServiceUnavailableException('The AI provider is not configured on this server.');
    }
    if (!this.stableClientInstance) {
      this.stableClientInstance = new GoogleGenAI({ apiKey: this.config.apiKey });
    }
    return this.stableClientInstance;
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const ai = this.stableClient();
    try {
      const response = await ai.models.generateContent({
        model: this.config.textModel,
        contents: toContents(params.messages),
        config: {
          systemInstruction: params.systemInstruction,
          thinkingConfig: { thinkingBudget: CHAT_THINKING_BUDGET },
        },
      });
      return { content: response.text ?? '', usage: toUsage(response.usageMetadata) };
    } catch (error) {
      this.logger.error('Gemini generateText failed', error instanceof Error ? error.stack : error);
      throw new ServiceUnavailableException('Could not reach Gemini for a text response right now.');
    }
  }

  async *generateTextStream(params: GenerateTextParams): AsyncGenerator<string, GenerateTextResult, void> {
    const ai = this.stableClient();
    let stream: AsyncGenerator<{ text?: string; usageMetadata?: GenerateContentResponseUsageMetadata }>;
    try {
      stream = await ai.models.generateContentStream({
        model: this.config.textModel,
        contents: toContents(params.messages),
        config: {
          systemInstruction: params.systemInstruction,
          thinkingConfig: { thinkingBudget: CHAT_THINKING_BUDGET },
        },
      });
    } catch (error) {
      this.logger.error(
        'Gemini generateTextStream failed to start',
        error instanceof Error ? error.stack : error,
      );
      throw new ServiceUnavailableException('Could not reach Gemini for a text response right now.');
    }

    let content = '';
    let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    try {
      for await (const chunk of stream) {
        if (chunk.text) {
          content += chunk.text;
          yield chunk.text;
        }
        if (chunk.usageMetadata) usage = toUsage(chunk.usageMetadata);
      }
    } catch (error) {
      this.logger.error('Gemini generateTextStream failed mid-stream', error instanceof Error ? error.stack : error);
      throw new ServiceUnavailableException('The response from Gemini was interrupted.');
    }
    return { content, usage };
  }

  async countTokens(params: CountTokensParams): Promise<number> {
    const ai = this.stableClient();
    try {
      const response = await ai.models.countTokens({
        model: this.config.textModel,
        contents: toContents(params.messages),
      });
      return response.totalTokens ?? 0;
    } catch (error) {
      this.logger.error('Gemini countTokens failed', error instanceof Error ? error.stack : error);
      throw new ServiceUnavailableException('Could not reach Gemini right now.');
    }
  }

  async generateEmbedding(_text: string): Promise<EmbeddingResult> {
    throw new NotImplementedException(
      'GeminiProvider.generateEmbedding is implemented in a later step (RAG).',
    );
  }

  async mintLiveSessionToken(): Promise<LiveSessionToken> {
    if (!this.config.apiKey) {
      throw new ServiceUnavailableException('Live voice sessions are not configured on this server.');
    }

    const ai = new GoogleGenAI({
      apiKey: this.config.apiKey,
      httpOptions: { apiVersion: LIVE_TOKEN_API_VERSION },
    });

    const newSessionExpireTime = new Date(Date.now() + NEW_SESSION_WINDOW_SECONDS * 1000);
    const expireTime = new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000);

    try {
      const authToken = await ai.authTokens.create({
        config: {
          uses: 1,
          expireTime: expireTime.toISOString(),
          newSessionExpireTime: newSessionExpireTime.toISOString(),
          // Locks the model and session config server-side so a stolen token
          // can't be used to open a session with a different (costlier or
          // unintended) model/config than this backend authorized. Verified
          // empirically: once a token carries ANY liveConnectConstraints,
          // Gemini ignores config fields the client passes to live.connect()
          // entirely - anything the session needs (transcription, etc.) has
          // to be requested here, not client-side.
          liveConnectConstraints: {
            model: this.config.liveModel,
            config: {
              responseModalities: [Modality.AUDIO],
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              // A Live session has no per-turn system instruction like text
              // generation does, so JARVIS's identity/multilingual behavior
              // has to be locked in here, once, for the whole session.
              systemInstruction: JARVIS_VOICE_SYSTEM_PROMPT,
            },
          },
        },
      });

      if (!authToken.name) {
        throw new Error('Gemini did not return a token name.');
      }

      return {
        token: authToken.name,
        expiresAt: authToken.expireTime ? new Date(authToken.expireTime) : expireTime,
        newSessionExpiresAt: authToken.newSessionExpireTime
          ? new Date(authToken.newSessionExpireTime)
          : newSessionExpireTime,
        model: this.config.liveModel,
      };
    } catch (error) {
      this.logger.error('Failed to mint Gemini Live ephemeral token', error instanceof Error ? error.stack : error);
      throw new ServiceUnavailableException('Could not start a live voice session right now.');
    }
  }
}
