import { ChainId } from '../types/chains';

/**
 * Chain metadata constants
 */
export const CHAIN_NAMES: Record<ChainId, string> = {
  [ChainId.ETHEREUM_SEPOLIA]: 'Ethereum Sepolia',
  [ChainId.SOLANA_DEVNET]: 'Solana Devnet',
  [ChainId.CASPER_TESTNET]: 'Casper Testnet',
};

/**
 * Default gateway addresses (stubbed - will be replaced with actual addresses)
 */
export const DEFAULT_GATEWAY_ADDRESSES: Record<ChainId, string> = {
  [ChainId.ETHEREUM_SEPOLIA]: '0x0000000000000000000000000000000000000000',
  [ChainId.SOLANA_DEVNET]: '11111111111111111111111111111111',
  [ChainId.CASPER_TESTNET]: 'contract-hash-placeholder',
};
