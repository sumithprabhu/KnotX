"use client"

import { PrivyProvider } from "@privy-io/react-auth"

export function PrivyAuthProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  if (!appId) {
    console.error("NEXT_PUBLIC_PRIVY_APP_ID is not set in environment variables")
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Configuration Error</h1>
          <p className="text-gray-400">Privy App ID is missing. Please check your .env file.</p>
        </div>
      </div>
    )
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google"],
        embeddedWallets: {
          // Only create wallet for users who don't have one
          // Privy will automatically reuse existing wallet for same user/email
          createOnLogin: "users-without-wallets",
          noPromptOnSignature: false,
        },
        // Privy automatically links accounts with the same email address
        // This ensures one email = one user = one wallet
        appearance: {
          theme: "dark",
          accentColor: "#6efcd9",
        },
      }}
    >
      {children}
    </PrivyProvider>
  )
}

