/**
 * Standardized message format for cross-chain relaying
 */
export interface RelayMessage {
  messageId: string;
  nonce: number;
  sourceChain: string;
  destinationChain: string;
  sourceGateway: string;
  destinationGateway: string;
  payload: string; // Hex encoded payload
  payloadHash: string; // Hash of payload for verification
  timestamp: Date;
}

/**
 * Message delivery status
 */
export enum MessageStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

/**
 * Result of a relay operation
 */
export interface RelayResult {
  success: boolean;
  messageId: string;
  transactionHash?: string;
  error?: string;
  timestamp: Date;
}
