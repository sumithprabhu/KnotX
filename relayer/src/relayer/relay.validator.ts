import { RelayMessage } from '../types/message';
import { ChainId } from '../types/chains';
import { logger } from '../utils/logger';

/**
 * Validates relay messages before processing
 */
export class RelayValidator {
  /**
   * Validate a relay message
   */
  static validate(message: RelayMessage): { valid: boolean; error?: string } {
    try {
      // Validate messageId
      if (!message.messageId || message.messageId.trim() === '') {
        return { valid: false, error: 'Message ID is required' };
      }

      // Validate source chain
      // Allow chain IDs in format "chain-{number}" for unknown chains, but prefer known chains
      if (!message.sourceChain) {
        return { valid: false, error: 'Source chain is required' };
      }
      
      // If it's a known chain ID, validate it
      if (!Object.values(ChainId).includes(message.sourceChain as ChainId)) {
        // If it's in "chain-{number}" format, try to extract and validate
        if (message.sourceChain.startsWith('chain-')) {
          const chainNum = parseInt(message.sourceChain.replace('chain-', ''));
          // If it's a valid number, allow it but log a warning
          if (isNaN(chainNum)) {
            return {
              valid: false,
              error: `Invalid source chain format: ${message.sourceChain}`,
            };
          }
          // For now, allow unknown chain IDs but log
          logger.warn(
            { sourceChain: message.sourceChain, chainNum },
            'Unknown source chain ID, allowing but may cause issues'
          );
        } else {
          return {
            valid: false,
            error: `Invalid source chain: ${message.sourceChain}`,
          };
        }
      }

      // Validate destination chain
      if (
        !message.destinationChain ||
        !Object.values(ChainId).includes(message.destinationChain as ChainId)
      ) {
        return {
          valid: false,
          error: `Invalid destination chain: ${message.destinationChain}`,
        };
      }

      // Validate chains are different
      if (message.sourceChain === message.destinationChain) {
        return {
          valid: false,
          error: 'Source and destination chains must be different',
        };
      }

      // Validate gateways
      if (!message.sourceGateway || message.sourceGateway.trim() === '') {
        return { valid: false, error: 'Source gateway is required' };
      }

      if (!message.destinationGateway || message.destinationGateway.trim() === '') {
        return { valid: false, error: 'Destination gateway is required' };
      }

      // Validate payload
      if (!message.payload || message.payload.trim() === '') {
        return { valid: false, error: 'Payload is required' };
      }

      // Validate payload hash
      if (!message.payloadHash || message.payloadHash.trim() === '') {
        return { valid: false, error: 'Payload hash is required' };
      }

      // Validate nonce
      if (typeof message.nonce !== 'number' || message.nonce < 0) {
        return { valid: false, error: 'Nonce must be a non-negative number' };
      }

      return { valid: true };
    } catch (error) {
      logger.error({ error, message }, 'Error validating relay message');
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error',
      };
    }
  }

  /**
   * Validate and throw if invalid
   */
  static validateOrThrow(message: RelayMessage): void {
    const result = this.validate(message);
    if (!result.valid) {
      throw new Error(`Invalid relay message: ${result.error}`);
    }
  }
}
