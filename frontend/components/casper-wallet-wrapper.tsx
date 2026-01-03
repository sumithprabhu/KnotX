"use client"

import dynamic from "next/dynamic"
import React from "react"

// Dynamically import CasperWalletProvider with SSR disabled
const CasperWalletProvider = dynamic(
  () => import("./casper-wallet-provider").then(mod => ({ default: mod.CasperWalletProvider })),
  {
    ssr: false,
    loading: () => null
  }
)

export function CasperWalletWrapper({ children }: { children: React.ReactNode }) {
  return <CasperWalletProvider>{children}</CasperWalletProvider>
}

