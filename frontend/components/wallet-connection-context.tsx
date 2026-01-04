"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { useCasperWallet } from "@/components/casper-wallet-provider"
import { useAccount } from "wagmi"

interface WalletConnectionState {
  fromNetwork: "casper" | "sepolia"
  toNetwork: "casper" | "sepolia"
  fromConnected: boolean
  toConnected: boolean
  fromAddress: string
  toAddress: string
  setFromNetwork: (network: "casper" | "sepolia") => void
  setToNetwork: (network: "casper" | "sepolia") => void
  setFromConnected: (connected: boolean) => void
  setToConnected: (connected: boolean) => void
  setFromAddress: (address: string) => void
  setToAddress: (address: string) => void
}

const WalletConnectionContext = createContext<WalletConnectionState | undefined>(undefined)

export function WalletConnectionProvider({ children }: { children: React.ReactNode }) {
  const [fromNetwork, setFromNetwork] = useState<"casper" | "sepolia">("casper")
  const [toNetwork, setToNetwork] = useState<"casper" | "sepolia">("sepolia")
  const [fromConnected, setFromConnected] = useState(false)
  const [toConnected, setToConnected] = useState(false)
  const [fromAddress, setFromAddress] = useState<string>("")
  const [toAddress, setToAddress] = useState<string>("")

  const casperWallet = useCasperWallet()
  const { address: evmAddress, isConnected: isEVMConnected } = useAccount()

  // Sync Casper wallet state
  useEffect(() => {
    if (casperWallet.isConnected && casperWallet.publicKey) {
      if (fromNetwork === "casper" && !fromConnected) {
        setFromConnected(true)
        setFromAddress(casperWallet.publicKey)
      }
      if (toNetwork === "casper" && !toConnected) {
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
  }, [casperWallet.isConnected, casperWallet.publicKey, fromNetwork, toNetwork, fromConnected, toConnected])

  // Sync EVM wallet state
  useEffect(() => {
    if (isEVMConnected && evmAddress) {
      if (fromNetwork === "sepolia" && !fromConnected) {
        setFromConnected(true)
        setFromAddress(evmAddress)
      }
      if (toNetwork === "sepolia" && !toConnected) {
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
  }, [isEVMConnected, evmAddress, fromNetwork, toNetwork, fromConnected, toConnected])

  return (
    <WalletConnectionContext.Provider
      value={{
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
      }}
    >
      {children}
    </WalletConnectionContext.Provider>
  )
}

export function useWalletConnection() {
  const context = useContext(WalletConnectionContext)
  if (context === undefined) {
    throw new Error("useWalletConnection must be used within a WalletConnectionProvider")
  }
  return context
}

