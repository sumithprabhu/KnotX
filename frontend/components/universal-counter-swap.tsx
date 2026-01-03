"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowDownUp, Wallet } from "lucide-react"
import { useCasperWallet } from "@/components/casper-wallet-provider"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"

type Network = "casper" | "sepolia"

export function UniversalCounterSwap() {
  const [fromNetwork, setFromNetwork] = useState<Network>("casper")
  const [toNetwork, setToNetwork] = useState<Network>("sepolia")
  const [fromConnected, setFromConnected] = useState(false)
  const [toConnected, setToConnected] = useState(false)
  const [fromAddress, setFromAddress] = useState<string>("")
  const [toAddress, setToAddress] = useState<string>("")

  const casperWallet = useCasperWallet()
  
  // Rainbow Wallet Kit hooks for EVM
  const { address: evmAddress, isConnected: isEVMConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect: disconnectEVM } = useDisconnect()

  // Listen for Casper Wallet connection events
  useEffect(() => {
    if (!casperWallet.isAvailable) return

    // Update connection state based on wallet state
    const updateConnectionState = () => {
      if (casperWallet.isConnected && casperWallet.publicKey) {
        if (fromNetwork === "casper") {
          setFromConnected(true)
          setFromAddress(casperWallet.publicKey)
        }
        if (toNetwork === "casper") {
          setToConnected(true)
          setToAddress(casperWallet.publicKey)
        }
      } else {
        if (fromNetwork === "casper") {
          setFromConnected(false)
          setFromAddress("")
        }
        if (toNetwork === "casper") {
          setToConnected(false)
          setToAddress("")
        }
      }
    }

    // Initial update
    updateConnectionState()

    // Update when connection state changes
    const interval = setInterval(updateConnectionState, 500)

    return () => {
      clearInterval(interval)
    }
  }, [casperWallet.isConnected, casperWallet.publicKey, casperWallet.isAvailable, fromNetwork, toNetwork])

  // Listen for EVM wallet connection events
  useEffect(() => {
    if (isEVMConnected && evmAddress) {
      if (fromNetwork === "sepolia") {
        setFromConnected(true)
        setFromAddress(evmAddress)
      }
      if (toNetwork === "sepolia") {
        setToConnected(true)
        setToAddress(evmAddress)
      }
    } else {
      if (fromNetwork === "sepolia") {
        setFromConnected(false)
        setFromAddress("")
      }
      if (toNetwork === "sepolia") {
        setToConnected(false)
        setToAddress("")
      }
    }
  }, [isEVMConnected, evmAddress, fromNetwork, toNetwork])

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
        alert("Please use the Connect Wallet button to connect your EVM wallet")
      }
    } else {
      // Connect Casper Wallet directly
      if (!casperWallet.isAvailable) {
        alert("⚠️ Casper Wallet extension not found.\n\nPlease:\n1. Install the Casper Wallet browser extension\n2. Refresh the page\n3. Make sure the extension is enabled")
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
        alert(`Failed to connect: ${error.message || error}`)
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
        alert("Please use the Connect Wallet button to connect your EVM wallet")
      }
    } else {
      // Connect Casper Wallet directly
      if (!casperWallet.isAvailable) {
        alert("⚠️ Casper Wallet extension not found.\n\nPlease:\n1. Install the Casper Wallet browser extension\n2. Refresh the page\n3. Make sure the extension is enabled")
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
        alert(`Failed to connect: ${error.message || error}`)
      }
    }
  }

  return (
    <div className="w-full max-w-md mx-auto bg-background/80 backdrop-blur-sm border border-border rounded-2xl p-6 shadow-2xl">
      <h2 className="text-2xl font-bold mb-6 text-foreground">Universal Counter</h2>
      
      {/* From Network */}
      <div className="space-y-3 mb-4">
        <label className="text-sm font-medium text-muted-foreground">From</label>
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
        <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          <ArrowDownUp className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* To Network */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-muted-foreground">To</label>
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
    </div>
  )
}

