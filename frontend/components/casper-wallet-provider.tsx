"use client"

import React, { useEffect, useState, useCallback } from "react"

// Casper Wallet Provider Type (from Casper Wallet extension)
interface CasperWalletProvider {
  requestConnection: () => Promise<boolean>
  disconnectFromSite: () => Promise<boolean>
  requestSwitchAccount: () => Promise<boolean>
  isConnected: () => Promise<boolean>
  getActivePublicKey: () => Promise<string | undefined>
  getVersion: () => Promise<string>
  getActivePublicKeySupports: () => Promise<string[] | string>
  sign: (deployJson: string, signingPublicKeyHex: string) => Promise<any>
  signMessage: (message: string, signingPublicKeyHex: string) => Promise<any>
}

// Account type similar to CSPR.click
interface AccountType {
  publicKey: string
  address?: string
  name?: string
}

// Context type
interface CasperWalletContextType {
  // Provider instance
  provider: CasperWalletProvider | null
  // Connection state
  isAvailable: boolean
  isConnected: boolean
  isUnlocked: boolean
  // Account info
  activeAccount: AccountType | null
  publicKey: string | null
  // Methods (similar to CSPR.click)
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  switchAccount: () => Promise<void>
  getActiveAccount: () => AccountType | null
  getActiveAccountAsync: () => Promise<AccountType | null>
  // Direct provider methods
  connect: () => Promise<boolean>
  disconnect: () => Promise<boolean>
  getActivePublicKey: () => Promise<string | undefined>
  sign: (deployJson: string, signingPublicKeyHex: string) => Promise<any>
  signMessage: (message: string, signingPublicKeyHex: string) => Promise<any>
}

// Declare global window type
declare global {
  interface Window {
    CasperWalletProvider: () => CasperWalletProvider
  }
}

// Create context
const CasperWalletContext = React.createContext<CasperWalletContextType | null>(null)

export function CasperWalletProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProvider] = useState<CasperWalletProvider | null>(null)
  const [isAvailable, setIsAvailable] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [activeAccount, setActiveAccount] = useState<AccountType | null>(null)
  const [publicKey, setPublicKey] = useState<string | null>(null)

  // Wait for provider to be available
  useEffect(() => {
    const loadProvider = async () => {
      let tries = 0
      const maxTries = 20 // Wait up to 6 seconds (20 * 300ms)

      while (!window.CasperWalletProvider && tries < maxTries) {
        await new Promise(resolve => setTimeout(resolve, 300))
        tries++
      }

      if (window.CasperWalletProvider) {
        try {
          const p = window.CasperWalletProvider()
          setProvider(p)
          setIsAvailable(true)
          console.log("✅ Casper Wallet provider loaded")

          // Check initial connection state
          await checkConnectionState(p)
        } catch (error) {
          console.error("❌ Failed to get Casper Wallet provider:", error)
          setIsAvailable(false)
        }
      } else {
        console.warn("⚠️ Casper Wallet extension not found")
        setIsAvailable(false)
      }
    }

    loadProvider()
  }, [])

  // Check connection state
  const checkConnectionState = useCallback(async (p: CasperWalletProvider) => {
    try {
      const connected = await p.isConnected()
      setIsConnected(connected)

      if (connected) {
        const key = await p.getActivePublicKey()
        if (key) {
          setPublicKey(key)
          setActiveAccount({
            publicKey: key,
            address: key,
          })
        }
      } else {
        setPublicKey(null)
        setActiveAccount(null)
      }
    } catch (error) {
      console.error("Error checking connection state:", error)
      setIsConnected(false)
      setPublicKey(null)
      setActiveAccount(null)
    }
  }, [])

  // Listen to Casper Wallet events
  useEffect(() => {
    if (!provider) return

    const handleConnected = async () => {
      console.log("🔗 Casper Wallet connected")
      setIsConnected(true)
      setIsUnlocked(true)
      await checkConnectionState(provider)
    }

    const handleDisconnected = () => {
      console.log("🔌 Casper Wallet disconnected")
      setIsConnected(false)
      setPublicKey(null)
      setActiveAccount(null)
    }

    const handleActiveKeyChanged = async (event: any) => {
      console.log("🔑 Active key changed:", event.detail)
      const newKey = event.detail || await provider.getActivePublicKey()
      if (newKey) {
        setPublicKey(newKey)
        setActiveAccount({
          publicKey: newKey,
          address: newKey,
        })
      }
    }

    const handleLocked = () => {
      console.log("🔒 Casper Wallet locked")
      setIsUnlocked(false)
      setIsConnected(false)
    }

    const handleUnlocked = async () => {
      console.log("🔓 Casper Wallet unlocked")
      setIsUnlocked(true)
      await checkConnectionState(provider)
    }

    // Subscribe to events
    window.addEventListener("casper-wallet:connected", handleConnected)
    window.addEventListener("casper-wallet:disconnected", handleDisconnected)
    window.addEventListener("casper-wallet:activeKeyChanged", handleActiveKeyChanged)
    window.addEventListener("casper-wallet:locked", handleLocked)
    window.addEventListener("casper-wallet:unlocked", handleUnlocked)

    // Periodic check (fallback)
    const interval = setInterval(() => {
      if (provider) {
        checkConnectionState(provider)
      }
    }, 2000)

    return () => {
      window.removeEventListener("casper-wallet:connected", handleConnected)
      window.removeEventListener("casper-wallet:disconnected", handleDisconnected)
      window.removeEventListener("casper-wallet:activeKeyChanged", handleActiveKeyChanged)
      window.removeEventListener("casper-wallet:locked", handleLocked)
      window.removeEventListener("casper-wallet:unlocked", handleUnlocked)
      clearInterval(interval)
    }
  }, [provider, checkConnectionState])

  // Sign in (similar to CSPR.click signIn)
  const signIn = useCallback(async () => {
    if (!provider) {
      throw new Error("Casper Wallet not available. Please install the extension.")
    }

    try {
      const connected = await provider.isConnected()
      if (!connected) {
        const result = await provider.requestConnection()
        if (!result) {
          throw new Error("Connection request rejected by user")
        }
      }

      const key = await provider.getActivePublicKey()
      if (key) {
        setPublicKey(key)
        setActiveAccount({
          publicKey: key,
          address: key,
        })
        setIsConnected(true)
        setIsUnlocked(true)
      }
    } catch (error: any) {
      console.error("Failed to sign in:", error)
      throw error
    }
  }, [provider])

  // Sign out (similar to CSPR.click signOut)
  const signOut = useCallback(async () => {
    if (!provider) return

    try {
      await provider.disconnectFromSite()
      setPublicKey(null)
      setActiveAccount(null)
      setIsConnected(false)
    } catch (error) {
      console.error("Failed to sign out:", error)
    }
  }, [provider])

  // Switch account (similar to CSPR.click switchAccount)
  const switchAccount = useCallback(async () => {
    if (!provider) {
      throw new Error("Casper Wallet not available")
    }

    try {
      await provider.requestSwitchAccount()
      // Active key will be updated via event listener
    } catch (error) {
      console.error("Failed to switch account:", error)
      throw error
    }
  }, [provider])

  // Get active account (synchronous, like CSPR.click)
  const getActiveAccount = useCallback((): AccountType | null => {
    return activeAccount
  }, [activeAccount])

  // Get active account (async, like CSPR.click)
  const getActiveAccountAsync = useCallback(async (): Promise<AccountType | null> => {
    if (!provider) return null

    try {
      const key = await provider.getActivePublicKey()
      if (key) {
        const account = {
          publicKey: key,
          address: key,
        }
        setActiveAccount(account)
        setPublicKey(key)
        return account
      }
    } catch (error) {
      console.error("Failed to get active account:", error)
    }
    return null
  }, [provider])

  // Direct connection method
  const connect = useCallback(async (): Promise<boolean> => {
    if (!provider) {
      throw new Error("Casper Wallet not available")
    }

    try {
      return await provider.requestConnection()
    } catch (error) {
      console.error("Failed to connect:", error)
      throw error
    }
  }, [provider])

  // Direct disconnect method
  const disconnect = useCallback(async (): Promise<boolean> => {
    if (!provider) {
      return false
    }

    try {
      return await provider.disconnectFromSite()
    } catch (error) {
      console.error("Failed to disconnect:", error)
      return false
    }
  }, [provider])

  // Direct getActivePublicKey method
  const getActivePublicKey = useCallback(async (): Promise<string | undefined> => {
    if (!provider) return undefined
    return await provider.getActivePublicKey()
  }, [provider])

  // Direct sign method
  const sign = useCallback(async (deployJson: string, signingPublicKeyHex: string): Promise<any> => {
    if (!provider) {
      throw new Error("Casper Wallet not available")
    }
    return await provider.sign(deployJson, signingPublicKeyHex)
  }, [provider])

  // Direct signMessage method
  const signMessage = useCallback(async (message: string, signingPublicKeyHex: string): Promise<any> => {
    if (!provider) {
      throw new Error("Casper Wallet not available")
    }
    return await provider.signMessage(message, signingPublicKeyHex)
  }, [provider])

  // Context value
  const contextValue: CasperWalletContextType = {
    provider,
    isAvailable,
    isConnected,
    isUnlocked,
    activeAccount,
    publicKey,
    signIn,
    signOut,
    switchAccount,
    getActiveAccount,
    getActiveAccountAsync,
    connect,
    disconnect,
    getActivePublicKey,
    sign,
    signMessage,
  }

  return (
    <CasperWalletContext.Provider value={contextValue}>
      {children}
    </CasperWalletContext.Provider>
  )
}

// Hook to use Casper Wallet (similar to useCsprClick)
export function useCasperWallet(): CasperWalletContextType {
  const context = React.useContext(CasperWalletContext)
  if (!context) {
    throw new Error("useCasperWallet must be used within CasperWalletProvider")
  }
  return context
}
