const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ quiet: true });

const passwordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/, 'Must include an uppercase character')
  .regex(/[a-z]/, 'Must include a lowercase character')
  .regex(/[0-9]/, 'Must include a number');

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGO_URI: z.string().min(1),
  APP_CURRENCY: z.string().trim().length(3).default('THB'),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  SYSTEM_USER_EMAIL: z.string().email(),
  SYSTEM_USER_PASSWORD: passwordSchema,
  SYSTEM_USER_NAME: z.string().trim().min(1).default('Backend Ledger System'),
  EMAIL_USER: z.string().trim().optional().default(''),
  CLIENT_ID: z.string().trim().optional().default(''),
  CLIENT_SECRET: z.string().trim().optional().default(''),
  EMAIL_REFRESH_TOKEN: z.string().trim().optional().default(''),
});

const parsedEnv = rawEnvSchema.parse(process.env);

const emailConfig = {
  clientId: parsedEnv.CLIENT_ID,
  clientSecret: parsedEnv.CLIENT_SECRET,
  refreshToken: parsedEnv.EMAIL_REFRESH_TOKEN,
  user: parsedEnv.EMAIL_USER,
};

const isEmailEnabled =
  Boolean(emailConfig.user) &&
  Boolean(emailConfig.clientId) &&
  Boolean(emailConfig.clientSecret) &&
  Boolean(emailConfig.refreshToken);

const config = {
  accessTokenSecret: parsedEnv.ACCESS_TOKEN_SECRET,
  accessTokenTtlMinutes: parsedEnv.ACCESS_TOKEN_TTL_MINUTES,
  appCurrency: parsedEnv.APP_CURRENCY.toUpperCase(),
  corsOrigins: parsedEnv.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  email: {
    ...emailConfig,
    enabled: isEmailEnabled,
  },
  nodeEnv: parsedEnv.NODE_ENV,
  mongoUri: parsedEnv.MONGO_URI,
  port: parsedEnv.PORT,
  rateLimits: {
    auth: {
      max: parsedEnv.RATE_LIMIT_AUTH_MAX,
      windowMs: parsedEnv.RATE_LIMIT_AUTH_WINDOW_MS,
    },
  },
  refreshTokenSecret: parsedEnv.REFRESH_TOKEN_SECRET,
  refreshTokenTtlDays: parsedEnv.REFRESH_TOKEN_TTL_DAYS,
  systemUser: {
    email: parsedEnv.SYSTEM_USER_EMAIL,
    name: parsedEnv.SYSTEM_USER_NAME,
    password: parsedEnv.SYSTEM_USER_PASSWORD,
  },
};

module.exports = {
  config,
};
