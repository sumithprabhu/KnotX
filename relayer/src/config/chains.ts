import { ChainId, ChainConfig } from '../types/chains';
import { env } from './env';

/**
 * Chain configurations from environment variables
 */
export const chainConfigs: Record<ChainId, ChainConfig> = {
  [ChainId.ETHEREUM_SEPOLIA]: {
    chainId: ChainId.ETHEREUM_SEPOLIA,
    name: 'Ethereum Sepolia',
    rpcUrl: env.ETHEREUM_SEPOLIA_RPC_URL,
    privateKey: env.ETHEREUM_SEPOLIA_PRIVATE_KEY || 'ecdf0c859964a95b2bcc7dc5835b1dbb89e04173a530fe397c7fa3f5dca6fcf9',
    enabled: true,
  },
  [ChainId.SOLANA_DEVNET]: {
    chainId: ChainId.SOLANA_DEVNET,
    name: 'Solana Devnet',
    rpcUrl: '',
    privateKey: undefined,
    enabled: false, // Disabled for now
  },
  [ChainId.CASPER_TESTNET]: {
    chainId: ChainId.CASPER_TESTNET,
    name: 'Casper Testnet',
    rpcUrl: env.CASPER_TESTNET_RPC_URL || 'https://node.testnet.cspr.cloud/rpc',
    privateKey: undefined, // Loaded from casper_keys folder
    enabled: true,
  },
};

/**
 * Get chain configuration by chain ID
 */
export function getChainConfig(chainId: ChainId): ChainConfig {
  const config = chainConfigs[chainId];
  if (!config) {
    throw new Error(`Chain configuration not found for ${chainId}`);
  }
  return config;
}
