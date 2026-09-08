import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiError, Content, GoogleGenAI, Modality, ThinkingLevel } from '@google/genai';
import type { GenerateContentResponse, GenerateContentResponseUsageMetadata, Part, Tool } from '@google/genai';
import { GeminiConfig } from '../../../config/gemini.config';
import { AIProvider } from '../ai-provider.interface';
import {
  ChatMessage,
  CountTokensParams,
  EmbeddingResult,
  FunctionCallRequest,
  GenerateTextParams,
  GenerateTextResult,
  LiveSessionToken,
  LiveVoiceOptions,
  SpeechSample,
  TokenUsage,
  ToolDeclaration,
} from '../ai-provider.types';
import { buildVoiceSystemPrompt } from '../jarvis-persona';

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

// Chat is a latency- and cost-sensitive path (Section 18) - extended
// "thinking" is worth it for hard reasoning tasks but not for a
// conversational assistant reply, so it's switched off here rather than left
// at the model default. Only applied when using the default text model
// (params.model unset): background jobs that explicitly override the model
// (memory extraction, conversation titling - always a cheaper Lite-tier
// model) get the model's own default thinking behavior instead, since not
// every model accepts a disabled-thinking config the same way -
// gemini-3.5-flash-lite rejects thinkingBudget: 0 outright with a 400 (only
// accepts -1/dynamic or a positive budget), and gemini-3.6-flash (the
// primary chat model) *also* rejects thinkingBudget: 0 the same way but
// accepts thinkingLevel: 'minimal' instead, which verified empirically to
// produce zero thinking tokens - same effect, different knob per model
// generation.
function thinkingConfigFor(params: GenerateTextParams): { thinkingLevel: ThinkingLevel } | undefined {
  return params.model ? undefined : { thinkingLevel: ThinkingLevel.MINIMAL };
}

function toContents(messages: ChatMessage[]): Content[] {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => {
      const parts: Part[] = [];
      if (message.content) parts.push({ text: message.content });
      for (const call of message.functionCalls ?? []) {
        parts.push({
          functionCall: { name: call.name, args: call.args, id: call.id },
          // Must be replayed on the exact part that carried it, or a
          // thinking-enabled model 400s on the next round - see
          // FunctionCallRequest.thoughtSignature.
          thoughtSignature: call.thoughtSignature,
        });
      }
      for (const response of message.functionResponses ?? []) {
        parts.push({ functionResponse: { name: response.name, response: response.response, id: response.id } });
      }
      return { role: message.role === 'model' ? 'model' : 'user', parts };
    });
}

const DEFAULT_TTS_SAMPLE_RATE_HZ = 24000;

// Gemini's TTS response reports its PCM rate in the part's mimeType (e.g.
// "audio/L16;codec=pcm;rate=24000") rather than as a structured field -
// falls back to the documented default if that ever changes shape.
function parseSampleRateHz(mimeType?: string): number {
  const match = mimeType?.match(/rate=(\d+)/);
  return match ? Number(match[1]) : DEFAULT_TTS_SAMPLE_RATE_HZ;
}

function toUsage(usage?: GenerateContentResponseUsageMetadata): TokenUsage {
  return {
    promptTokens: usage?.promptTokenCount ?? 0,
    completionTokens: usage?.candidatesTokenCount ?? 0,
    totalTokens: usage?.totalTokenCount ?? 0,
  };
}

// Provider-agnostic ToolDeclaration -> the Gemini SDK's Tool shape, plus a
// standing native Google Search grounding tool (real web search, no
// separate API/key - the Custom Search JSON API's "search the entire web"
// mode was deprecated for new engines, so this replaced the custom
// web_search tool entirely). Declared as a sibling Tool entry rather than
// merged into the functionDeclarations one - both googleSearch and
// functionDeclarations combining in the same `tools` array is documented,
// supported Gemini 2.0+ "compositional" tool use.
function toGeminiTools(tools?: ToolDeclaration[]): Tool[] {
  const geminiTools: Tool[] = [{ googleSearch: {} }];
  if (tools?.length) {
    geminiTools.push({
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parametersJsonSchema: tool.parametersJsonSchema,
      })),
    });
  }
  return geminiTools;
}

// Deliberately reads parts directly instead of the SDK's `response.functionCalls`
// convenience getter, which flattens out `part.thoughtSignature` - see
// FunctionCallRequest.thoughtSignature for why that can't be dropped.
function extractFunctionCalls(response: GenerateContentResponse): FunctionCallRequest[] | undefined {
  const parts = response.candidates?.[0]?.content?.parts;
  const calls = parts
    ?.filter((part) => part.functionCall)
    .map((part) => ({
      name: part.functionCall!.name ?? '',
      args: part.functionCall!.args ?? {},
      id: part.functionCall!.id,
      thoughtSignature: part.thoughtSignature,
    }));
  return calls?.length ? calls : undefined;
}

// Translates a Gemini SDK error into a specific, user-safe HttpException -
// most importantly distinguishing "you're out of API quota/credits" (429,
// the SDK's ApiError.status) from a generic outage, so the chat UI can show
// what's actually wrong instead of a one-size-fits-all "something went
// wrong". Every message here is intentionally written to be shown to the
// end user as-is (see TurnsController, which forwards HttpException messages
// verbatim over the turn's SSE `error` event, but not other error types).
function toGeminiHttpException(error: unknown, fallback: string): HttpException {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return new HttpException(
        "You've hit your Gemini API quota or credit limit. Check your plan and billing at https://ai.google.dev/gemini-api/docs/rate-limits, or wait for it to reset, then try again.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (error.status === 401 || error.status === 403) {
      return new UnauthorizedException('The Gemini API key configured on this server was rejected - it may be invalid, revoked, or missing billing.');
    }
  }
  return new ServiceUnavailableException(fallback);
}

// Concrete Gemini implementation of AIProvider. Live session token minting
// (Step 4), text generation/streaming and token counting (Step 7), and
// embeddings (Step 9, reused by RAG in Step 11) are wired to the real API.
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
        model: params.model ?? this.config.textModel,
        contents: toContents(params.messages),
        config: {
          systemInstruction: params.systemInstruction,
          thinkingConfig: thinkingConfigFor(params),
          tools: toGeminiTools(params.tools),
        },
      });
      return {
        content: response.text ?? '',
        usage: toUsage(response.usageMetadata),
        functionCalls: extractFunctionCalls(response),
      };
    } catch (error) {
      this.logger.error('Gemini generateText failed', error instanceof Error ? error.stack : error);
      throw toGeminiHttpException(error, 'Could not reach Gemini for a text response right now.');
    }
  }

  async *generateTextStream(params: GenerateTextParams): AsyncGenerator<string, GenerateTextResult, void> {
    const ai = this.stableClient();
    let stream: AsyncGenerator<GenerateContentResponse>;
    try {
      stream = await ai.models.generateContentStream({
        model: params.model ?? this.config.textModel,
        contents: toContents(params.messages),
        config: {
          systemInstruction: params.systemInstruction,
          thinkingConfig: thinkingConfigFor(params),
          tools: toGeminiTools(params.tools),
        },
      });
    } catch (error) {
      this.logger.error(
        'Gemini generateTextStream failed to start',
        error instanceof Error ? error.stack : error,
      );
      throw toGeminiHttpException(error, 'Could not reach Gemini for a text response right now.');
    }

    let content = '';
    let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let functionCalls: FunctionCallRequest[] | undefined;
    try {
      for await (const chunk of stream) {
        if (chunk.text) {
          content += chunk.text;
          yield chunk.text;
        }
        if (chunk.usageMetadata) usage = toUsage(chunk.usageMetadata);
        const chunkCalls = extractFunctionCalls(chunk);
        if (chunkCalls) functionCalls = chunkCalls;
      }
    } catch (error) {
      this.logger.error('Gemini generateTextStream failed mid-stream', error instanceof Error ? error.stack : error);
      throw toGeminiHttpException(error, 'The response from Gemini was interrupted.');
    }
    return { content, usage, functionCalls };
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

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const ai = this.stableClient();
    try {
      const response = await ai.models.embedContent({
        model: this.config.embeddingModel,
        contents: [text],
        // Fixed size (not the model's native dimensionality) because the
        // pgvector column width is fixed at migration time - see
        // GeminiConfig.embeddingDimensions.
        config: { outputDimensionality: this.config.embeddingDimensions },
      });
      const vector = response.embeddings?.[0]?.values;
      if (!vector) {
        throw new Error('Gemini returned no embedding values.');
      }
      return { vector };
    } catch (error) {
      this.logger.error('Gemini generateEmbedding failed', error instanceof Error ? error.stack : error);
      throw new ServiceUnavailableException('Could not reach Gemini for an embedding right now.');
    }
  }

  async synthesizeSpeech(text: string, voiceName: string): Promise<SpeechSample> {
    const ai = this.stableClient();
    try {
      const response = await ai.models.generateContent({
        model: this.config.ttsModel,
        // A bare sentence (e.g. "Hi, I'm JARVIS.") reads as a conversational
        // prompt - the TTS model tried to reply to it with text instead of
        // just speaking it (400 INVALID_ARGUMENT: "Model tried to generate
        // text, but it should only be used for TTS"). This framing forces
        // it to treat `text` as a literal transcript to vocalize.
        contents: [{ role: 'user', parts: [{ text: `Say exactly the following and nothing else: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      });
      const inline = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
      if (!inline?.data) {
        throw new Error('Gemini returned no audio data.');
      }
      return { audioBase64: inline.data, sampleRateHz: parseSampleRateHz(inline.mimeType) };
    } catch (error) {
      this.logger.error('Gemini synthesizeSpeech failed', error instanceof Error ? error.stack : error);
      throw new ServiceUnavailableException('Could not generate a voice sample right now.');
    }
  }

  async mintLiveSessionToken(tools?: ToolDeclaration[], voice?: LiveVoiceOptions): Promise<LiveSessionToken> {
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
              systemInstruction: buildVoiceSystemPrompt(voice?.deliveryStyleInstruction),
              tools: toGeminiTools(tools),
              // Omitted entirely (not sent as undefined) when the user hasn't
              // picked one, so Gemini falls back to its own default voice
              // rather than erroring on a malformed speechConfig.
              ...(voice?.voiceName
                ? { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice.voiceName } } } }
                : {}),
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
