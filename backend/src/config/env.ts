import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  USE_META_MOCK: z.string().transform(v => v === 'true').default('true'),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  RDSTATION_CLIENT_ID: z.string().optional(),
  RDSTATION_CLIENT_SECRET: z.string().optional(),
  RDSTATION_ACCESS_TOKEN: z.string().optional(),
  API_KEY: z.string().default('dae-dev-key'),
  SUPABASE_URL: z.string().min(1, 'API_URL_supabase is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'service_role_supabase is required'),
});

// Map the Supabase env var names to the schema keys
const rawEnv = {
  ...process.env,
  SUPABASE_URL: process.env.API_URL_supabase,
  SUPABASE_SERVICE_ROLE_KEY: process.env.service_role_supabase,
};

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
