"use client"

import { useState, useEffect } from "react"
import { useUser } from "@/contexts/user-context"
import { usePrivy } from "@privy-io/react-auth"
import { useWallets } from "@privy-io/react-auth"

interface LeaderboardEntry {
  rank: number
  userId: string
  username: string | null
  points: number
}

export default function LeaderboardPage() {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const { userData } = useUser()
  const { user } = usePrivy()
  const { wallets } = useWallets()

  // Get current user's wallet address
  const getCurrentUserAddress = (): string | null => {
    if (userData?._id) {
      return userData._id
    }
    
    if (user?.linkedAccounts) {
      const embeddedWallet = user.linkedAccounts.find((acc: any) => 
        acc.type === "wallet" && acc.connectorType === "embedded"
      ) as any
      if (embeddedWallet?.address) {
        return embeddedWallet.address
      }
      
      const walletAccount = user.linkedAccounts.find((acc: any) => acc.type === "wallet") as any
      if (walletAccount?.address) {
        return walletAccount.address
      }
    }
    
    if (wallets?.length > 0) {
      return wallets[0].address
    }
    
    return null
  }

  const currentUserAddress = getCurrentUserAddress()
  const currentUserInLeaderboard = leaderboardData.find(
    (entry) => entry.userId.toLowerCase() === currentUserAddress?.toLowerCase()
  )

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true)
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || ""
        if (!backendUrl) {
          setLoading(false)
          return
        }

        const apiUrl = backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`
        const response = await fetch(`${apiUrl}api/v1/leaderboard?limit=10`)

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.data?.leaderboard) {
            setLeaderboardData(result.data.leaderboard)
          }
        }
      } catch (error) {
        console.error("Error fetching leaderboard:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [])

  const formatAddress = (address: string) => {
    if (!address) return ""
    if (address.length <= 10) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex justify-center">
        <div className="w-full max-w-[95%] md:max-w-[70%]">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-4xl font-semibold text-white mb-2">Leaderboard</h1>
            <p className="text-gray-400 text-sm md:text-base">Top contributors ranked by points earned, updated daily.</p>
          </div>
          <div className="bg-black rounded-lg border border-white/20 p-8 text-center">
            <p className="text-gray-400">Loading leaderboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-[95%] md:max-w-[70%]">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-semibold text-white mb-2">Leaderboard</h1>
          <p className="text-gray-400 text-sm md:text-base">Top contributors ranked by points earned, updated daily.</p>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-black rounded-lg border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left py-3 md:py-4 px-3 md:px-6 text-gray-400 font-medium text-xs md:text-sm">Rank</th>
                  <th className="text-left py-3 md:py-4 px-3 md:px-6 text-gray-400 font-medium text-xs md:text-sm">User</th>
                  <th className="text-right py-3 md:py-4 px-3 md:px-6 text-gray-400 font-medium text-xs md:text-sm">Points</th>
                </tr>
              </thead>
              <tbody>
                {/* Current User Row (Highlighted) - Only show if NOT in top 10 */}
                {currentUserAddress && !currentUserInLeaderboard && userData && (
                  <tr className="bg-[#6efcd9]/20 border-b border-[#6efcd9]/50">
                    <td className="py-3 md:py-4 px-3 md:px-6">
                      <span className="inline-flex items-center px-2 md:px-3 py-1 rounded-full bg-[#6efcd9] text-black text-xs md:text-sm font-medium">
                        You
                      </span>
                    </td>
                    <td className="py-3 md:py-4 px-3 md:px-6">
                      <span className="text-white text-sm md:text-base">
                        <span className="hidden sm:inline">{currentUserAddress}</span>
                        <span className="sm:hidden">{formatAddress(currentUserAddress)}</span>
                        <span className="text-[#6efcd9]"> (You)</span>
                      </span>
                    </td>
                    <td className="py-3 md:py-4 px-3 md:px-6 text-right">
                      <span className="text-white font-medium text-sm md:text-base">{(userData.totalPoints || 0).toLocaleString()}</span>
                    </td>
                  </tr>
                )}

                {/* Top 10 Contributors - Always show */}
                {leaderboardData.length > 0 ? (
                  leaderboardData.map((entry) => {
                    const isCurrentUser = currentUserAddress?.toLowerCase() === entry.userId.toLowerCase()
                    return (
                      <tr
                        key={entry.rank}
                        className={`border-b border-white/10 hover:bg-white/5 transition-colors ${
                          isCurrentUser ? "bg-[#6efcd9]/20 border-[#6efcd9]/50" : ""
                        }`}
                      >
                        <td className="py-3 md:py-4 px-3 md:px-6">
                          <span
                            className={`inline-flex items-center px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium ${
                              isCurrentUser
                                ? "bg-[#6efcd9] text-black"
                                : "bg-gray-800 text-white"
                            }`}
                          >
                            #{entry.rank}
                          </span>
                        </td>
                        <td className="py-3 md:py-4 px-3 md:px-6">
                          <span className="text-white text-sm md:text-base">
                            <span className="hidden sm:inline">{entry.userId}</span>
                            <span className="sm:hidden">{formatAddress(entry.userId)}</span>
                            {isCurrentUser && <span className="text-[#6efcd9]"> (You)</span>}
                          </span>
                        </td>
                        <td className="py-3 md:py-4 px-3 md:px-6 text-right">
                          <span className="text-white font-medium text-sm md:text-base">{entry.points.toLocaleString()}</span>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-400">
                      No leaderboard data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

