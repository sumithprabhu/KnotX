"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { toast } from "react-toastify"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"

interface Submission {
  _id: string
  userId: string
  campaignId: string | {
    _id: string
    name: string
    country: string
    flag: string
  }
  videoUrl: string
  status: 'pending' | 'approved' | 'rejected'
  startTime?: string
  endTime?: string
  startLocation?: string
  endLocation?: string
  metadata?: any
  createdAt?: string
  user?: {
    _id: string
    username: string
  }
}

interface Campaign {
  _id: string
  name: string
  country: string
  flag: string
  description: string
  status: string
  participants?: number
  type: string
  location: string
  imageUrl: string
  createdAt?: string
}

export default function AdminPage() {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [expandedMetadata, setExpandedMetadata] = useState<Set<string>>(new Set())
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [reviewStatus, setReviewStatus] = useState<"approved" | "rejected" | null>(null)
  const [qualityPoints, setQualityPoints] = useState<number>(0)
  const [reviewNotes, setReviewNotes] = useState<string>("")

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch all campaigns
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || ""
        if (!backendUrl) return

        const apiUrl = backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`
        const response = await fetch(`${apiUrl}api/v1/campaigns`)

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.data) {
            setCampaigns(result.data)
          }
        }
      } catch (error) {
        console.error("Error fetching campaigns:", error)
      }
    }

    fetchCampaigns()
  }, [])

  // Fetch submissions
  useEffect(() => {
    if (activeTab !== "all" || !mounted) return

    const fetchSubmissions = async () => {
      try {
        setLoading(true)
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || ""
        if (!backendUrl) {
          setLoading(false)
          return
        }

        const apiUrl = backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`
        
        // Fetch submissions for all campaigns
        const allSubmissions: Submission[] = []
        const fetchPromises = campaigns.map(async (campaign) => {
          const params = new URLSearchParams()
          if (statusFilter) params.append("status", statusFilter)
          params.append("page", "1")
          params.append("limit", "100") // Get all submissions

          try {
            const response = await fetch(
              `${apiUrl}api/v1/submissions/campaign/${campaign._id}?${params.toString()}`
            )

            if (response.ok) {
              const result = await response.json()
              if (result.success && result.data?.submissions) {
                // Normalize campaignId - ensure it's either string or object consistently
                return result.data.submissions.map((sub: any) => ({
                  ...sub,
                  campaignId: sub.campaignId || campaign._id, // Fallback to campaign._id if not populated
                }))
              }
            }
          } catch (error) {
            console.error(`Error fetching submissions for campaign ${campaign._id}:`, error)
            // Return empty array for failed fetch
            return []
          }
          return []
        })

        const results = await Promise.all(fetchPromises)
        results.forEach((subs) => {
          allSubmissions.push(...subs)
        })

        // Sort by most recent first (using createdAt)
        allSubmissions.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.startTime || 0).getTime()
          const dateB = new Date(b.createdAt || b.startTime || 0).getTime()
          return dateB - dateA
        })

        setSubmissions(allSubmissions)
      } catch (error) {
        console.error("Error fetching submissions:", error)
        // Only show error once, not for each campaign
        if (submissions.length === 0) {
          toast.error("Failed to fetch some submissions")
        }
      } finally {
        setLoading(false)
      }
    }

    if (campaigns.length > 0) {
      fetchSubmissions()
    } else {
      setLoading(false)
    }
  }, [activeTab, campaigns, statusFilter, mounted])

  const openReviewModal = (submission: Submission) => {
    setSelectedSubmission(submission)
    setReviewStatus(null)
    setQualityPoints(0)
    setReviewNotes("")
    setReviewModalOpen(true)
  }

  const closeReviewModal = () => {
    setReviewModalOpen(false)
    setSelectedSubmission(null)
    setReviewStatus(null)
    setQualityPoints(0)
    setReviewNotes("")
  }

  const handleReviewSubmission = async () => {
    if (!selectedSubmission || !reviewStatus) return
    if (processingIds.has(selectedSubmission._id)) return

    // Validate quality points for approved submissions
    if (reviewStatus === "approved" && (qualityPoints < 0 || qualityPoints > 50)) {
      toast.error("Quality points must be between 0 and 50")
      return
    }

    try {
      setProcessingIds((prev) => new Set(prev).add(selectedSubmission._id))
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || ""
      if (!backendUrl) {
        toast.error("Backend API not configured")
        return
      }

      const pointsAwarded = reviewStatus === "approved" ? 50 + qualityPoints : 0

      const apiUrl = backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`
      const response = await fetch(`${apiUrl}api/v1/submissions/${selectedSubmission._id}/review`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: reviewStatus,
          pointsAwarded,
          reviewNotes: reviewNotes || undefined,
        }),
      })

      if (response.ok) {
        toast.success(`Submission ${reviewStatus} successfully`)
        // Update local state
        setSubmissions((prev) =>
          prev.map((sub) =>
            sub._id === selectedSubmission._id ? { ...sub, status: reviewStatus } : sub
          )
        )
        closeReviewModal()
      } else {
        const errorData = await response.json().catch(() => ({ message: "Failed to review" }))
        toast.error(errorData.message || "Failed to review submission")
      }
    } catch (error: any) {
      console.error("Error reviewing submission:", error)
      toast.error("Failed to review submission")
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(selectedSubmission._id)
        return newSet
      })
    }
  }

  const totalPoints = reviewStatus === "approved" ? 50 + qualityPoints : 0

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A"
    try {
      const date = new Date(dateString)
      // Use consistent formatting to avoid hydration errors
      const year = date.getFullYear()
      const month = date.toLocaleDateString('en-US', { month: 'short' })
      const day = date.getDate()
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      return `${month} ${day}, ${year} ${hours}:${minutes}`
    } catch {
      return "N/A"
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

  const getCampaignName = (campaignId: string | { _id: string; name: string; country: string }) => {
    // Handle case where campaignId is an object (populated from API)
    if (typeof campaignId === 'object' && campaignId !== null) {
      return `${campaignId.name}, ${campaignId.country}`
    }
    
    // Handle case where campaignId is a string
    const campaign = campaigns.find((c) => c._id === campaignId)
    return campaign ? `${campaign.name}, ${campaign.country}` : String(campaignId)
  }

  const getCampaignFlag = (campaignId: string | { _id: string; flag: string }) => {
    // Handle case where campaignId is an object (populated from API)
    if (typeof campaignId === 'object' && campaignId !== null && 'flag' in campaignId) {
      return campaignId.flag || "🏳️"
    }
    
    // Handle case where campaignId is a string
    const campaign = campaigns.find((c) => c._id === campaignId)
    return campaign?.flag || "🏳️"
  }

  const getCampaignIdString = (campaignId: string | { _id: string }) => {
    if (typeof campaignId === 'object' && campaignId !== null) {
      return campaignId._id
    }
    return String(campaignId)
  }

  // Calculate statistics
  const stats = {
    activeCampaigns: campaigns.filter(c => c.status === "Active").length,
    totalSubmissions: submissions.length,
    totalApproved: submissions.filter(s => s.status === "approved").length,
    totalRejected: submissions.filter(s => s.status === "rejected").length,
    totalPending: submissions.filter(s => s.status === "pending").length,
    totalJoinedOverall: campaigns.reduce((sum, c) => sum + (c.participants || 0), 0),
    topCampaignBySubmissions: (() => {
      const campaignSubmissionCounts: Record<string, number> = {}
      submissions.forEach(sub => {
        const campaignId = typeof sub.campaignId === 'object' ? sub.campaignId._id : sub.campaignId
        campaignSubmissionCounts[campaignId] = (campaignSubmissionCounts[campaignId] || 0) + 1
      })
      const topCampaignId = Object.entries(campaignSubmissionCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
      return topCampaignId ? campaigns.find(c => c._id === topCampaignId) : null
    })(),
    topCampaignByJoined: campaigns.length > 0 ? campaigns.reduce((top, current) => 
      (current.participants || 0) > (top.participants || 0) ? current : top
    ) : null,
  }

  if (!mounted) {
    return (
      <div className="p-4 md:p-8 flex justify-center">
        <div className="w-full max-w-[95%] md:max-w-[90%]">
          <div className="flex justify-center items-center py-16">
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-[95%] md:max-w-[90%]">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Left Side: Submission Stats Card */}
          <div className="bg-gray-900 rounded-lg p-4 md:p-6 border border-white/10">
            <h3 className="text-sm md:text-base text-gray-400 mb-4 font-medium">Submission Statistics</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs md:text-sm text-gray-400">Total Submissions</p>
                <p className="text-xl md:text-2xl font-semibold text-white">{stats.totalSubmissions.toLocaleString()}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs md:text-sm text-gray-400">Total Approved</p>
                <p className="text-xl md:text-2xl font-semibold text-green-400">{stats.totalApproved.toLocaleString()}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs md:text-sm text-gray-400">Total Rejected</p>
                <p className="text-xl md:text-2xl font-semibold text-red-400">{stats.totalRejected.toLocaleString()}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs md:text-sm text-gray-400">Total Pending</p>
                <p className="text-xl md:text-2xl font-semibold text-yellow-400">{stats.totalPending.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Right Side: Two Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
            {/* Left Column */}
            <div className="space-y-4">
              <div className="bg-gray-900 rounded-lg p-4 md:p-6 border border-white/10">
                <h3 className="text-xs md:text-sm text-gray-400 mb-2">Active Campaigns</h3>
                <p className="text-2xl md:text-3xl font-semibold text-white">{stats.activeCampaigns.toLocaleString()}</p>
              </div>

              <div className="bg-gray-900 rounded-lg p-4 md:p-6 border border-white/10">
                <h3 className="text-xs md:text-sm text-gray-400 mb-3">Top Campaign by Submissions</h3>
                {stats.topCampaignBySubmissions ? (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{stats.topCampaignBySubmissions.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-base md:text-lg font-semibold text-white truncate">
                        {stats.topCampaignBySubmissions.name}, {stats.topCampaignBySubmissions.country}
                      </p>
                      <p className="text-gray-400 text-xs mt-1">ID: {stats.topCampaignBySubmissions._id.slice(0, 12)}...</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No submissions yet</p>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="bg-gray-900 rounded-lg p-4 md:p-6 border border-white/10">
                <h3 className="text-xs md:text-sm text-gray-400 mb-2">Total Joined Overall</h3>
                <p className="text-2xl md:text-3xl font-semibold text-white">{stats.totalJoinedOverall.toLocaleString()}</p>
              </div>

              <div className="bg-gray-900 rounded-lg p-4 md:p-6 border border-white/10">
                <h3 className="text-xs md:text-sm text-gray-400 mb-3">Top Campaign by Joined</h3>
                {stats.topCampaignByJoined ? (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{stats.topCampaignByJoined.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-base md:text-lg font-semibold text-white truncate">
                        {stats.topCampaignByJoined.name}, {stats.topCampaignByJoined.country}
                      </p>
                      <p className="text-gray-400 text-xs mt-1">{(stats.topCampaignByJoined.participants || 0).toLocaleString()} participants</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No campaigns yet</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-gray-900 rounded-lg border border-white/10 p-6 mb-6">
          <div className="flex gap-4 mb-6 border-b border-white/10">
            <button
              onClick={() => setActiveTab("all")}
              className={`pb-3 px-2 text-sm font-medium transition-colors ${
                activeTab === "all" ? "text-white border-b-2 border-[#6efcd9]" : "text-gray-400 hover:text-white"
              }`}
            >
              All Activity
            </button>
            <button
              onClick={() => setActiveTab("campaigns")}
              className={`pb-3 px-2 text-sm font-medium transition-colors ${
                activeTab === "campaigns" ? "text-white border-b-2 border-[#6efcd9]" : "text-gray-400 hover:text-white"
              }`}
            >
              All Campaigns
            </button>
          </div>

          {/* All Activity Tab - Submissions */}
          {activeTab === "all" ? (
            <>
              {/* Status Filter */}
              <div className="mb-4 flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-gray-800 border border-white/10 rounded px-1 py-2 text-white text-sm"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {loading ? (
                <div className="flex justify-center items-center py-16">
                  <p className="text-gray-400">Loading submissions...</p>
                </div>
              ) : submissions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Username</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Campaign</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Date</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Video</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((submission) => {
                        const isMetadataExpanded = expandedMetadata.has(submission._id)
                        const metadata = {
                          createdAt: submission.createdAt,
                          startTime: submission.startTime,
                          endTime: submission.endTime,
                          startLocation: submission.startLocation,
                          endLocation: submission.endLocation,
                          metadata: submission.metadata,
                        }

                        return (
                          <React.Fragment key={submission._id}>
                            <tr className="hover:bg-gray-800/50 transition-colors">
                              {/* Username */}
                              <td className="py-3 px-4">
                                <p className="text-white text-sm">
                                  {submission.user?.username || `${submission.userId.slice(0, 6)}...${submission.userId.slice(-4)}`}
                                </p>
                              </td>

                              {/* Campaign */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{getCampaignFlag(submission.campaignId)}</span>
                                  <p className="text-white text-sm">
                                    {getCampaignName(submission.campaignId)}
                                  </p>
                                </div>
                              </td>

                              {/* Date */}
                              <td className="py-3 px-4">
                                <p className="text-gray-400 text-sm whitespace-nowrap">
                                  {formatDate(submission.createdAt || submission.startTime)}
                                </p>
                              </td>

                              {/* Video */}
                              <td className="py-3 px-4">
                                {submission.videoUrl ? (
                                  <a
                                    href={submission.videoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#6efcd9] hover:underline text-sm"
                                  >
                                    View Video
                                  </a>
                                ) : (
                                  <span className="text-gray-500 text-sm">N/A</span>
                                )}
                              </td>

                              {/* Action */}
                              <td className="py-3 px-4">
                                {submission.status === "pending" ? (
                                  <button
                                    onClick={() => openReviewModal(submission)}
                                    disabled={processingIds.has(submission._id)}
                                    className="px-3 py-1 bg-[#6efcd9]/20 text-[#6efcd9] border border-[#6efcd9]/30 rounded text-xs font-medium hover:bg-[#6efcd9]/30 transition-colors disabled:opacity-50"
                                  >
                                    Review
                                  </button>
                                ) : (
                                  getStatusBadge(submission.status)
                                )}
                              </td>
                            </tr>
                            {/* Metadata Row */}
                            <tr className="border-b border-white/10">
                              <td colSpan={5} className="pb-2 px-4">
                                <button
                                  onClick={() => {
                                    setExpandedMetadata((prev) => {
                                      const newSet = new Set(prev)
                                      if (newSet.has(submission._id)) {
                                        newSet.delete(submission._id)
                                      } else {
                                        newSet.add(submission._id)
                                      }
                                      return newSet
                                    })
                                  }}
                                  className="text-[#6efcd9] hover:text-[#5ee8c9] text-xs font-medium transition-colors"
                                >
                                  {isMetadataExpanded ? "▼ Hide metadata" : "▶ View metadata"}
                                </button>
                                {isMetadataExpanded && (
                                  <div className="mt-2 p-3 bg-gray-900/50 rounded border border-white/10">
                                    <pre className="text-xs text-gray-300 overflow-x-auto">
                                      {JSON.stringify(metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </td>
                            </tr>
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
                  <Sparkles size={64} className="text-gray-600 mb-4" />
                  <p className="text-gray-400">No submissions found</p>
                </div>
              )}
            </>
          ) : (
            /* All Campaigns Tab */
            <div className="space-y-4">
              {campaigns.length > 0 ? (
                campaigns.map((campaign) => (
                  <Link
                    key={campaign._id}
                    href={`/app/${campaign._id}`}
                    className="flex items-center gap-4 px-4 py-3 rounded-lg bg-gray-800/50 border border-white/5 hover:bg-gray-800 transition-colors"
                  >
                    {/* Campaign Info with Flag, City, and Country */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl flex-shrink-0">{campaign.flag}</span>
                        <p className="text-white font-medium">
                          {campaign.name}, {campaign.country}
                        </p>
                      </div>
                      <p className="text-gray-400 text-sm mt-1">{campaign.description}</p>
                    </div>

                    {/* Status and Participants */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-gray-400 text-xs mb-1">Status</p>
                        <p className={`text-sm font-medium ${
                          campaign.status === "Active" ? "text-green-400" :
                          campaign.status === "Paused" ? "text-yellow-400" :
                          "text-gray-400"
                        }`}>
                          {campaign.status}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-400 text-xs mb-1">Participants</p>
                        <p className="text-white text-sm font-medium">
                          {(campaign.participants || 0).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-gray-400 text-sm whitespace-nowrap">
                        {formatDate(campaign.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
                  <Sparkles size={64} className="text-gray-600 mb-4" />
                  <p className="text-gray-400">No campaigns found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {reviewModalOpen && selectedSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-white/20 max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Review submission</h2>

            {/* Approve/Reject Options */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setReviewStatus("approved")}
                className={`flex-1 px-4 py-2 rounded border transition-colors ${
                  reviewStatus === "approved"
                    ? "bg-green-500/20 text-green-400 border-green-500/50"
                    : "bg-gray-800 text-gray-400 border-white/10 hover:border-green-500/30"
                }`}
              >
                Approve
              </button>
              <button
                onClick={() => setReviewStatus("rejected")}
                className={`flex-1 px-4 py-2 rounded border transition-colors ${
                  reviewStatus === "rejected"
                    ? "bg-red-500/20 text-red-400 border-red-500/50"
                    : "bg-gray-800 text-gray-400 border-white/10 hover:border-red-500/30"
                }`}
              >
                Reject
              </button>
            </div>

            {/* Approve Section */}
            {reviewStatus === "approved" && (
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3">
                  <label className="text-white text-sm font-medium whitespace-nowrap">Quality:</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={qualityPoints}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0
                      setQualityPoints(Math.min(Math.max(value, 0), 50))
                    }}
                    className="flex-1 bg-gray-800 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6efcd9]/50"
                    placeholder="0-50"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-white text-sm font-medium whitespace-nowrap">Note:</label>
                  <input
                    type="text"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="flex-1 bg-gray-800 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6efcd9]/50"
                    placeholder="Add review notes..."
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <p className="text-gray-400 text-sm">
                    Total points: <span className="text-white font-medium">50 (base) + {qualityPoints} (quality) = {totalPoints}</span>
                  </p>
                  <button
                    onClick={handleReviewSubmission}
                    disabled={processingIds.has(selectedSubmission._id)}
                    className="px-4 py-2 bg-[#6efcd9] text-gray-900 rounded font-medium hover:bg-[#5ee8c9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}

            {/* Reject Section */}
            {reviewStatus === "rejected" && (
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3">
                  <label className="text-white text-sm font-medium whitespace-nowrap">Note:</label>
                  <input
                    type="text"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="flex-1 bg-gray-800 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6efcd9]/50"
                    placeholder="Add review notes..."
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <p className="text-gray-400 text-sm">
                    Total points: <span className="text-white font-medium">0</span>
                  </p>
                  <button
                    onClick={handleReviewSubmission}
                    disabled={processingIds.has(selectedSubmission._id)}
                    className="px-4 py-2 bg-red-500 text-white rounded font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={closeReviewModal}
              className="w-full mt-4 px-4 py-2 bg-gray-800 text-gray-400 rounded font-medium hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ToastContainer position="bottom-right" />
    </div>
  )
}

