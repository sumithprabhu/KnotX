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
    privateKey: env.ETHEREUM_SEPOLIA_PRIVATE_KEY,
    enabled: true,
  },
  [ChainId.SOLANA_DEVNET]: {
    chainId: ChainId.SOLANA_DEVNET,
    name: 'Solana Devnet',
    rpcUrl: env.SOLANA_DEVNET_RPC_URL,
    privateKey: env.SOLANA_PRIVATE_KEY,
    enabled: true,
  },
  [ChainId.CASPER_TESTNET]: {
    chainId: ChainId.CASPER_TESTNET,
    name: 'Casper Testnet',
    rpcUrl: env.CASPER_TESTNET_RPC_URL,
    privateKey: env.CASPER_PRIVATE_KEY,
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
