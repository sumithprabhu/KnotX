import { NextRequest, NextResponse } from 'next/server'

// Use the same RPC endpoint as relayer (requires API key)
const CASPER_RPC_URL = process.env.CASPER_RPC_URL || 'https://node.testnet.cspr.cloud/rpc'
const CASPER_API_KEY = process.env.CASPER_API_KEY || '019b7cfa-8db3-7a21-89b3-e3a0bc3f3340' // Default test key from relayer

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Prepare headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    
    // Add API key if available (matching relayer format: direct API key, not Bearer token)
    if (CASPER_API_KEY) {
      headers['Authorization'] = CASPER_API_KEY
    }
    
    console.log('Proxying deploy to Casper RPC:', CASPER_RPC_URL)
    
    // Forward the RPC request to Casper node
    const response = await fetch(CASPER_RPC_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('RPC Error:', response.status, errorText)
      return NextResponse.json(
        { error: { message: `RPC request failed: ${response.statusText}`, details: errorText } },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error proxying deploy to Casper RPC:', error)
    return NextResponse.json(
      { error: { message: error.message || 'Failed to proxy deploy request' } },
      { status: 500 }
    )
  }
}

