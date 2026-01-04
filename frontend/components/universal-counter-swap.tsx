"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowDownUp, Wallet } from "lucide-react"
import { useCasperWallet } from "@/components/casper-wallet-provider"
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useWalletConnection } from "@/components/wallet-connection-context"
import { parseEther } from "viem"
import { motion } from "motion/react"
import { toast } from "sonner"
import { FaInfoCircle } from "react-icons/fa"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { 
  CLValue, 
  CLTypeList, 
  CLTypeUInt8,
  Args,
  ContractCallBuilder,
  PublicKey,
  CasperNetworkName,
  Deploy
} from "casper-js-sdk"

type Network = "casper" | "sepolia"

// Contract addresses from environment variables
const SEPOLIA_GATEWAY_ADDRESS = 
  process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_GATEWAY || 
  "0xe6F75A8E2d21EeFD33A5ecA76215bB20DbE0bb1F"
const CASPER_GATEWAY_HASH = 
  process.env.NEXT_PUBLIC_CASPER_GATEWAY || 
  "hash-4ce6b9ec80fde0158f7ab13f37cff883660048c1d457e9e48130cc884ce83073"

// Receiver addresses (gateway addresses of the "to" chain)
const SEPOLIA_RECEIVER_ADDRESS = 
  process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RECEIVER_ADDRESS || 
  "0xD3B1c72361f03d5F138C2c768AfdF700266bb39a"
const CASPER_RECEIVER_ADDRESS = 
  process.env.NEXT_PUBLIC_CASPER_TESTNET_RECEIVER_ADDRESS || 
  "hash-2ede3272d048e81c344c68f65db55141e1132d70da6443770ac0de443534d36e"

// RPC URLs
const SEPOLIA_RPC_URL = 
  process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_URL || 
  "https://sepolia.infura.io/v3/7b5f929ca303443fb2c9f2c29ee93a6b"
const CASPER_RPC_URL = 
  process.env.NEXT_PUBLIC_CASPER_TESTNET_RPC_URL || 
  "https://node.testnet.cspr.cloud/rpc"

// Chain IDs
const SEPOLIA_CHAIN_ID = 11155111 // Sepolia testnet
const CASPER_CHAIN_ID = 3 // Casper testnet

// Gateway ABI for EVM
const GATEWAY_ABI = [
  {
    inputs: [
      { internalType: "uint32", name: "dstChainId", type: "uint32" },
      { internalType: "bytes", name: "receiver", type: "bytes" },
      { internalType: "bytes", name: "payload", type: "bytes" },
    ],
    name: "sendMessage",
    outputs: [{ internalType: "bytes32", name: "messageId", type: "bytes32" }],
    stateMutability: "payable",
    type: "function",
  },
] as const

export function UniversalCounterSwap() {
  const {
    fromNetwork,
    toNetwork,
    fromConnected,
    toConnected,
    fromAddress,
    toAddress,
    setFromNetwork,
    setToNetwork,
    setFromConnected,
    setToConnected,
    setFromAddress,
    setToAddress,
  } = useWalletConnection()

  const casperWallet = useCasperWallet()
  
  // Rainbow Wallet Kit hooks for EVM
  const { address: evmAddress, isConnected: isEVMConnected } = useAccount()
  const { connect, connectors } = useConnect()

  // State for increase counter
  const [incrementValue, setIncrementValue] = useState("1")
  const [isLoading, setIsLoading] = useState(false)

  // Wagmi hooks for EVM contract interaction
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  // Handle successful transaction
  useEffect(() => {
    if (isSuccess) {
      setIsLoading(false)
      toast.success("Transaction successful! Message sent.")
      // Dispatch event to trigger fast polling in display component
      window.dispatchEvent(new CustomEvent('transaction-sent'))
    }
  }, [isSuccess])

  const handleFromChange = (network: Network) => {
    setFromNetwork(network)
    // Auto-swap to the other network
    setToNetwork(network === "casper" ? "sepolia" : "casper")
    // Reset connection state when network changes
    if (network === "sepolia") {
      setFromConnected(false)
      setFromAddress("")
    }
  }

  const handleToChange = (network: Network) => {
    setToNetwork(network)
    // Auto-swap from network
    setFromNetwork(network === "casper" ? "sepolia" : "casper")
    // Reset connection state when network changes
    if (network === "sepolia") {
      setToConnected(false)
      setToAddress("")
    }
  }

  const handleSwap = () => {
    // Swap the networks
    const tempFrom = fromNetwork
    const tempTo = toNetwork
    const tempFromConnected = fromConnected
    const tempToConnected = toConnected
    const tempFromAddress = fromAddress
    const tempToAddress = toAddress

    setFromNetwork(tempTo)
    setToNetwork(tempFrom)
    setFromConnected(tempToConnected)
    setToConnected(tempFromConnected)
    setFromAddress(tempToAddress)
    setToAddress(tempFromAddress)
  }

  const handleFromConnect = async () => {
    console.log("handleFromConnect called", { fromNetwork })
    
    if (fromNetwork === "sepolia") {
      // Connect EVM wallet using Rainbow Wallet Kit
      if (isEVMConnected && evmAddress) {
        setFromConnected(true)
        setFromAddress(evmAddress)
        return
      }
      
      // Open Rainbow Wallet Kit modal
      const injectedConnector = connectors.find(c => c.id === "injected" || c.id === "metaMask")
      if (injectedConnector) {
        connect({ connector: injectedConnector })
      } else {
        // Fallback: use ConnectButton programmatically
        toast.info("Please use the Connect Wallet button to connect your EVM wallet")
      }
    } else {
      // Connect Casper Wallet directly
      if (!casperWallet.isAvailable) {
        toast.error("Casper Wallet extension not found. Please install the Casper Wallet browser extension, refresh the page, and make sure the extension is enabled.")
        return
      }
      
      try {
        // Check if already connected
        if (casperWallet.isConnected && casperWallet.publicKey) {
          setFromConnected(true)
          setFromAddress(casperWallet.publicKey)
          return
        }
        
        // Trigger sign in (similar to CSPR.click signIn)
        console.log("Calling casperWallet.signIn()...")
        await casperWallet.signIn()
        
        // State will be updated via useEffect
      } catch (error: any) {
        console.error("Failed to connect Casper Wallet:", error)
        toast.error(`Failed to connect: ${error.message || error}`)
      }
    }
  }

  const handleToConnect = async () => {
    console.log("handleToConnect called", { toNetwork })
    
    if (toNetwork === "sepolia") {
      // Connect EVM wallet using Rainbow Wallet Kit
      if (isEVMConnected && evmAddress) {
        setToConnected(true)
        setToAddress(evmAddress)
        return
      }
      
      // Open Rainbow Wallet Kit modal
      const injectedConnector = connectors.find(c => c.id === "injected" || c.id === "metaMask")
      if (injectedConnector) {
        connect({ connector: injectedConnector })
      } else {
        // Fallback: use ConnectButton programmatically
        toast.info("Please use the Connect Wallet button to connect your EVM wallet")
      }
    } else {
      // Connect Casper Wallet directly
      if (!casperWallet.isAvailable) {
        toast.error("Casper Wallet extension not found. Please install the Casper Wallet browser extension, refresh the page, and make sure the extension is enabled.")
        return
      }
      
      try {
        // Check if already connected
        if (casperWallet.isConnected && casperWallet.publicKey) {
          setToConnected(true)
          setToAddress(casperWallet.publicKey)
          return
        }
        
        // Trigger sign in (similar to CSPR.click signIn)
        console.log("Calling casperWallet.signIn()...")
        await casperWallet.signIn()
        
        // State will be updated via useEffect
      } catch (error: any) {
        console.error("Failed to connect Casper Wallet:", error)
        toast.error(`Failed to connect: ${error.message || error}`)
      }
    }
  }

  const handleIncrease = async () => {
    if (!fromConnected || !toConnected) {
      toast.warning("Please connect both wallets first")
      return
    }

    const value = parseInt(incrementValue)
    if (isNaN(value) || value <= 0) {
      toast.warning("Please enter a valid positive number")
      return
    }

    setIsLoading(true)

    try {
      if (fromNetwork === "sepolia") {
        // EVM: Call sendMessage using wagmi
        const dstChainId = toNetwork === "casper" ? CASPER_CHAIN_ID : SEPOLIA_CHAIN_ID
        
        // Encode receiver address (gateway address of the "to" chain)
        let receiver: `0x${string}`
        if (toNetwork === "casper") {
          // For Casper, receiver is the gateway contract hash as bytes (32 bytes)
          // Remove "hash-" prefix and convert to bytes
          const hashHex = CASPER_RECEIVER_ADDRESS.replace("hash-", "")
          receiver = ("0x" + hashHex) as `0x${string}`
        } else {
          // For EVM, receiver is the gateway address as bytes (20 bytes)
          receiver = SEPOLIA_RECEIVER_ADDRESS as `0x${string}`
        }

        // Encode payload (the increment value)
        const payload = new TextEncoder().encode(value.toString())
        const payloadHex = "0x" + Array.from(payload).map(b => b.toString(16).padStart(2, "0")).join("") as `0x${string}`

        // Call sendMessage with base fee (0.001 ETH for example)
        writeContract({
          address: SEPOLIA_GATEWAY_ADDRESS as `0x${string}`,
          abi: GATEWAY_ABI,
          functionName: "sendMessage",
          args: [dstChainId, receiver, payloadHex],
          value: parseEther("0.001"), // Base fee
        })
      } else {
        // Casper: Call send_message using Casper Wallet
        if (!casperWallet.isConnected || !casperWallet.publicKey) {
          toast.error("Casper wallet not connected")
          setIsLoading(false)
          return
        }

        const dstChainId = toNetwork === "sepolia" ? SEPOLIA_CHAIN_ID : CASPER_CHAIN_ID
        
        // Encode receiver (gateway address of the "to" chain)
        // IMPORTANT: Match the relayer script exactly - EVM addresses must be padded to 32 bytes!
        let receiverBytes: Uint8Array
        if (toNetwork === "sepolia") {
          // For EVM, receiver is the gateway address as bytes (20 bytes) - PAD TO 32 BYTES!
          // This matches the relayer script: RECEIVER = new Uint8Array(32); RECEIVER.set(receiverBytes, 0);
          // const addressHex = SEPOLIA_RECEIVER_ADDRESS.replace("0x", "")
          const addressHex = "D3B1c72361f03d5F138C2c768AfdF700266bb39a"
          const addressBytes = Buffer.from(addressHex, "hex") // 20 bytes
          receiverBytes = new Uint8Array(32) // Create 32-byte array
          receiverBytes.set(addressBytes, 0) // Copy 20 bytes at start, remaining 12 bytes stay as 0
        } else {
          // For Casper, receiver is the gateway contract hash (32 bytes)
          // Remove "hash-" prefix and convert to bytes
          const hashHex = CASPER_RECEIVER_ADDRESS.replace("hash-", "").trim()
          receiverBytes = new Uint8Array(Buffer.from(hashHex, "hex"))
        }
        
        console.log("🔍 Receiver encoding:", {
          toNetwork,
          receiverLength: receiverBytes.length,
          receiverHex: Buffer.from(receiverBytes).toString('hex'),
          expectedLength: toNetwork === "sepolia" ? 32 : 32
        })

        // Encode payload (the increment value)
        const payloadBytes = new TextEncoder().encode(value.toString())

        // Parse contract hash (remove 'hash-' prefix)
        const contractHashStr = CASPER_GATEWAY_HASH.replace('hash-', '')
        console.log("🔍 Contract hash:", contractHashStr)
        
        if (contractHashStr.length !== 64) {
          throw new Error(`Invalid contract hash length: expected 64 hex chars, got ${contractHashStr.length}`)
        }

        // ============================================
        // STEP 1: BUILD RUNTIME ARGUMENTS
        // ============================================
        // MATCHING PLAYGROUND EXACTLY: Build CLValues and pass to Args.fromMap
        // Playground pattern (utils.ts line 184-191): Simple and direct
        // For List<U8>, we need to pass CLTypeUInt8 directly, not wrapped in CLTypeList
        const receiverList = Array.from(receiverBytes).map(byte => CLValue.newCLUint8(byte))
        const payloadList = Array.from(payloadBytes).map(byte => CLValue.newCLUint8(byte))
        
        const runtimeArgs = Args.fromMap({
          dst_chain_id: CLValue.newCLUInt32(dstChainId),
          receiver: CLValue.newCLList(CLTypeUInt8, receiverList),
          payload: CLValue.newCLList(CLTypeUInt8, payloadList),
        })
        
        // Debug: Show actual values
        console.log("🔍 Runtime arguments values:")
        console.log("  - dst_chain_id:", dstChainId, "(U32)")
        console.log("  - receiver bytes:", Array.from(receiverBytes), `(${receiverBytes.length} bytes)`)
        console.log("  - receiver list length:", receiverList.length, "elements")
        console.log("  - payload bytes:", Array.from(payloadBytes), `(${payloadBytes.length} bytes)`)
        console.log("  - payload list length:", payloadList.length, "elements")
        console.log("  - payload value:", value)
        // ============================================
        // STEP 2: BUILD TRANSACTION
        // ============================================
        // MATCHING PLAYGROUND DEPLOY SIGNATURE APPROACH (App.tsx line 466):
        // const tx = makeUnknownContractBuilder(signingKey).buildFor1_5();
        // const deploy = tx.getDeploy();
        // handleSignDeploy(signingKey, deploy);
        // 
        // handleSignDeploy uses: Deploy.toJSON() (not Transaction.toJSON!)
        const publicKey = PublicKey.fromHex(casperWallet.publicKey)

        const transaction = new ContractCallBuilder()
          .from(publicKey)
          .byHash(contractHashStr)
          .entryPoint('send_message')
          .runtimeArgs(runtimeArgs)
          .payment(3_000_000_000)
          .chainName(CasperNetworkName.Testnet)
          .buildFor1_5()  // Use .buildFor1_5() to get Deploy (matching deploy signature scenario)

        // ============================================
        // STEP 3: GET DEPLOY FROM TRANSACTION
        // ============================================
        // MATCHING PLAYGROUND (App.tsx line 468):
        // const deploy = tx.getDeploy();
        const deploy = transaction.getDeploy()
        if (!deploy) {
          throw new Error("Failed to build deploy")
        }

        // Get deploy hash BEFORE signing (for verification)
        const deployHashBeforeSign = deploy.hash
        console.log("🔍 Deploy hash BEFORE signing:", deployHashBeforeSign)

        // ============================================
        // STEP 4: CONVERT DEPLOY TO JSON
        // ============================================
        // MATCHING PLAYGROUND EXACTLY (App.tsx line 80):
        // const deployJson = Deploy.toJSON(deploy);
        // sign(JSON.stringify(deployJson), accountPublicKey)
        const deployJson = Deploy.toJSON(deploy)
        
        // Verify deploy hash in JSON matches
        if (deployJson && typeof deployJson === 'object') {
          const deployObj = deployJson as any
          console.log("🔍 Deploy hash in JSON:", deployObj.hash)
          if (deployObj.hash !== deployHashBeforeSign) {
            console.warn("⚠️ WARNING: Deploy hash mismatch!")
          }
        }
        
        // Debug: Verify deploy JSON structure (matching playground output)
        console.log("🔍 Deploy JSON structure:")
        if (deployJson && typeof deployJson === 'object') {
          const deployObj = deployJson as any
          console.log("  - Has 'hash'?", 'hash' in deployObj)
          console.log("  - Has 'header'?", 'header' in deployObj)
          console.log("  - Has 'payment'?", 'payment' in deployObj)
          console.log("  - Has 'session'?", 'session' in deployObj)
          if ('session' in deployObj) {
            console.log("  - Session type:", Object.keys(deployObj.session)[0])
            if (deployObj.session.StoredContractByHash) {
              console.log("  - Contract hash:", deployObj.session.StoredContractByHash.hash)
              console.log("  - Entry point:", deployObj.session.StoredContractByHash.entry_point)
              console.log("  - Args count:", deployObj.session.StoredContractByHash.args?.length || 0)
            } else if (deployObj.session.StoredVersionedContractByHash) {
              console.log("  - Contract hash:", deployObj.session.StoredVersionedContractByHash.hash)
              console.log("  - Entry point:", deployObj.session.StoredVersionedContractByHash.entry_point)
              console.log("  - Args count:", deployObj.session.StoredVersionedContractByHash.args?.length || 0)
            }
          }
        }
        console.log("🔍 Full Deploy JSON:", JSON.stringify(deployJson, null, 2))
        
        // ============================================
        // STEP 5: SIGN WITH WALLET
        // ============================================
        // MATCHING PLAYGROUND EXACTLY (App.tsx line 82):
        // sign(JSON.stringify(deployJson), accountPublicKey)
        // The wallet expects the deploy JSON - it will validate the structure
        try {
          // Deploy.toJSON() already returns the correct format with empty approvals array
          // Just stringify it directly (matching playground)
          const deployJsonString = JSON.stringify(deployJson)
          console.log("🔍 Deploy JSON string length:", deployJsonString.length)
          console.log("🔍 Deploy JSON for signing (first 500 chars):", deployJsonString.substring(0, 500))
          const signedResult = await casperWallet.sign(deployJsonString, casperWallet.publicKey)
          
          if (signedResult.cancelled) {
            toast.info('Sign cancelled')
            setIsLoading(false)
            return
          }

          if (!signedResult || !signedResult.signature) {
            throw new Error("Failed to sign deploy - wallet returned invalid result")
          }

          // CRITICAL: Casper Wallet returns only the raw 64-byte signature (128 hex chars)
          // We MUST prepend the tag byte based on the public key algorithm:
          // - Public key starting with "01" → Ed25519 → tag "01"
          // - Public key starting with "02" → Secp256k1 → tag "02"
          // The signature must be 65 bytes (130 hex chars) total
          console.log("🔍 Wallet signature (raw):", signedResult.signature, "type:", typeof signedResult.signature, "length:", signedResult.signature?.length)
          console.log("🔍 Public key:", casperWallet.publicKey, "prefix:", casperWallet.publicKey.substring(0, 2))
          
          // Determine tag byte based on public key prefix
          const publicKeyPrefix = casperWallet.publicKey.substring(0, 2)
          const tagByte = publicKeyPrefix === "01" ? "01" : publicKeyPrefix === "02" ? "02" : "01" // Default to Ed25519
          console.log("🔍 Determined tag byte:", tagByte, "(01=Ed25519, 02=Secp256k1)")
          
          // Get raw signature as hex string
          let rawSignatureHex: string
          if (signedResult.signature instanceof Uint8Array) {
            // Convert Uint8Array to hex string using Buffer
            rawSignatureHex = Buffer.from(signedResult.signature).toString('hex')
            console.log("🔍 Converted Uint8Array signature to hex, length:", rawSignatureHex.length, "chars")
          } else if (typeof signedResult.signature === 'string') {
            rawSignatureHex = signedResult.signature.startsWith('0x') ? signedResult.signature.slice(2) : signedResult.signature
            console.log("🔍 Using string signature as hex, length:", rawSignatureHex.length, "chars")
          } else {
            throw new Error(`Unexpected signature format: ${typeof signedResult.signature}`)
          }
          
          // Verify signature is 128 hex chars (64 bytes)
          if (rawSignatureHex.length !== 128) {
            throw new Error(`Invalid signature length: expected 128 hex chars (64 bytes), got ${rawSignatureHex.length}`)
          }
          
          // Prepend tag byte to make it 130 hex chars (65 bytes)
          const finalSignatureHex = tagByte + rawSignatureHex
          console.log("🔍 Final signature with tag:", finalSignatureHex.substring(0, 10) + "...", "length:", finalSignatureHex.length, "chars (65 bytes)")
          
          // Convert to Uint8Array for Deploy.setSignature
          const signatureBytes = new Uint8Array(Buffer.from(finalSignatureHex, 'hex'))
          console.log("🔍 Signature as Uint8Array, length:", signatureBytes.length, "bytes, first byte:", signatureBytes[0])
          
          // MATCHING PLAYGROUND (App.tsx line 119-123):
          // Deploy.setSignature(deploy, res.signature, PublicKey.fromHex(accountPublicKey))
          // But we need to add tag byte manually since wallet returns raw signature
          const signedDeploy = Deploy.setSignature(
            deploy,
            signatureBytes,  // 65 bytes with tag byte prepended
            publicKey
          )
          console.log("🔍 Deploy.setSignature completed")

          // Convert signed deploy to JSON format for RPC (RPC expects JSON, not Deploy object)
          const signedDeployJson = Deploy.toJSON(signedDeploy)
          console.log("🔍 Signed deploy JSON:", JSON.stringify(signedDeployJson, null, 2))
          
          // Verify signature in JSON has tag byte
          if (signedDeployJson && typeof signedDeployJson === 'object') {
            const deployObj = signedDeployJson as any
            if (deployObj.approvals && deployObj.approvals.length > 0) {
              const sig = deployObj.approvals[0].signature
              console.log("🔍 Signature in deploy JSON:", sig, "length:", sig.length)
              if (sig.length === 128) {
                console.error("❌ ERROR: Signature still missing tag byte! Expected 130 hex chars, got 128")
              }
            }
          }

          // Send deploy to Casper network using RPC via Next.js API route (to avoid CORS)
          // MATCHING RELAYER FORMAT (send_deploy.json): params is an object with "deploy" key
          const response = await fetch('/api/casper/put-deploy', {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "account_put_deploy",
              params: {
                deploy: signedDeployJson  // RPC expects object with "deploy" key, not array
              }
            }),
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error("❌ RPC Error Response:", errorText)
            throw new Error(`RPC request failed: ${response.statusText}`)
          }

          const result = await response.json()
          
          if (result.error) {
            console.error("❌ RPC Error:", result.error)
            throw new Error(result.error.message || "Failed to send deploy")
          }

          const deployHash = result.result?.deploy_hash
          toast.success(`Transaction sent! Deploy hash: ${deployHash}`)
          // Dispatch event to trigger fast polling in display component
          window.dispatchEvent(new CustomEvent('transaction-sent'))
        } catch (signError: any) {
          console.error("❌ Failed to sign or send deploy:", signError)
          toast.error(`Failed to sign or send transaction: ${signError.message || signError}`)
        }
        
        setIsLoading(false)
      }
    } catch (error: any) {
      console.error("Failed to send message:", error)
      toast.error(`Failed to send message: ${error.message || error}`)
      setIsLoading(false)
    }
  }

  const bothWalletsConnected = fromConnected && toConnected

  return (
    <div className="w-full max-w-md mx-auto bg-background/80 backdrop-blur-sm border border-border rounded-2xl p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Universal Counter</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <FaInfoCircle className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm bg-black text-white border border-gray-700">
              <div className="space-y-2">
                <h4 className="font-semibold text-base mb-2">How Universal Counter Works</h4>
                <div className="space-y-1.5 text-sm">
                  <p className="text-gray-300">
                    <span className="font-medium text-white">Source Chain:</span> Your transaction originates here. When you submit, it sends a message to the gateway contract.
                  </p>
                  <p className="text-gray-300">
                    <span className="font-medium text-white">Destination Chain:</span> The counter increments on this chain. The relayer listens for messages and executes the increment.
                  </p>
                  <p className="text-gray-300 mt-2 pt-2 border-t border-gray-700">
                    <span className="font-medium text-white">Flow:</span> Source → Gateway → Relayer → Destination Counter
                  </p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      {/* Source Network */}
      <div className="space-y-3 mb-4">
        <label className="text-sm font-medium text-muted-foreground">Source</label>
        <div className="relative">
          <select
            value={fromNetwork}
            onChange={(e) => handleFromChange(e.target.value as Network)}
            className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground appearance-none cursor-pointer hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="casper">Casper Testnet</option>
            <option value="sepolia">Sepolia</option>
          </select>
          <ArrowDownUp className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        </div>
        {fromNetwork === "sepolia" ? (
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, mounted }) => {
              const ready = mounted
              const connected = ready && account && chain

              if (connected && account) {
                return (
                  <Button
                    className="w-full bg-green-500/20 text-green-400 border border-green-500/30 cursor-pointer"
                    disabled
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    {account.address ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : "Connected"}
                  </Button>
                )
              }

              return (
                <Button
                  onClick={openConnectModal}
                  className="w-full bg-[#6efcd9] text-black hover:bg-[#5ee8c9] font-medium cursor-pointer"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect EVM Wallet
                </Button>
              )
            }}
          </ConnectButton.Custom>
        ) : (
          <Button
            onClick={handleFromConnect}
            className={`w-full cursor-pointer ${
              fromConnected
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-[#6efcd9] text-black hover:bg-[#5ee8c9] font-medium"
            }`}
          >
            <Wallet className="w-4 h-4 mr-2" />
            {fromConnected 
              ? fromAddress 
                ? `${fromAddress.slice(0, 6)}...${fromAddress.slice(-4)}`
                : "Connected"
              : !casperWallet.isAvailable
                ? "Wallet Not Found"
                : "Connect Casper Wallet"}
          </Button>
        )}
      </div>

      {/* Swap Arrow */}
      <div className="flex justify-center my-4">
        <button
          onClick={handleSwap}
          className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center hover:bg-primary/30 hover:border-primary/50 transition-colors cursor-pointer"
          aria-label="Swap networks"
        >
          <ArrowDownUp className="w-5 h-5 text-primary" />
        </button>
      </div>

      {/* Destination Network */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-muted-foreground">Destination</label>
        <div className="relative">
          <select
            value={toNetwork}
            onChange={(e) => handleToChange(e.target.value as Network)}
            className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground appearance-none cursor-pointer hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="casper">Casper Testnet</option>
            <option value="sepolia">Sepolia</option>
          </select>
          <ArrowDownUp className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        </div>
        {toNetwork === "sepolia" ? (
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, mounted }) => {
              const ready = mounted
              const connected = ready && account && chain

              if (connected && account) {
                return (
                  <Button
                    className="w-full bg-green-500/20 text-green-400 border border-green-500/30 cursor-pointer"
                    disabled
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    {account.address ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : "Connected"}
                  </Button>
                )
              }

              return (
                <Button
                  onClick={openConnectModal}
                  className="w-full bg-[#6efcd9] text-black hover:bg-[#5ee8c9] font-medium cursor-pointer"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect EVM Wallet
                </Button>
              )
            }}
          </ConnectButton.Custom>
        ) : (
          <Button
            onClick={handleToConnect}
            className={`w-full cursor-pointer ${
              toConnected
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-[#6efcd9] text-black hover:bg-[#5ee8c9] font-medium"
            }`}
          >
            <Wallet className="w-4 h-4 mr-2" />
            {toConnected 
              ? toAddress 
                ? `${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`
                : "Connected"
              : !casperWallet.isAvailable
                ? "Wallet Not Found"
                : "Connect Casper Wallet"}
          </Button>
        )}
      </div>

      {/* Increase Counter Section - Only show when both wallets are connected */}
      {bothWalletsConnected && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 pt-6 border-t border-border"
        >
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Increase Counter by
              </label>
              <Input
                type="number"
                min="1"
                value={incrementValue}
                onChange={(e) => setIncrementValue(e.target.value)}
                placeholder="1"
                className="w-full"
              />
            </div>
            <Button
              onClick={handleIncrease}
              disabled={isLoading || isPending || isConfirming}
              className="bg-[#6efcd9] text-black hover:bg-[#5ee8c9] font-medium min-w-[120px]"
            >
              {isLoading || isPending || isConfirming ? "Processing..." : "Increase"}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

