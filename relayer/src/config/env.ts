import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Environment variable schema with validation
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('3000'),
  MONGODB_URI: z.string(),
  ETHEREUM_SEPOLIA_RPC_URL: z.string().url(),
  ETHEREUM_SEPOLIA_PRIVATE_KEY: z.string().optional(),
  ETHEREUM_SEPOLIA_GATEWAY: z.string().optional(),
  CASPER_TESTNET_RPC_URL: z.string().url().optional(),
  CASPER_GATEWAY: z.string().optional(),
  CASPER_API_KEY: z.string().optional(),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
}).passthrough(); // Allow extra fields (like SOLANA_*) without validation

/**
 * Validated environment configuration
 */
export type EnvConfig = z.infer<typeof envSchema>;

let envConfig: EnvConfig;

try {
  envConfig = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:');
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export const env = envConfig;
