import { NextRequest, NextResponse } from "next/server"
import { executeWithRpcClientRotation } from "@/lib/casper-rpc-client-rotation"

// Named key for counter in Casper contract
const KEY_COUNTER = "count"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contractHash } = body

    if (!contractHash) {
      return NextResponse.json(
        { error: "Missing contractHash parameter" },
        { status: 400 }
      )
    }

    // MATCHING RELAYER SCRIPT EXACTLY (read-counter-casper.ts line 57):
    // const queryResult = await rpcClient.queryLatestGlobalState(CONTRACT_HASH, [KEY_COUNTER]);
    // CONTRACT_HASH = 'hash-2ede3272d048e81c344c68f65db55141e1132d70da6443770ac0de443534d36e'
    // The relayer passes it WITH "hash-" prefix, so we should keep it
    
    // Query the counter from contract state with rotation
    console.log("🔍 Querying counter from contract:", contractHash, "key:", KEY_COUNTER)
    const queryResult = await executeWithRpcClientRotation(async (rpcClient) => {
      return await rpcClient.queryLatestGlobalState(contractHash, [KEY_COUNTER])
    })
    console.log("🔍 Query result received:", queryResult ? "success" : "failed")

    // Parse the counter value
    let counter: number | null = null

    if (queryResult.storedValue?.clValue) {
      const clValue = queryResult.storedValue.clValue
      
      // The counter is stored as U64
      if (clValue.ui64 !== undefined) {
        counter = Number(clValue.ui64)
      } else {
        // Try parsing from bytes
        const bytes = clValue.bytes()
        if (bytes && bytes.length >= 8) {
          // Convert to BigInt (big-endian)
          let counterValue = BigInt(0)
          for (let i = 0; i < 8; i++) {
            counterValue = (counterValue << BigInt(8)) | BigInt(bytes[i])
          }
          counter = Number(counterValue)
        }
      }
    }

    // Try raw JSON parsing if not found yet
    if (counter === null && queryResult.rawJSON) {
      const raw = typeof queryResult.rawJSON === 'string' 
        ? JSON.parse(queryResult.rawJSON) 
        : queryResult.rawJSON
      
      const storedValue = raw?.stored_value
      if (storedValue?.CLValue) {
        const clValue = storedValue.CLValue
        const bytes = clValue.bytes
        
        if (bytes && typeof bytes === 'string') {
          // Convert hex string to Uint8Array
          const bytesArray = new Uint8Array(bytes.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [])
          if (bytesArray.length >= 8) {
            // Convert to BigInt (big-endian)
            let counterValue = BigInt(0)
            for (let i = 0; i < 8; i++) {
              counterValue = (counterValue << BigInt(8)) | BigInt(bytesArray[i])
            }
            counter = Number(counterValue)
          }
        } else if (Array.isArray(bytes)) {
          const bytesArray = new Uint8Array(bytes)
          if (bytesArray.length >= 8) {
            // Convert to BigInt (big-endian)
            let counterValue = BigInt(0)
            for (let i = 0; i < 8; i++) {
              counterValue = (counterValue << BigInt(8)) | BigInt(bytesArray[i])
            }
            counter = Number(counterValue)
          }
        }
      }
    }

    if (counter === null) {
      return NextResponse.json(
        { error: "Counter not found in contract state" },
        { status: 404 }
      )
    }

    return NextResponse.json({ counter })
  } catch (error: any) {
    console.error("❌ Error querying Casper counter:", error)
    // Log more details about the error
    if (error.code) {
      console.error("Error code:", error.code)
    }
    if (error.err) {
      console.error("Error details:", error.err)
    }
    if (error.message) {
      console.error("Error message:", error.message)
    }
    return NextResponse.json(
      { 
        error: error.message || "Failed to query counter",
        code: error.code,
        err: error.err,
      },
      { status: 500 }
    )
  }
}

