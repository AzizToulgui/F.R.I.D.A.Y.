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
  JWT_ISSUER: Joi.string().default('jarvis'),
  JWT_AUDIENCE: Joi.string().default('jarvis-clients'),

  THROTTLE_TTL_MS: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(100),

  // Optional at this stage: no Gemini calls are wired up until Step 4+.
  GEMINI_API_KEY: Joi.string().allow('').default(''),
  GEMINI_TEXT_MODEL: Joi.string().default('gemini-2.5-flash'),
  GEMINI_LIVE_MODEL: Joi.string().default('gemini-2.5-flash-native-audio-preview'),
  GEMINI_EMBEDDING_MODEL: Joi.string().default('gemini-embedding-001'),

  CONVERSATION_MAX_HISTORY_TOKENS: Joi.number().default(4000),

  LOG_LEVEL: Joi.string().default('info'),
});
