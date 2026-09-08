import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),

  REDIS_URL: Joi.string().uri().required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN_DAYS: Joi.number().default(7),
  JWT_ISSUER: Joi.string().default('friday'),
  JWT_AUDIENCE: Joi.string().default('friday-clients'),

  THROTTLE_TTL_MS: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(100),

  // Optional at this stage: no Gemini calls are wired up until Step 4+.
  GEMINI_API_KEY: Joi.string().allow('').default(''),
  GEMINI_TEXT_MODEL: Joi.string().default('gemini-3.6-flash'),
  GEMINI_LIVE_MODEL: Joi.string().default('gemini-2.5-flash-native-audio-preview'),
  GEMINI_EMBEDDING_MODEL: Joi.string().default('gemini-embedding-001'),
  GEMINI_EMBEDDING_DIMENSIONS: Joi.number().default(768),

  CONVERSATION_MAX_HISTORY_TOKENS: Joi.number().default(4000),
  CONVERSATION_TITLING_MODEL: Joi.string().default('gemini-3.5-flash-lite'),

  MEMORY_RETRIEVAL_TOP_K: Joi.number().default(5),
  MEMORY_DEDUP_SIMILARITY_THRESHOLD: Joi.number().min(0).max(1).default(0.92),
  MEMORY_EXTRACTION_MODEL: Joi.string().default('gemini-3.5-flash-lite'),

  RAG_CHUNK_TARGET_TOKENS: Joi.number().default(650),
  RAG_CHUNK_OVERLAP_RATIO: Joi.number().min(0).max(0.5).default(0.12),
  RAG_RETRIEVAL_TOP_K: Joi.number().default(5),
  RAG_MAX_UPLOAD_BYTES: Joi.number().default(20 * 1024 * 1024),

  // Optional until a Google Cloud OAuth client is configured - "Continue with
  // Google" and the Gmail/Calendar tools all fail with a clear error, but
  // the app still boots, same precedent as GEMINI_API_KEY above.
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').default(''),
  GOOGLE_REDIRECT_URI: Joi.string().allow('').default(''),
  // 64 hex chars = 32 bytes, required by AES-256-GCM. Only enforced at the
  // point TokenCipherService is actually used, not at boot.
  TOKEN_ENCRYPTION_KEY: Joi.string().allow('').default(''),

  VOICE_MEMO_MAX_UPLOAD_BYTES: Joi.number().default(10 * 1024 * 1024),

  LOG_LEVEL: Joi.string().default('info'),
});
