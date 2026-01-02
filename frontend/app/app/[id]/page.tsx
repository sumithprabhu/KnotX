"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"
import { SlPeople } from "react-icons/sl"
import { useUser } from "@/contexts/user-context"
import { usePrivy } from "@privy-io/react-auth"
import { useWallets } from "@privy-io/react-auth"
import { useRouter } from "next/navigation"

interface Campaign {
  _id: string
  name: string
  country: string
  flag: string
  description: string
  type: string
  location: string
  imageUrl: string
  status: string
  participants?: number
  createdAt?: string
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = params instanceof Promise ? use(params) : params
  const campaignId = resolvedParams?.id ? String(resolvedParams.id) : ""
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
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
      const response = await fetch(`${apiUrl}api/v1/campaigns/${campaignId}/join/${walletAddress}`, {
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

  const handleSubmitDashcamVideo = () => {
    // Navigate immediately
    router.push(`/app/${campaignId}/record`)
    
    // Call join API in background (fire and forget)
    const walletAddress = getCurrentUserAddress()
    if (walletAddress) {
      joinCampaignAsync(walletAddress)
    }
  }

  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || ""
        if (!backendUrl) {
          setLoading(false)
          return
        }

        const apiUrl = backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`
        const response = await fetch(`${apiUrl}api/v1/campaigns/${campaignId}`)

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.data) {
            setCampaign(result.data)
          }
          console.log("Campaign data:", result.data)
        }
    
      } catch (error) {
        console.error("Error fetching campaign:", error)
      } finally {
        setLoading(false)
      }
    }

    if (campaignId) {
      fetchCampaign()
    }
  }, [campaignId])

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex justify-center">
        <div className="text-gray-400">Loading campaign...</div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="p-4 md:p-8 flex justify-center">
        <div className="w-full max-w-[95%] md:max-w-[70%] text-center">
          <h1 className="text-2xl font-semibold text-white mb-4">Campaign Not Found</h1>
          <p className="text-gray-400 mb-2">Campaign ID: {campaignId}</p>
          <Link href="/app" className="text-[#6efcd9] hover:underline">
            ← Back to Campaigns
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-[95%] md:max-w-[70%] space-y-6 md:space-y-8">
        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/app" className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-1.5 border border-[#6efcd9]">
            <span className="text-xl">{campaign.flag}</span>
            <span className="text-sm font-medium text-white">{campaign.country}</span>
          </div>
        </div>

        {/* City Image */}
        <div className="relative h-48 md:h-64 w-full rounded-2xl overflow-hidden mb-6 md:mb-8">
          <Image
            src={campaign.imageUrl}
            alt={campaign.name}
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6">
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">{campaign.name}</h1>
            <p className="text-gray-300 text-sm md:text-base">Dashcam Video Campaign</p>
          </div>
        </div>

        {/* Campaign info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8 mb-6 md:mb-8">
          <div>
            <p className="text-gray-400 text-sm mb-2">Status</p>
            <p className="text-xl text-[#6efcd9]">{campaign.status}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm mb-2">Participants</p>
            <div className="flex items-center gap-2">
              <SlPeople className="text-white" />
              <p className="text-xl text-white">{(campaign.participants || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleSubmitDashcamVideo}
          className="w-full bg-[#6efcd9] text-black py-4 rounded-full text-lg font-semibold hover:bg-[#5ee8c9] transition-colors mb-8"
        >
          Submit Dashcam Video
        </button>

        {/* Description */}
        <div className="bg-gray-900 rounded-lg border border-white/10 p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">About This Campaign</h2>
          <p className="text-gray-300 leading-relaxed">{campaign.description}</p>
        </div>

        {/* Campaign details */}
        <div className="border-t border-white/20 pt-6 md:pt-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-8">
            <div>
              <p className="text-gray-400 text-sm mb-2">Campaign Type</p>
              <p className="text-white">DASHCAM VIDEO</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-2">Location</p>
              <p className="text-white">{campaign.location}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-2">Created</p>
              <p className="text-white">
                {campaign.createdAt 
                  ? new Date(campaign.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
