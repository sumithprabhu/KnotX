"use client"

import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider, createConfig, http } from "wagmi"
import { sepolia } from "wagmi/chains"
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit"
import "@rainbow-me/rainbowkit/styles.css"

// Configure chains & providers
// Note: projectId is optional for local development, but required for WalletConnect
const config = getDefaultConfig({
  appName: "KnotX",
  projectId: "30bede5f518fc2c9a9900ada7ef88888",
  chains: [sepolia],
  ssr: true, // If your dApp uses server side rendering (SSR)
})

// Create a query client
const queryClient = new QueryClient()

export function RainbowWalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

