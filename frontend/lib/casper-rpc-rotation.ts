/**
 * RPC endpoint rotation utility for frontend
 * Supports multiple RPC URLs and API keys with automatic fallback
 */

export interface RpcEndpoint {
  url: string;
  apiKey?: string;
}

/**
 * Get Casper RPC endpoints from environment variables
 * Supports comma-separated URLs and API keys
 */
export function getCasperRpcEndpoints(): RpcEndpoint[] {
  const defaultUrl = 'https://node.testnet.cspr.cloud/rpc';
  
  // Parse comma-separated values
  const parseArray = (value: string | undefined): string[] => {
    if (!value) return [];
    return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
  };
  
  const urls = parseArray(
    process.env.CASPER_RPC_URLS || 
    process.env.CASPER_TESTNET_RPC_URLS ||
    process.env.CASPER_RPC_URL ||
    process.env.NEXT_PUBLIC_CASPER_TESTNET_RPC_URL
  );
  
  const apiKeys = parseArray(
    process.env.CASPER_API_KEYS ||
    process.env.CASPER_API_KEY
  );
  
  const endpoints: RpcEndpoint[] = [];
  
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
        apiKey: process.env.CASPER_API_KEY || process.env.NEXT_PUBLIC_CASPER_API_KEY,
      });
    }
    return endpoints;
  }
  
  // If we have URLs but no keys, use URLs with optional single key
  if (apiKeys.length === 0) {
    urls.forEach(url => {
      endpoints.push({
        url: url,
        apiKey: process.env.CASPER_API_KEY || process.env.NEXT_PUBLIC_CASPER_API_KEY,
      });
    });
    return endpoints;
  }
  
  // If we have both URLs and keys, pair them
  const maxLength = Math.max(urls.length, apiKeys.length);
  for (let i = 0; i < maxLength; i++) {
    endpoints.push({
      url: urls[i % urls.length],
      apiKey: apiKeys[i % apiKeys.length] || apiKeys[apiKeys.length - 1],
    });
  }
  
  return endpoints;
}

/**
 * Execute fetch with rotation on errors
 */
export async function fetchWithRotation(
  requestBody: any,
  endpoints: RpcEndpoint[] = getCasperRpcEndpoints()
): Promise<Response> {
  if (endpoints.length === 0) {
    throw new Error('No RPC endpoints available');
  }

  let lastError: any = null;

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    
    try {
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

      // Check if response indicates rate limit or server error
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        const errorText = await response.text().catch(() => 'Rate limited or server error');
        
        // If not the last endpoint, try next one
        if (i < endpoints.length - 1) {
          console.warn(
            `RPC endpoint ${i + 1} failed (${response.status}), rotating to next endpoint`
          );
          await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay
          continue;
        }
        
        throw new Error(`${response.status}: ${errorText.substring(0, 100)}`);
      }

      // Success or non-retryable error
      return response;
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a network error (retryable)
      const isNetworkError = 
        error.message?.includes('fetch failed') ||
        error.message?.includes('network') ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT';
      
      if (isNetworkError && i < endpoints.length - 1) {
        console.warn(
          `RPC endpoint ${i + 1} network error, rotating to next endpoint: ${error.message}`
        );
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      // If last endpoint or non-retryable error, throw
      if (i === endpoints.length - 1) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Failed to execute fetch request');
}

