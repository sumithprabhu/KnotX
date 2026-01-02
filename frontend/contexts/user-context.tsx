"use client"

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react"
import { usePrivy } from "@privy-io/react-auth"
import { useWallets } from "@privy-io/react-auth"

interface UserData {
  _id: string
  username: string
  joinDate: string
  totalPoints: number
  campaignsJoined: any[]
  referrals: number
  referralCode: string
  activity: any[]
}

interface UserContextType {
  userData: UserData | null
  loading: boolean
  error: string | null
  refreshUserData: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasRegistered, setHasRegistered] = useState(false)
  const { user, authenticated, ready } = usePrivy()
  const { wallets } = useWallets()
  const isRegisteringRef = useRef(false)
  const registrationAttemptedRef = useRef(false)

  const registerUser = async (privyUser: any, walletAddr?: string) => {
    if (isRegisteringRef.current || hasRegistered) {
      return
    }
    
    isRegisteringRef.current = true
    registrationAttemptedRef.current = true
    
    if (!privyUser || !authenticated) {
      setLoading(false)
      isRegisteringRef.current = false
      return
    }

    try {
      // Get embedded wallet from linkedAccounts - this ensures consistent wallet per user
      let walletAddress = walletAddr
      
      if (privyUser.linkedAccounts) {
        const embeddedWallet = privyUser.linkedAccounts.find((acc: any) => 
          acc.type === "wallet" && acc.connectorType === "embedded"
        ) as any
        
        if (embeddedWallet?.address) {
          walletAddress = embeddedWallet.address
        } else {
          // Fallback: any wallet from linkedAccounts
          const walletAccount = privyUser.linkedAccounts.find((acc: any) => acc.type === "wallet") as any
          walletAddress = walletAccount?.address || walletAddress
        }
      }
      
      // Last resort: use wallet from useWallets hook
      if (!walletAddress && wallets?.length > 0) {
        walletAddress = wallets[0].address
      }
      
      if (!walletAddress) {
        setLoading(false)
        isRegisteringRef.current = false
        return
      }

      // Extract email from user object or linkedAccounts
      // Check multiple possible locations for email
      let email = privyUser.email?.address || ""
      
      // If no email in user.email, check linkedAccounts
      if (!email && privyUser.linkedAccounts) {
        const emailAccount = privyUser.linkedAccounts.find((acc: any) => acc.type === "email") as any
        const googleAccount = privyUser.linkedAccounts.find((acc: any) => acc.type === "google_oauth") as any
        
        email = emailAccount?.address || 
                googleAccount?.email || 
                googleAccount?.name || 
                ""
      }
      
      const username = email.split("@")[0] || email || "user"
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || ""
      
      if (!backendUrl) {
        setLoading(false)
        isRegisteringRef.current = false
        return
      }

      const apiUrl = backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`
      const fullUrl = `${apiUrl}api/v1/users/register`
      
      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wallet: walletAddress,
          username: username,
          email: email,
          referralCode: "NEWLOGIN",
        }),
      })

      if (response.status === 409) {
        setHasRegistered(true)
        setLoading(false)
        isRegisteringRef.current = false
        // User already exists, fetch their data
        if (walletAddress) {
          await fetchUserData(walletAddress)
        }
        return
      }

      if (!response.ok) {
        console.error("Registration failed:", response.status)
        setError("Registration failed. Please try again.")
        return
      }

      const result = await response.json()
      
      if (result.success && result.data) {
        setUserData(result.data)
        setError(null)
        setHasRegistered(true)
      } else {
        // If registration didn't return data, fetch it
        if (walletAddress) {
          await fetchUserData(walletAddress)
        }
      }
    } catch (err: any) {
      isRegisteringRef.current = false
      console.error("Registration error:", err)
      setError(err.message || "Registration failed. Please try again.")
    } finally {
      setLoading(false)
      isRegisteringRef.current = false
    }
  }

  const fetchUserData = async (walletAddress: string) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || ""
      if (!backendUrl) return

      const apiUrl = backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`
      const response = await fetch(`${apiUrl}api/v1/users/${walletAddress}`)

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          setUserData(result.data)
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error)
    }
  }

  const refreshUserData = async () => {
    setLoading(true)
    setHasRegistered(false)
    if (user) {
      // Get wallet address
      let walletAddress: string | undefined = undefined
      if (user.linkedAccounts) {
        const embeddedWallet = user.linkedAccounts.find((acc: any) => 
          acc.type === "wallet" && acc.connectorType === "embedded"
        ) as any
        walletAddress = embeddedWallet?.address
      }
      
      if (!walletAddress && user.linkedAccounts) {
        const walletAccount = user.linkedAccounts.find((acc: any) => acc.type === "wallet") as any
        walletAddress = walletAccount?.address
      }
      
      if (!walletAddress && wallets?.length > 0) {
        walletAddress = wallets[0].address
      }

      if (walletAddress) {
        await fetchUserData(walletAddress)
      } else {
        await registerUser(user)
      }
    }
  }

  useEffect(() => {
    if (!ready) {
      setLoading(true)
      return
    }

    if (!authenticated) {
      setUserData(null)
      setLoading(false)
      setHasRegistered(false)
      return
    }

    if (authenticated && user) {
      // Get embedded wallet from linkedAccounts - this is the consistent wallet
      let walletAddress: string | undefined = undefined
      
      // First priority: Get embedded wallet from linkedAccounts
      if (user.linkedAccounts) {
        const embeddedWallet = user.linkedAccounts.find((acc: any) => 
          acc.type === "wallet" && acc.connectorType === "embedded"
        ) as any
        
        if (embeddedWallet && embeddedWallet.address) {
          walletAddress = embeddedWallet.address
        }
      }
      
      // Fallback: Try any wallet from linkedAccounts
      if (!walletAddress && user.linkedAccounts) {
        const walletAccount = user.linkedAccounts.find((acc: any) => acc.type === "wallet") as any
        walletAddress = walletAccount?.address
      }
      
      // Last resort: Use wallet from useWallets hook
      if (!walletAddress && wallets && wallets.length > 0) {
        walletAddress = wallets[0].address
      }
      
      // Get email from user object or linkedAccounts
      let email = user.email?.address
      if (!email && user.linkedAccounts) {
        const emailAccount = user.linkedAccounts.find((acc: any) => acc.type === "email") as any
        const googleAccount = user.linkedAccounts.find((acc: any) => acc.type === "google_oauth") as any
        
        email = emailAccount?.address || 
                googleAccount?.email || 
                (googleAccount?.subject && googleAccount?.subject.includes("@") ? googleAccount.subject : null) ||
                googleAccount?.name || 
                ""
      }
      
      if (walletAddress && email && !hasRegistered && !isRegisteringRef.current && !registrationAttemptedRef.current) {
        registerUser(user, walletAddress)
      } else if (!walletAddress && email && !hasRegistered && !registrationAttemptedRef.current) {
        if (wallets.length > 0) {
          const walletAddr = wallets[0].address
          if (walletAddr && !hasRegistered && !isRegisteringRef.current && !registrationAttemptedRef.current) {
            registerUser(user, walletAddr)
          }
        } else {
          setLoading(false)
        }
      } else if (!email) {
        setLoading(false)
      } else if (hasRegistered) {
        setLoading(false)
      }
    }
    // Only depend on ready, authenticated, and hasRegistered to prevent loops
    // Use refs or check inside to access latest user/wallets values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, hasRegistered])
  
  // Handle wallet changes without triggering registration loop
  useEffect(() => {
    if (authenticated && user && !hasRegistered && !isRegisteringRef.current && !registrationAttemptedRef.current && wallets?.length > 0) {
      const walletAddress = wallets[0].address
      let email = user.email?.address
      if (!email && user.linkedAccounts) {
        const emailAccount = user.linkedAccounts.find((acc: any) => acc.type === "email") as any
        const googleAccount = user.linkedAccounts.find((acc: any) => acc.type === "google_oauth") as any
        email = emailAccount?.address || 
                googleAccount?.email || 
                (googleAccount?.subject && googleAccount?.subject.includes("@") ? googleAccount.subject : null) ||
                googleAccount?.name || 
                ""
      }
      
      if (walletAddress && email) {
        registerUser(user, walletAddress)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets?.length, hasRegistered])

  // Fetch user data when authenticated and wallet is available
  useEffect(() => {
    if (authenticated && user && hasRegistered && !userData) {
      let walletAddress: string | undefined = undefined
      if (user.linkedAccounts) {
        const embeddedWallet = user.linkedAccounts.find((acc: any) => 
          acc.type === "wallet" && acc.connectorType === "embedded"
        ) as any
        walletAddress = embeddedWallet?.address
      }
      
      if (!walletAddress && user.linkedAccounts) {
        const walletAccount = user.linkedAccounts.find((acc: any) => acc.type === "wallet") as any
        walletAddress = walletAccount?.address
      }
      
      if (!walletAddress && wallets?.length > 0) {
        walletAddress = wallets[0].address
      }

      if (walletAddress) {
        fetchUserData(walletAddress)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, hasRegistered, user, wallets])
  
  // Reset registration flags when user logs out
  useEffect(() => {
    if (!authenticated) {
      isRegisteringRef.current = false
      registrationAttemptedRef.current = false
      setHasRegistered(false)
    }
  }, [authenticated])

  return (
    <UserContext.Provider value={{ userData, loading, error, refreshUserData }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}

