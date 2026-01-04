import { RpcClient, HttpHandler } from 'casper-js-sdk'
import { getCasperRpcEndpoints, RpcEndpoint } from './casper-rpc-rotation'

/**
 * Create RPC client with rotation support
 * Tries endpoints in order until one works
 */
export async function executeWithRpcClientRotation<T>(
  fn: (rpcClient: RpcClient) => Promise<T>,
  endpoints: RpcEndpoint[] = getCasperRpcEndpoints()
): Promise<T> {
  if (endpoints.length === 0) {
    throw new Error('No RPC endpoints available')
  }

  let lastError: any = null

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i]
    
    try {
      const httpHandler = new HttpHandler(endpoint.url)
      
      if (endpoint.apiKey) {
        httpHandler.setCustomHeaders({
          Authorization: endpoint.apiKey,
          'Content-Type': 'application/json',
        })
      }

      const rpcClient = new RpcClient(httpHandler)
      
      return await fn(rpcClient)
    } catch (error: any) {
      lastError = error
      
      // Check if error is rate limit related
      const isRateLimit = 
        error?.statusCode === 429 ||
        error?.status === 429 ||
        error?.message?.toLowerCase().includes('rate limit') ||
        error?.message?.toLowerCase().includes('too many requests')
      
      // Check if error is network related
      const isNetworkError = 
        error?.code === 'ECONNREFUSED' ||
        error?.code === 'ETIMEDOUT' ||
        error?.message?.includes('fetch failed') ||
        error?.message?.includes('network')
      
      // Check for RPC error with rate limit code
      const isRpcRateLimit = 
        error?.error?.code === -32000 ||
        error?.error?.message?.toLowerCase().includes('rate limit')
      
      if ((isRateLimit || isNetworkError || isRpcRateLimit) && i < endpoints.length - 1) {
        console.warn(
          `RPC endpoint ${i + 1} failed, rotating to next: ${error.message || error}`
        )
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
      
      // If last endpoint or non-retryable error, throw
      if (i === endpoints.length - 1) {
        throw error
      }
    }
  }

  throw lastError || new Error('Failed to execute RPC request')
}

