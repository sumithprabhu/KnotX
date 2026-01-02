/**
 * Supported chain identifiers
 */
export enum ChainId {
  ETHEREUM_SEPOLIA = 'ethereum-sepolia',
  SOLANA_DEVNET = 'solana-devnet',
  CASPER_TESTNET = 'casper-testnet',
}

/**
 * Chain configuration interface
 */
export interface ChainConfig {
  chainId: ChainId;
  name: string;
  rpcUrl: string;
  privateKey?: string;
  enabled: boolean;
}

/**
 * Chain-specific connection interface
 */
export interface ChainConnection {
  chainId: ChainId;
  isConnected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
