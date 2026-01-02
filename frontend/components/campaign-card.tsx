"use client"

import Image from "next/image"
import { SlPeople } from "react-icons/sl"
import { useUser } from "@/contexts/user-context"
import { usePrivy } from "@privy-io/react-auth"
import { useWallets } from "@privy-io/react-auth"
import { useRouter } from "next/navigation"

interface CampaignCardProps {
  campaign: {
    id: string
    country: string
    flag: string
    city: string
    description: string
    joined: number
    image: string
  }
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const { userData, refreshUserData } = useUser()
  const { user } = usePrivy()
  const { wallets } = useWallets()
  const router = useRouter()

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

  const joinCampaignAsync = async (walletAddress: string) => {
    // Fire and forget - call join API in background without blocking
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || ""
      if (!backendUrl) {
        return
      }

      const apiUrl = backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`
      const response = await fetch(`${apiUrl}api/v1/campaigns/${campaign.id}/join/${walletAddress}`, {
        method: "POST",
      })

      if (response.ok || response.status === 400) {
        // Success or already joined - refresh user data silently
        await refreshUserData()
      }
    } catch (error: any) {
      // Silently fail - just for tracking
      console.error("Error joining campaign (background):", error)
    }
  }

  const handleCardClick = () => {
    // Navigate immediately
    router.push(`/app/${campaign.id}`)
    
    // Call join API in background (fire and forget)
    const walletAddress = getCurrentUserAddress()
    if (walletAddress) {
      joinCampaignAsync(walletAddress)
    }
  }

  const handleJoinButtonClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Navigate immediately
    router.push(`/app/${campaign.id}`)
    
    // Call join API in background (fire and forget)
    const walletAddress = getCurrentUserAddress()
    if (walletAddress) {
      joinCampaignAsync(walletAddress)
    }
  }
  return (
    <div 
      onClick={handleCardClick}
      className="relative rounded-2xl overflow-hidden aspect-square cursor-pointer group hover:scale-[1.02] transition-transform duration-300"
    >
        {/* Top 50% - City Image (Clear) */}
        <div className="relative h-1/2 w-full">
          <Image
            src={campaign.image}
            alt={campaign.city}
            fill
            className="object-cover"
          />
          {/* Flag and Country Badge - Top Left */}
          <div className="absolute top-4 left-4 inline-flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 z-10">
            <span className="text-xl">{campaign.flag}</span>
            <span className="text-sm font-medium text-white">{campaign.country}</span>
          </div>
        </div>

        {/* Bottom 50% - Blurred Background with Text */}
        <div className="relative h-1/2 w-full">
          {/* Blurred Background Image */}
          <div className="absolute inset-0">
            <Image
              src={campaign.image}
              alt={campaign.city}
              fill
              className="object-cover blur-md scale-110"
            />
            {/* Dark Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-black/50" />
          </div>

          {/* Content Overlay */}
          <div className="relative h-full flex flex-col justify-between p-6 text-white z-10">
            <div className="flex-1 flex flex-col overflow-hidden">
              <h3 className="text-2xl font-semibold mb-2 flex-shrink-0">
                {campaign.city}
              </h3>
              {campaign.description ? (
                <p className="text-sm text-white line-clamp-3 leading-relaxed mb-3 flex-shrink-0">
                  {campaign.description}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">No description available</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/20 flex-shrink-0">
              <div className="flex items-center gap-2 text-sm opacity-80">
                <SlPeople />
                <span>{campaign.joined.toLocaleString()} Joined</span>
              </div>
              <button
                onClick={handleJoinButtonClick}
                className="bg-[#6efcd9] text-black px-6 py-2 rounded-full text-sm font-semibold hover:bg-[#5ee8c9] transition-colors"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
  )
}
