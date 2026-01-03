# CSPR.click SDK - How It Connects to Casper Wallet

## Overview

CSPR.click is a wallet connection SDK that provides a unified interface for connecting to multiple Casper wallet providers, including the official Casper Wallet browser extension. This document explains how CSPR.click connects to Casper Wallet and how you can use it (or implement a similar connection directly).

## Architecture

CSPR.click uses a **provider pattern** where different wallet types (Casper Wallet, Ledger, MetaMask Snap, etc.) are abstracted behind a common `Provider` interface.

```
┌─────────────────┐
│  CSPR.click SDK │
│  (CSPRClickSDK) │
└────────┬────────┘
         │
         │ Uses Provider Pattern
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼──────┐
│Casper │ │ Ledger  │
│Wallet │ │ Provider│
│Provider│ │         │
└───┬───┘ └─────────┘
    │
    │ Accesses
    │
┌───▼──────────────────┐
│ window.CasperWallet  │
│ Provider (Extension)  │
└───────────────────────┘
```

## How CSPR.click Connects to Casper Wallet

### 1. Provider Detection

CSPR.click checks if the Casper Wallet extension is installed by looking for `window.CasperWalletProvider`:

```typescript
// From: node_modules/@make-software/csprclick-core-client/casper-wallet/index.d.ts

static IsPresent(): boolean {
  // Checks if window.CasperWalletProvider exists
  return typeof window !== 'undefined' && 
         typeof window.CasperWalletProvider === 'function';
}
```

### 2. Getting the Provider Instance

Once detected, CSPR.click gets the provider instance:

```typescript
// The Casper Wallet extension injects this into window
const provider = window.CasperWalletProvider();

// Provider interface (from types.d.ts):
type CasperWalletProvider = {
  requestConnection: () => Promise<boolean>;
  disconnectFromSite: () => Promise<boolean>;
  requestSwitchAccount: () => Promise<boolean>;
  isConnected: () => Promise<boolean>;
  getActivePublicKey: () => Promise<string | undefined>;
  getVersion: () => Promise<string>;
  getActivePublicKeySupports: () => Promise<string[] | string>;
  sign: (deployJson: string, signingPublicKeyHex: string) => Promise<SignResult>;
  signMessage: (message: string, signingPublicKeyHex: string) => Promise<SignResult>;
};
```

### 3. Connection Flow

Here's how CSPR.click connects to Casper Wallet:

```typescript
// Simplified connection flow:

// Step 1: Check if wallet is present
if (!window.CasperWalletProvider) {
  throw new Error("Casper Wallet not installed");
}

// Step 2: Get provider instance
const provider = window.CasperWalletProvider();

// Step 3: Check if already connected
const connected = await provider.isConnected();

// Step 4: Request connection if not connected
if (!connected) {
  await provider.requestConnection();
  // This opens the wallet popup for user approval
}

// Step 5: Get active public key
const publicKey = await provider.getActivePublicKey();
```

### 4. Event Listeners

CSPR.click listens to Casper Wallet events:

```typescript
// Event types (from types.d.ts):
enum CasperWalletEventTypes {
  Connected = "casper-wallet:connected",
  Disconnected = "casper-wallet:disconnected",
  TabChanged = "casper-wallet:tabChanged",
  ActiveKeyChanged = "casper-wallet:activeKeyChanged",
  Locked = "casper-wallet:locked",
  Unlocked = "casper-wallet:unlocked"
}

// How to listen:
window.addEventListener("casper-wallet:connected", () => {
  console.log("Wallet connected!");
});

window.addEventListener("casper-wallet:activeKeyChanged", (event) => {
  console.log("Active key changed:", event.detail);
});
```

## Direct Casper Wallet Connection (Without CSPR.click)

Since CSPR.click has React compatibility issues with Next.js 16, here's how to connect directly:

### Basic Connection

```typescript
// 1. Wait for provider to be available
async function getCasperWalletProvider() {
  let tries = 0;
  while (!window.CasperWalletProvider && tries < 10) {
    await new Promise(resolve => setTimeout(resolve, 300));
    tries++;
  }
  return window.CasperWalletProvider ? window.CasperWalletProvider() : null;
}

// 2. Connect to wallet
async function connectWallet() {
  const provider = await getCasperWalletProvider();
  
  if (!provider) {
    throw new Error("Casper Wallet not found");
  }

  // Request connection
  const connected = await provider.isConnected();
  if (!connected) {
    await provider.requestConnection();
  }

  // Get active public key
  const publicKey = await provider.getActivePublicKey();
  return publicKey;
}
```

### Complete Implementation Example

```typescript
"use client"

import { useEffect, useState } from "react"

interface CasperWalletProvider {
  requestConnection: () => Promise<boolean>
  disconnectFromSite: () => Promise<boolean>
  requestSwitchAccount: () => Promise<boolean>
  isConnected: () => Promise<boolean>
  getActivePublicKey: () => Promise<string | undefined>
  getVersion: () => Promise<string>
  sign: (deployJson: string, signingPublicKeyHex: string) => Promise<any>
  signMessage: (message: string, signingPublicKeyHex: string) => Promise<any>
}

declare global {
  interface Window {
    CasperWalletProvider: () => CasperWalletProvider
  }
}

export function useCasperWallet() {
  const [provider, setProvider] = useState<CasperWalletProvider | null>(null)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Wait for provider
    const loadProvider = async () => {
      let tries = 0
      while (!window.CasperWalletProvider && tries < 10) {
        await new Promise(resolve => setTimeout(resolve, 300))
        tries++
      }
      
      if (window.CasperWalletProvider) {
        const p = window.CasperWalletProvider()
        setProvider(p)
        
        // Check connection
        const connected = await p.isConnected()
        if (connected) {
          const key = await p.getActivePublicKey()
          setPublicKey(key || null)
          setIsConnected(true)
        }
      }
    }

    loadProvider()

    // Listen for events
    const handleConnected = async () => {
      if (provider) {
        const key = await provider.getActivePublicKey()
        setPublicKey(key || null)
        setIsConnected(true)
      }
    }

    const handleDisconnected = () => {
      setPublicKey(null)
      setIsConnected(false)
    }

    window.addEventListener("casper-wallet:connected", handleConnected)
    window.addEventListener("casper-wallet:disconnected", handleDisconnected)
    window.addEventListener("casper-wallet:activeKeyChanged", handleConnected)

    return () => {
      window.removeEventListener("casper-wallet:connected", handleConnected)
      window.removeEventListener("casper-wallet:disconnected", handleDisconnected)
      window.removeEventListener("casper-wallet:activeKeyChanged", handleConnected)
    }
  }, [provider])

  const connect = async () => {
    if (!provider) {
      throw new Error("Casper Wallet not available")
    }

    const connected = await provider.isConnected()
    if (!connected) {
      await provider.requestConnection()
    }

    const key = await provider.getActivePublicKey()
    setPublicKey(key || null)
    setIsConnected(true)
  }

  const disconnect = async () => {
    if (provider) {
      await provider.disconnectFromSite()
      setPublicKey(null)
      setIsConnected(false)
    }
  }

  return {
    provider,
    publicKey,
    isConnected,
    connect,
    disconnect,
  }
}
```

## Key Methods

### `requestConnection()`
Opens the Casper Wallet popup to request user approval for connection.

```typescript
await provider.requestConnection()
// Returns: Promise<boolean>
// - true if user approved
// - false if user rejected
```

### `getActivePublicKey()`
Gets the currently active public key from the wallet.

```typescript
const publicKey = await provider.getActivePublicKey()
// Returns: Promise<string | undefined>
// - Public key in hex format (e.g., "01abc123...")
// - undefined if not connected
```

### `isConnected()`
Checks if the wallet is connected to your site.

```typescript
const connected = await provider.isConnected()
// Returns: Promise<boolean>
// Note: Only valid when wallet is unlocked
```

### `sign()`
Signs a deploy (transaction) JSON.

```typescript
const signed = await provider.sign(
  deployJson,  // JSON string of the deploy
  publicKey    // Public key to sign with
)
// Returns: Promise<SignResult>
```

### `signMessage()`
Signs an arbitrary message (off-chain).

```typescript
const signature = await provider.signMessage(
  "Hello, Casper!",  // Message to sign
  publicKey          // Public key to sign with
)
// Returns: Promise<SignResult>
```

## Event System

Casper Wallet emits events that you can listen to:

```typescript
// Connection events
window.addEventListener("casper-wallet:connected", () => {
  console.log("Wallet connected!")
})

window.addEventListener("casper-wallet:disconnected", () => {
  console.log("Wallet disconnected!")
})

// Account events
window.addEventListener("casper-wallet:activeKeyChanged", (event) => {
  console.log("Active key changed:", event.detail)
  // event.detail contains the new public key
})

// Lock/unlock events
window.addEventListener("casper-wallet:locked", () => {
  console.log("Wallet locked")
})

window.addEventListener("casper-wallet:unlocked", () => {
  console.log("Wallet unlocked")
})
```

## Why CSPR.click Has Issues with Next.js 16

CSPR.click tries to access React internals (`ReactCurrentDispatcher`) during module initialization. This happens because:

1. **Module Bundling**: Next.js bundles CSPR.click with webpack
2. **React Internals**: CSPR.click accesses React's internal dispatcher during import
3. **Timing Issue**: The dispatcher isn't available when the module is being bundled/initialized
4. **Version Mismatch**: CSPR.click was built for React 18, but Next.js 16 uses a different React setup

**Error:**
```
Cannot read properties of undefined (reading 'ReactCurrentDispatcher')
```

This is a **library-level incompatibility**, not a code issue.

## Solution: Direct Connection

Since CSPR.click has compatibility issues, use the direct Casper Wallet connection approach shown above. It:

- ✅ Works with Next.js 16
- ✅ No React version conflicts
- ✅ Simpler code
- ✅ Direct access to wallet features
- ✅ Same functionality as CSPR.click for Casper Wallet

## Comparison: CSPR.click vs Direct Connection

| Feature | CSPR.click | Direct Connection |
|---------|-----------|-------------------|
| Next.js 16 Support | ❌ Incompatible | ✅ Works |
| Multiple Wallets | ✅ Yes | ❌ Casper Wallet only |
| React Dependency | ✅ Required | ❌ Not required |
| Bundle Size | ⚠️ Larger | ✅ Smaller |
| Setup Complexity | ⚠️ Complex | ✅ Simple |
| Maintenance | ⚠️ Depends on library | ✅ Full control |

## References

- **CSPR.click Docs**: https://docs.cspr.click
- **Casper Wallet Docs**: https://docs.casperwallet.io
- **CSPR.click SDK Types**: `node_modules/@make-software/csprclick-core-client/casper-wallet/types.d.ts`
- **CSPR.click SDK Implementation**: `node_modules/@make-software/csprclick-core-client/casper-wallet/index.d.ts`

## Code Location in This Project

- **CSPR.click Provider**: `frontend/components/cspr-click-provider.tsx`
- **Direct Wallet Provider**: `frontend/components/casper-wallet-provider.tsx` (if exists)
- **Usage**: `frontend/components/universal-counter-swap.tsx`

