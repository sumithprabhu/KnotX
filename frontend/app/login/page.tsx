"use client"

import { usePrivy } from "@privy-io/react-auth"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function LoginPage() {
  const { authenticated, ready, login } = usePrivy()
  const router = useRouter()

  useEffect(() => {
    if (ready && authenticated) {
      // Small delay to allow user registration to complete
      // The UserProvider will handle registration automatically
      setTimeout(() => {
        router.push("/app")
      }, 1000)
    }
  }, [authenticated, ready, router])

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (authenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <Image src="/logo.png" alt="Dashmint" width={64} height={64} className="h-16 w-16" />
          <h1 className="text-4xl font-semibold text-white">Welcome to Dashmint</h1>
          <p className="text-gray-400">Sign in to start contributing your dashcam videos</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={login}
            className="w-full bg-[#6efcd9] text-black py-4 rounded-full text-lg font-semibold hover:bg-[#5ee8c9] transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  )
}

