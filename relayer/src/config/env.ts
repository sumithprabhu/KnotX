import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Parse comma-separated string into array
 */
function parseArray(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
}

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
  CASPER_TESTNET_RPC_URLS: z.string().optional(), // Comma-separated URLs
  CASPER_GATEWAY: z.string().optional(),
  CASPER_API_KEY: z.string().optional(),
  CASPER_API_KEYS: z.string().optional(), // Comma-separated API keys
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

/**
 * Get Casper RPC endpoints from environment variables
 * Supports multiple URLs and API keys
 * 
 * Format:
 * - CASPER_TESTNET_RPC_URLS: comma-separated URLs (e.g., "url1,url2,url3")
 * - CASPER_API_KEYS: comma-separated API keys (e.g., "key1,key2,key3")
 * 
 * If arrays are provided, they are paired: url[0] with key[0], url[1] with key[1], etc.
 * If only one URL is provided, all keys will be used with that URL.
 * If only one key is provided, all URLs will use that key.
 */
export function getCasperRpcEndpoints(): Array<{ url: string; apiKey?: string }> {
  const defaultUrl = 'https://node.testnet.cspr.cloud/rpc';
  
  // Parse arrays
  const urls = parseArray(envConfig.CASPER_TESTNET_RPC_URLS || envConfig.CASPER_TESTNET_RPC_URL);
  const apiKeys = parseArray(envConfig.CASPER_API_KEYS || envConfig.CASPER_API_KEY);
  
  const endpoints: Array<{ url: string; apiKey?: string }> = [];
  
  // If no URLs provided, use default
  if (urls.length === 0) {
    // If we have multiple API keys but only default URL, use all keys with default URL
    if (apiKeys.length > 0) {
      apiKeys.forEach(key => {
        endpoints.push({ url: defaultUrl, apiKey: key });
      });
    } else {
      // Use default URL with optional single API key
      endpoints.push({
        url: defaultUrl,
        apiKey: envConfig.CASPER_API_KEY,
      });
    }
    return endpoints;
  }
  
  // If we have URLs but no keys, use URLs with optional single key
  if (apiKeys.length === 0) {
    urls.forEach(url => {
      endpoints.push({
        url: url,
        apiKey: envConfig.CASPER_API_KEY,
      });
    });
    return endpoints;
  }
  
  // If we have both URLs and keys, pair them
  // If counts don't match, repeat the last key for extra URLs
  const maxLength = Math.max(urls.length, apiKeys.length);
  for (let i = 0; i < maxLength; i++) {
    endpoints.push({
      url: urls[i % urls.length],
      apiKey: apiKeys[i % apiKeys.length] || apiKeys[apiKeys.length - 1],
    });
  }
  
  return endpoints;
}
