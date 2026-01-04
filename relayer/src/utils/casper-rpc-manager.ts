import { RpcClient, HttpHandler } from 'casper-js-sdk';
import { logger } from './logger';

export interface RpcEndpoint {
  url: string;
  apiKey?: string;
}

/**
 * Manager for Casper RPC clients with rotation and fallback on rate limits/errors
 */
export class CasperRpcManager {
  private endpoints: RpcEndpoint[];
  private currentIndex: number = 0;
  private failedEndpoints: Set<number> = new Set();
  private resetInterval: NodeJS.Timeout | null = null;
  private readonly RESET_INTERVAL_MS = 5 * 60 * 1000; // Reset failed endpoints after 5 minutes

  constructor(endpoints: RpcEndpoint[]) {
    if (endpoints.length === 0) {
      throw new Error('At least one RPC endpoint is required');
    }
    this.endpoints = endpoints;
    
    // Reset failed endpoints periodically
    this.resetInterval = setInterval(() => {
      if (this.failedEndpoints.size > 0) {
        logger.info(
          { failedCount: this.failedEndpoints.size },
          'Resetting failed RPC endpoints, will retry'
        );
        this.failedEndpoints.clear();
      }
    }, this.RESET_INTERVAL_MS);
  }

  /**
   * Get the current RPC endpoint
   */
  private getCurrentEndpoint(): RpcEndpoint {
    return this.endpoints[this.currentIndex];
  }

  /**
   * Check if an endpoint is available (not failed)
   */
  private isEndpointAvailable(index: number): boolean {
    return !this.failedEndpoints.has(index);
  }

  /**
   * Get the next available endpoint
   */
  private getNextAvailableEndpoint(): RpcEndpoint | null {
    const startIndex = this.currentIndex;
    let attempts = 0;
    
    while (attempts < this.endpoints.length) {
      const index = (this.currentIndex + attempts) % this.endpoints.length;
      
      if (this.isEndpointAvailable(index)) {
        this.currentIndex = index;
        return this.endpoints[index];
      }
      
      attempts++;
    }
    
    // If all endpoints failed, reset and use current
    logger.warn('All RPC endpoints have failed, resetting and using current endpoint');
    this.failedEndpoints.clear();
    return this.endpoints[this.currentIndex];
  }

  /**
   * Mark current endpoint as failed and rotate to next
   */
  private markFailedAndRotate(): void {
    logger.warn(
      {
        failedEndpoint: this.currentIndex,
        url: this.getCurrentEndpoint().url.substring(0, 50) + '...',
      },
      'RPC endpoint failed, rotating to next'
    );
    
    this.failedEndpoints.add(this.currentIndex);
    this.getNextAvailableEndpoint();
  }

  /**
   * Check if an error is rate limit related
   */
  private isRateLimitError(error: any): boolean {
    if (error?.statusCode === 429) {
      return true;
    }
    
    if (error?.status === 429) {
      return true;
    }
    
    const message = error?.message?.toLowerCase() || '';
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return true;
    }
    
    // Check for RPC error with rate limit code
    if (error?.error?.code === -32000 || error?.error?.message?.toLowerCase().includes('rate limit')) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if an error is retryable (network, timeout, rate limit)
   */
  private isRetryableError(error: any): boolean {
    // Rate limit errors
    if (this.isRateLimitError(error)) {
      return true;
    }
    
    // Network errors
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT' || error?.code === 'ENOTFOUND') {
      return true;
    }
    
    // HTTP 5xx errors
    if (error?.status >= 500 && error?.status < 600) {
      return true;
    }
    
    // Fetch network errors
    if (error?.message?.includes('fetch failed') || error?.message?.includes('network')) {
      return true;
    }
    
    return false;
  }

  /**
   * Create RPC client for current endpoint
   */
  createRpcClient(): RpcClient {
    const endpoint = this.getNextAvailableEndpoint();
    if (!endpoint) {
      throw new Error('No available RPC endpoints');
    }

    const httpHandler = new HttpHandler(endpoint.url);
    
    if (endpoint.apiKey) {
      httpHandler.setCustomHeaders({
        Authorization: endpoint.apiKey,
        'Content-Type': 'application/json',
      });
    }

    const rpcClient = new RpcClient(httpHandler);
    
    logger.debug(
      {
        endpointIndex: this.currentIndex,
        url: endpoint.url.substring(0, 50) + '...',
        hasApiKey: !!endpoint.apiKey,
      },
      'Created RPC client'
    );

    return rpcClient;
  }

  /**
   * Execute a function with automatic rotation on errors
   */
  async executeWithRotation<T>(
    fn: (rpcClient: RpcClient) => Promise<T>,
    options: { maxRetries?: number } = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries || this.endpoints.length;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const rpcClient = this.createRpcClient();
        return await fn(rpcClient);
      } catch (error: any) {
        lastError = error;
        
        if (this.isRetryableError(error)) {
          logger.warn(
            {
              attempt: attempt + 1,
              maxRetries,
              error: error.message || error,
              isRateLimit: this.isRateLimitError(error),
            },
            'RPC request failed, will retry with next endpoint'
          );
          
          this.markFailedAndRotate();
          
          // If not the last attempt, continue to next endpoint
          if (attempt < maxRetries - 1) {
            // Small delay before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
        
        // Non-retryable error or last attempt
        throw error;
      }
    }

    throw lastError || new Error('Failed to execute RPC request');
  }

  /**
   * Execute a fetch request with automatic rotation
   */
  async fetchWithRotation(
    requestBody: any,
    options: { maxRetries?: number } = {}
  ): Promise<Response> {
    const maxRetries = options.maxRetries || this.endpoints.length;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const endpoint = this.getNextAvailableEndpoint();
        if (!endpoint) {
          throw new Error('No available RPC endpoints');
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (endpoint.apiKey) {
          headers['Authorization'] = endpoint.apiKey;
        }

        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });

        // Check if response indicates rate limit
        if (response.status === 429) {
          const errorText = await response.text().catch(() => 'Rate limited');
          logger.warn(
            {
              endpointIndex: this.currentIndex,
              status: response.status,
            },
            'Rate limited, rotating to next endpoint'
          );
          
          this.markFailedAndRotate();
          
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          
          throw new Error(`Rate limited: ${errorText}`);
        }

        // Check for other retryable errors
        if (response.status >= 500 && response.status < 600) {
          const errorText = await response.text().catch(() => 'Server error');
          logger.warn(
            {
              endpointIndex: this.currentIndex,
              status: response.status,
            },
            'Server error, rotating to next endpoint'
          );
          
          this.markFailedAndRotate();
          
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          
          throw new Error(`Server error: ${errorText}`);
        }

        // Success or non-retryable error
        return response;
      } catch (error: any) {
        lastError = error;
        
        if (this.isRetryableError(error)) {
          logger.warn(
            {
              attempt: attempt + 1,
              maxRetries,
              error: error.message || error,
            },
            'Fetch failed, will retry with next endpoint'
          );
          
          this.markFailedAndRotate();
          
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
        
        throw error;
      }
    }

    throw lastError || new Error('Failed to execute fetch request');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
      this.resetInterval = null;
    }
  }

  /**
   * Get current endpoint info (for logging)
   */
  getCurrentEndpointInfo(): { index: number; url: string; hasApiKey: boolean } {
    const endpoint = this.getCurrentEndpoint();
    return {
      index: this.currentIndex,
      url: endpoint.url,
      hasApiKey: !!endpoint.apiKey,
    };
  }
}

