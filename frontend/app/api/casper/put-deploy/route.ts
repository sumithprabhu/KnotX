import { NextRequest, NextResponse } from 'next/server'
import { fetchWithRotation } from '@/lib/casper-rpc-rotation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('Proxying deploy to Casper RPC with rotation')
    
    // Forward the RPC request to Casper node with rotation
    const response = await fetchWithRotation(body)

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

