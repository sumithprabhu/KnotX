"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { IoPersonSharp } from "react-icons/io5"
import { Calendar, Sparkles, ArrowUp, ExternalLink } from "lucide-react"
import { useUser } from "@/contexts/user-context"
import { usePrivy } from "@privy-io/react-auth"
import { useWallets } from "@privy-io/react-auth"

interface CampaignData {
  _id: string
  name: string
  country: string
  flag: string
  createdAt?: string
}

interface SubmissionData {
  _id: string
  status: 'pending' | 'approved' | 'rejected'
  ipAssetId?: string
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("all")
  const { userData, loading, refreshUserData } = useUser()
  const { user } = usePrivy()
  const { wallets } = useWallets()
  const [campaignsCache, setCampaignsCache] = useState<Record<string, CampaignData>>({})
  const [submissionsCache, setSubmissionsCache] = useState<Record<string, SubmissionData>>({})
  const [joinedCampaigns, setJoinedCampaigns] = useState<CampaignData[]>([])

  useEffect(() => {
    // Fetch user data if not available
    if (!userData && !loading) {
      refreshUserData()
    }
  }, [userData, loading, refreshUserData])

  // Fetch joined campaigns for campaigns tab
  useEffect(() => {
    if (!userData?.campaignsJoined || activeTab !== "campaigns") return

    const fetchJoinedCampaigns = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || ""
        if (!backendUrl) return

        const apiUrl = backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`
        const campaignPromises = userData.campaignsJoined.map(async (campaignId: any) => {
          const id = typeof campaignId === 'string' ? campaignId : campaignId._id || campaignId.toString()
          if (campaignsCache[id]) {
            return campaignsCache[id]
          }

          try {
            const response = await fetch(`${apiUrl}api/v1/campaigns/${id}`)
            if (response.ok) {
              const result = await response.json()
              if (result.success && result.data) {
                const campaign = result.data
                setCampaignsCache((prev) => ({
                  ...prev,
                  [id]: campaign,
                }))
                return campaign
              }
            }
          } catch (error) {
            console.error("Error fetching campaign:", error)
          }
          return null
        })

        const campaigns = await Promise.all(campaignPromises)
        setJoinedCampaigns(campaigns.filter((c): c is CampaignData => c !== null))
      } catch (error) {
        console.error("Error fetching joined campaigns:", error)
      }
    }

    fetchJoinedCampaigns()
  }, [userData?.campaignsJoined, activeTab, campaignsCache])

  // Fetch campaign and submission details for activities
  useEffect(() => {
    if (!userData?.activity) return

    const fetchCampaignDetails = async (campaignId: string) => {
      if (campaignsCache[campaignId]) return

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || ""
        if (!backendUrl) return

        const apiUrl = backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`
        const response = await fetch(`${apiUrl}api/v1/campaigns/${campaignId}`)

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.data) {
            setCampaignsCache((prev) => ({
              ...prev,
              [campaignId]: result.data,
            }))
          }
        }
      } catch (error) {
        console.error("Error fetching campaign:", error)
      }
    }

    const fetchSubmissionDetails = async (submissionId: string) => {
      if (submissionsCache[submissionId]) return

      try {
        const walletAddress = userData._id
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || ""
        if (!backendUrl) return

        const apiUrl = backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`
        const response = await fetch(`${apiUrl}api/v1/submissions/${submissionId}?userId=${walletAddress}`)

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.data) {
            setSubmissionsCache((prev) => ({
              ...prev,
              [submissionId]: result.data,
            }))
          }
        }
      } catch (error) {
        console.error("Error fetching submission:", error)
      }
    }

    // Fetch campaign and submission details for all activities
    userData.activity.forEach((activity: any) => {
      if (activity.details?.campaignId) {
        fetchCampaignDetails(activity.details.campaignId)
      }
      if (activity.details?.submissionId) {
        fetchSubmissionDetails(activity.details.submissionId)
      }
    })
  }, [userData, campaignsCache, submissionsCache])

  // Format join date
  const formatJoinDate = (dateString?: string) => {
    if (!dateString) return "N/A"
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return dateString
    }
  }

  const stats = {
    totalPoints: userData?.totalPoints || 0,
    campaigns: userData?.campaignsJoined?.length || 0,
    referrals: userData?.referrals || 0,
    activity: userData?.activity?.length || 0,
  }

  return (
    <div className="p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-[95%] md:max-w-[70%]">
        {/* User Profile Section */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-3 md:gap-4 mb-4">
            <div className="h-12 w-12 md:h-16 md:w-16 rounded-full bg-[#6efcd9] text-black flex items-center justify-center flex-shrink-0">
              <IoPersonSharp size={24} className="md:w-8 md:h-8" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold text-white mb-1 truncate">
                {userData?.username || "User"}
              </h1>
              <div className="flex items-center gap-2 text-gray-400 text-xs md:text-sm">
                <Calendar size={14} className="md:w-4 md:h-4" />
                <span>Joined {formatJoinDate(userData?.joinDate)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="bg-gray-900 rounded-lg p-4 md:p-6 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="md:w-5 md:h-5 text-white" />
              <h3 className="text-xs md:text-sm text-gray-400">Total points</h3>
            </div>
            <p className="text-2xl md:text-3xl font-semibold text-white">{stats.totalPoints.toLocaleString()}</p>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 md:p-6 border border-white/10">
            <h3 className="text-xs md:text-sm text-gray-400 mb-2">Campaigns</h3>
            <p className="text-2xl md:text-3xl font-semibold text-white">{stats.campaigns.toLocaleString()}</p>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 md:p-6 border border-white/10">
            <h3 className="text-xs md:text-sm text-gray-400 mb-2">Referrals</h3>
            <p className="text-2xl md:text-3xl font-semibold text-white">{stats.referrals.toLocaleString()}</p>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 md:p-6 border border-white/10">
            <h3 className="text-xs md:text-sm text-gray-400 mb-2">Activity</h3>
            <p className="text-2xl md:text-3xl font-semibold text-white">{stats.activity.toLocaleString()}</p>
          </div>
        </div>

        {/* Activity Log Section */}
        <div className="bg-gray-900 rounded-lg border border-white/10 p-6">
          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b border-white/10">
            <button
              onClick={() => setActiveTab("all")}
              className={`pb-3 px-2 text-sm font-medium transition-colors ${
                activeTab === "all" ? "text-white border-b-2 border-[#6efcd9]" : "text-gray-400 hover:text-white"
              }`}
            >
              All activity
            </button>
            <button
              onClick={() => setActiveTab("campaigns")}
              className={`pb-3 px-2 text-sm font-medium transition-colors ${
                activeTab === "campaigns" ? "text-white border-b-2 border-[#6efcd9]" : "text-gray-400 hover:text-white"
              }`}
            >
              Campaigns
            </button>
            <button
              onClick={() => setActiveTab("referrals")}
              className={`pb-3 px-2 text-sm font-medium transition-colors ${
                activeTab === "referrals" ? "text-white border-b-2 border-[#6efcd9]" : "text-gray-400 hover:text-white"
              }`}
            >
              Referrals
            </button>
          </div>

          {/* Campaigns Tab - Show joined campaigns */}
          {activeTab === "campaigns" ? (
            joinedCampaigns.length > 0 ? (
              <div className="space-y-4">
                {joinedCampaigns.map((campaign) => {
                  const formatDate = (dateString?: string) => {
                    if (!dateString) return "N/A"
                    try {
                      const date = new Date(dateString)
                      return date.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    } catch {
                      return dateString
                    }
                  }

                  return (
                    <Link
                      key={campaign._id}
                      href={`/app/${campaign._id}`}
                      className="flex items-center gap-4 px-4 py-2 rounded-lg bg-gray-800/50 border border-white/5 hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                      {/* Flag */}
                      <div className="text-2xl flex-shrink-0">{campaign.flag}</div>

                      {/* Campaign Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium">
                          {campaign.name}, {campaign.country}
                        </p>
                      </div>

                      {/* Date/Time */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <p className="text-gray-400 text-sm whitespace-nowrap">
                          {formatDate(campaign.createdAt)}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <Sparkles size={64} className="text-gray-600 mb-4" />
                <p className="text-gray-400">No campaigns joined</p>
              </div>
            )
          ) : activeTab === "referrals" ? (
            /* Referrals Tab - Coming Soon */
            <div className="flex flex-col items-center justify-center py-16">
              <Sparkles size={64} className="text-gray-600 mb-4" />
              <p className="text-gray-400 text-lg">Coming soon!</p>
            </div>
          ) : (
            /* All Activity Tab */
            userData?.activity && userData.activity.length > 0 ? (
              <div className="space-y-4">
                {[...userData.activity]
                  .reverse() // Reverse to show newest first
                  .map((activity: any, index: number) => {
                  const formatDate = (date: Date | string) => {
                    try {
                      const dateObj = date instanceof Date ? date : new Date(date)
                      return dateObj.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    } catch {
                      return String(date)
                    }
                  }

                  const campaignId = activity.details?.campaignId
                  const campaign = campaignId ? campaignsCache[campaignId] : null
                  const submissionId = activity.details?.submissionId
                  const submission = submissionId ? submissionsCache[submissionId] : null

                  const getActivityText = () => {
                    switch (activity.type) {
                      case "joined_campaign":
                        return "Joined campaign"
                      case "submitted_video":
                        return "Submitted video"
                      case "referral":
                      case "referral_bonus":
                        return "Referred a new user"
                      case "earned_points":
                        return "Earned points"
                      default:
                        return activity.type || "Activity"
                    }
                  }

                  const getStatusBadge = (status: string) => {
                    const statusColors: Record<string, string> = {
                      pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
                      approved: "bg-green-500/20 text-green-400 border-green-500/30",
                      rejected: "bg-red-500/20 text-red-400 border-red-500/30",
                    }
                    const color = statusColors[status] || "bg-gray-500/20 text-gray-400 border-gray-500/30"
                    return (
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${color}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    )
                  }

                  const handleContributionProofClick = (ipAssetId: string) => {
                    const url = `https://aeneid.explorer.story.foundation/ipa/${ipAssetId}`
                    window.open(url, '_blank', 'noopener,noreferrer')
                  }

                  const getPointsBadge = (points: number) => {
                    return (
                      <span className="px-2 py-1 rounded text-xs font-medium border bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1">
                        Points {points}
                        <ArrowUp size={12} />
                      </span>
                    )
                  }

                  return (
                    <div
                      key={`${activity.type}-${activity.date}-${index}`}
                      className="flex items-center gap-4 px-4 py-2 rounded-lg bg-gray-800/50 border border-white/5 hover:bg-gray-800 transition-colors"
                    >
                      {/* Flag or Icon */}
                      {campaign ? (
                        <div className="text-2xl flex-shrink-0">{campaign.flag}</div>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-[#6efcd9]/20 flex items-center justify-center flex-shrink-0">
                          <Sparkles size={20} className="text-[#6efcd9]" />
                        </div>
                      )}

                      {/* Activity Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-medium">{getActivityText()}</p>
                          {campaign && (
                            <>
                              <span className="text-gray-400">•</span>
                              <p className="text-white">
                                {campaign.name}, {campaign.country}
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Date/Time, Points, and Status */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {activity.type === "earned_points" && (activity.details?.points || activity.points) && (
                          getPointsBadge(activity.details?.points || activity.points)
                        )}
                        {submission && activity.type === "submitted_video" && (
                          <>
                            {submission.status === "approved" && submission.ipAssetId && (
                              <button
                                onClick={() => handleContributionProofClick(submission.ipAssetId!)}
                                className="px-2 py-1 rounded text-xs font-medium border bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30 transition-colors flex items-center gap-1"
                              >
                                Contribution proof
                                <ExternalLink size={12} className="rotate-45" />
                              </button>
                            )}
                            {getStatusBadge(submission.status)}
                          </>
                        )}
                        <p className="text-gray-400 text-sm whitespace-nowrap">
                          {formatDate(activity.date || activity.timestamp || new Date())}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <Sparkles size={64} className="text-gray-600 mb-4" />
                <p className="text-gray-400">No activity found</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

