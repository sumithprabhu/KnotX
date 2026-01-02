"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronRight } from "lucide-react"
import { CampaignCard } from "@/components/campaign-card"

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

export default function AppPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || ""
        if (!backendUrl) {
          console.error("NEXT_PUBLIC_BACKEND_API is not set")
          setLoading(false)
          return
        }

        const apiUrl = backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`
        const response = await fetch(`${apiUrl}api/v1/campaigns`)

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.data) {
            console.log("Fetched campaigns:", result.data)
            setCampaigns(result.data)
          }
        } else {
          console.error("Failed to fetch campaigns:", response.status)
        }
      } catch (error) {
        console.error("Error fetching campaigns:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCampaigns()
  }, [])

  // Calculate country counts
  const countryCounts = campaigns.reduce((acc, campaign) => {
    acc[campaign.country] = (acc[campaign.country] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Get unique countries
  const countries = Array.from(new Set(campaigns.map((c) => c.country))).sort()

  // Filter campaigns by selected country
  const filteredCampaigns = selectedCountry
    ? campaigns.filter((campaign) => campaign.country === selectedCountry)
    : campaigns

  // Transform campaigns for CampaignCard component
  const transformedCampaigns = filteredCampaigns.map((campaign) => ({
    id: campaign._id,
    country: campaign.country,
    flag: campaign.flag,
    city: campaign.name,
    description: campaign.description,
    joined: campaign.participants || 0,
    image: campaign.imageUrl,
  }))

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isDropdownOpen])

  return (
    <div className="p-4 md:p-8 space-y-8 md:space-y-12">
      {/* All Campaigns */}
      <section>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <h2 className="text-2xl md:text-3xl font-semibold text-white">All Campaigns</h2>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="text-sm text-gray-400 hover:text-[#6efcd9] hover:border-[#6efcd9] flex items-center gap-2 px-4 py-2 border border-white/10 rounded-lg transition-colors"
            >
              {selectedCountry ? selectedCountry : "All Cities"}
              <ChevronRight
                size={16}
                className={`transition-transform ${isDropdownOpen ? "rotate-90" : ""}`}
              />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 top-12 w-56 bg-black border-2 border-[#6efcd9]/30 rounded-lg shadow-2xl overflow-hidden backdrop-blur-sm z-50">
                <div className="bg-gradient-to-b from-black to-black/95 p-1">
                  <button
                    onClick={() => {
                      setSelectedCountry(null)
                      setIsDropdownOpen(false)
                    }}
                    className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                      selectedCountry === null
                        ? "bg-[#6efcd9] text-black font-medium"
                        : "text-white hover:bg-[#6efcd9] hover:text-black"
                    }`}
                  >
                    All Cities ({campaigns.length})
                  </button>
                  <div className="h-px bg-white/10 my-1" />
                  {countries.map((country) => (
                    <button
                      key={country}
                      onClick={() => {
                        setSelectedCountry(country)
                        setIsDropdownOpen(false)
                      }}
                      className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                        selectedCountry === country
                          ? "bg-[#6efcd9] text-black font-medium"
                          : "text-white hover:bg-[#6efcd9] hover:text-black"
                      }`}
                    >
                      {country} ({countryCounts[country]})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-400">Loading campaigns...</div>
          </div>
        ) : transformedCampaigns.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {transformedCampaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        ) : (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-400">No campaigns found</div>
          </div>
        )}
      </section>
    </div>
  )
}
