"use client"

import { use, useState, useRef, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Video, Camera, Shield, AlertTriangle, MapPin, Play, Square, Upload } from "lucide-react"
import { LuAlarmClock } from "react-icons/lu"
import { toast } from "react-toastify"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import { useUser } from "@/contexts/user-context"
import { usePrivy } from "@privy-io/react-auth"
import { useWallets } from "@privy-io/react-auth"

interface LocationData {
  latitude: number
  longitude: number
}

type Step = "ready" | "permissions" | "preview" | "recording" | "stopped" | "upload" | "review"

export default function RecordPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  // Handle params - it might be a Promise in Next.js 15+
  const resolvedParams = params instanceof Promise ? use(params) : params
  const campaignId = resolvedParams?.id ? String(resolvedParams.id) : ""

  const { userData, refreshUserData } = useUser()
  const { user } = usePrivy()
  const { wallets } = useWallets()

  const [step, setStep] = useState<Step>("ready")
  const [cameraPermission, setCameraPermission] = useState<"pending" | "granted" | "denied">("pending")
  const [locationPermission, setLocationPermission] = useState<"pending" | "granted" | "denied">("pending")
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [startLocation, setStartLocation] = useState<LocationData | null>(null)
  const [endLocation, setEndLocation] = useState<LocationData | null>(null)
  const [startTimestamp, setStartTimestamp] = useState<Date | null>(null)
  const [endTimestamp, setEndTimestamp] = useState<Date | null>(null)
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  
  // Upload form state
  const [uploadStartLocation, setUploadStartLocation] = useState<string>("")
  const [uploadEndLocation, setUploadEndLocation] = useState<string>("")
  const [uploadStartTime, setUploadStartTime] = useState<string>("")
  const [uploadEndTime, setUploadEndTime] = useState<string>("")
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null)
  const [checkbox1, setCheckbox1] = useState(false)
  const [checkbox2, setCheckbox2] = useState(false)
  const [checkbox3, setCheckbox3] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Location autocomplete state
  const [startLocationSuggestions, setStartLocationSuggestions] = useState<any[]>([])
  const [endLocationSuggestions, setEndLocationSuggestions] = useState<any[]>([])
  const [showStartSuggestions, setShowStartSuggestions] = useState(false)
  const [showEndSuggestions, setShowEndSuggestions] = useState(false)
  const [startLocationCoords, setStartLocationCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [endLocationCoords, setEndLocationCoords] = useState<{ lat: number; lon: number } | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const previewRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const locationWatchIdRef = useRef<number | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastKnownLocationRef = useRef<LocationData | null>(null)

  // Removed checkPermissions - we only check when user clicks the button

  const handleStartRecordingClick = () => {
    setStep("permissions")
    // Don't check permissions automatically - let user click the button
  }

  const handleUploadRecordingClick = () => {
    setStep("upload")
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith("video/")) {
      setUploadedVideo(file)
    } else {
      toast.error("Please select a valid video file")
    }
  }

  const fetchLocationSuggestions = async (query: string, isStart: boolean) => {
    if (query.length < 3) {
      if (isStart) {
        setStartLocationSuggestions([])
        setShowStartSuggestions(false)
      } else {
        setEndLocationSuggestions([])
        setShowEndSuggestions(false)
      }
      return
    }

    try {
      const response = await fetch(
        `/api/location-search?q=${encodeURIComponent(query)}`
      )
      if (!response.ok) {
        throw new Error("Failed to fetch location suggestions")
      }
      const data = await response.json()
      
      if (isStart) {
        setStartLocationSuggestions(data)
        setShowStartSuggestions(true)
      } else {
        setEndLocationSuggestions(data)
        setShowEndSuggestions(true)
      }
    } catch (error) {
      console.error("Error fetching location suggestions:", error)
    }
  }

  const handleLocationInputChange = (value: string, isStart: boolean) => {
    if (isStart) {
      setUploadStartLocation(value)
      setStartLocationCoords(null)
    } else {
      setUploadEndLocation(value)
      setEndLocationCoords(null)
    }

    // Debounce the API call
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchLocationSuggestions(value, isStart)
    }, 300)
  }

  const handleLocationSelect = (suggestion: any, isStart: boolean) => {
    const displayName = suggestion.display_name
    const coords = { lat: parseFloat(suggestion.lat), lon: parseFloat(suggestion.lon) }
    
    if (isStart) {
      setUploadStartLocation(displayName)
      setStartLocationCoords(coords)
      setShowStartSuggestions(false)
    } else {
      setUploadEndLocation(displayName)
      setEndLocationCoords(coords)
      setShowEndSuggestions(false)
    }
  }

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

  const joinCampaign = async (campaignId: string, walletAddress: string): Promise<boolean> => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || ""
      if (!backendUrl) {
        // Silently fail - just for tracking
        return true
      }

      const apiUrl = backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`
      const response = await fetch(`${apiUrl}api/v1/campaigns/${campaignId}/join/${walletAddress}`, {
        method: "POST",
      })

      // 400 means already joined, which is okay - proceed with submission
      if (response.status === 400 || response.ok) {
        return true // Already joined or successfully joined - both are fine
      } else {
        // For any other error, still return true to allow submission
        // Join is just for tracking, shouldn't block submission
        console.warn("Join campaign returned non-200/400 status:", response.status)
        return true
      }
    } catch (error: any) {
      // Silently fail - join is just for tracking, shouldn't block submission
      console.error("Error joining campaign (non-blocking):", error)
      return true // Always return true to allow submission
    }
  }

  const submitToBackend = async (
    ipfsHash: string,
    startTime: Date,
    endTime: Date,
    startLocationStr: string,
    endLocationStr: string,
    startLocationCoords: { lat: number; lon: number } | null,
    endLocationCoords: { lat: number; lon: number } | null,
    duration: number
  ) => {
    const walletAddress = getCurrentUserAddress()
    if (!walletAddress) {
      throw new Error("Wallet address not found")
    }

    // Ensure user is joined to campaign before submission (non-blocking)
    // 400 (already joined) is okay - proceed with submission
    await joinCampaign(campaignId, walletAddress)

    // Format locations with lat/lng
    const formatLocation = (locationStr: string, coords: { lat: number; lon: number } | null) => {
      if (coords) {
        return JSON.stringify({
          address: locationStr,
          latitude: coords.lat,
          longitude: coords.lon
        })
      }
      return locationStr
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API || ""
    if (!backendUrl) {
      throw new Error("Backend API URL not configured")
    }

    // Format IPFS URL using gateway
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || ""
    if (!gatewayUrl) {
      throw new Error("Gateway URL not configured")
    }
    const formattedVideoUrl = `${gatewayUrl}/ipfs/${ipfsHash}`

    const apiUrl = backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`
    const response = await fetch(`${apiUrl}api/v1/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        campaignId,
        userId: walletAddress,
        videoUrl: formattedVideoUrl,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        startLocation: formatLocation(startLocationStr, startLocationCoords),
        endLocation: formatLocation(endLocationStr, endLocationCoords),
        metadata: {
          duration,
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Failed to submit" }))
      throw new Error(errorData.message || "Failed to submit to backend")
    }

    return await response.json()
  }

  const uploadVideoToIPFS = async (videoBlob: Blob | File, fileName: string): Promise<string | null> => {
    try {
      setIsUploading(true)
      
      // Use FormData to upload directly to Pinata
      const formData = new FormData()
      formData.append("file", videoBlob, fileName)

      // Pinata direct upload endpoint using JWT
      const pinataJWT = process.env.NEXT_PUBLIC_PINATA_JWT || ""

      if (!pinataJWT) {
        throw new Error("Pinata JWT not configured. Please add NEXT_PUBLIC_PINATA_JWT to your .env file and restart the dev server.")
      }

      const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pinataJWT}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "Failed to upload video to IPFS")
      }

      const data = await response.json()
      return data.IpfsHash
    } catch (error) {
      console.error("Error uploading to IPFS:", error)
      return null
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmitRecording = async () => {
    if (!recordedBlobUrl || !startTimestamp || !endTimestamp || !startLocation || !endLocation) {
      toast.error("Missing required recording data")
      return
    }

    const walletAddress = getCurrentUserAddress()
    if (!walletAddress) {
      toast.error("Wallet address not found")
      return
    }

    try {
      // Ensure user is joined to campaign before submission (non-blocking)
      // 400 (already joined) is okay - proceed with submission
      await joinCampaign(campaignId, walletAddress)
      
      // Fetch the blob and convert to File
      const response = await fetch(recordedBlobUrl)
      const blob = await response.blob()
      const file = new File([blob], `recording-${Date.now()}.webm`, { type: "video/webm" })

      // Upload to IPFS
      const ipfsHash = await uploadVideoToIPFS(file, file.name)

      if (!ipfsHash) {
        toast.error("Failed to upload video to IPFS. Please try again.")
        return
      }

      // Calculate duration in seconds
      const duration = Math.floor((endTimestamp.getTime() - startTimestamp.getTime()) / 1000)

      // Format location strings
      const startLocationStr = startLocation ? `${startLocation.latitude}, ${startLocation.longitude}` : "Unknown"
      const endLocationStr = endLocation ? `${endLocation.latitude}, ${endLocation.longitude}` : "Unknown"

      // Submit to backend
      await submitToBackend(
        ipfsHash,
        startTimestamp,
        endTimestamp,
        startLocationStr,
        endLocationStr,
        startLocation ? { lat: startLocation.latitude, lon: startLocation.longitude } : null,
        endLocation ? { lat: endLocation.latitude, lon: endLocation.longitude } : null,
        duration
      )

      // Refresh user data to get updated activity
      await refreshUserData()

      toast.success("Submission successful! Your video is under review.")
      setStep("review")
    } catch (error: any) {
      console.error("Error submitting recording:", error)
      toast.error(error.message || "Failed to submit recording. Please try again.")
    }
  }

  const handleSubmitUpload = async () => {
    if (!uploadStartLocation || !uploadEndLocation || !uploadStartTime || !uploadEndTime || !uploadedVideo) {
      toast.error("Please fill in all required fields")
      return
    }
    if (!startLocationCoords || !endLocationCoords) {
      toast.error("Please select a location from the suggestions")
      return
    }
    if (!checkbox1 || !checkbox2 || !checkbox3) {
      toast.error("Please accept all required agreements")
      return
    }

    const walletAddress = getCurrentUserAddress()
    if (!walletAddress) {
      toast.error("Wallet address not found")
      return
    }

    try {
      // Ensure user is joined to campaign before submission (non-blocking)
      // 400 (already joined) is okay - proceed with submission
      await joinCampaign(campaignId, walletAddress)
      
      // Upload video to IPFS
      const ipfsHash = await uploadVideoToIPFS(uploadedVideo, uploadedVideo.name)

      if (!ipfsHash) {
        toast.error("Failed to upload video to IPFS. Please try again.")
        return
      }

      // Parse timestamps
      const startTime = new Date(uploadStartTime)
      const endTime = new Date(uploadEndTime)
      
      // Calculate duration in seconds
      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000)

      // Submit to backend
      await submitToBackend(
        ipfsHash,
        startTime,
        endTime,
        uploadStartLocation,
        uploadEndLocation,
        startLocationCoords,
        endLocationCoords,
        duration
      )

      // Refresh user data to get updated activity
      await refreshUserData()

      toast.success("Submission successful! Your video is under review.")
      setStep("review")
    } catch (error: any) {
      console.error("Error submitting upload:", error)
      toast.error(error.message || "Failed to submit upload. Please try again.")
    }
  }

  const handleContinueToPreview = () => {
    if (cameraPermission === "granted" && locationPermission === "granted") {
      setStep("preview")
    }
  }

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      setCameraPermission("granted")
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(console.error)
      }
    } catch (error: any) {
      console.error("Camera permission error:", error)
      // Only set denied if user explicitly denied
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setCameraPermission("denied")
      } else {
        // For other errors, keep as pending (user might not have interacted yet)
        setCameraPermission("pending")
      }
    }
  }

  const requestLocationPermission = async () => {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      })
      setLocationPermission("granted")
    } catch (error: any) {
      console.error("Location permission error:", error)
      // Only set denied if user explicitly denied (code 1 = PERMISSION_DENIED)
      if (error.code === 1) {
        setLocationPermission("denied")
      } else {
        // For other errors (timeout, position unavailable, etc.), keep as pending
        setLocationPermission("pending")
      }
    }
  }

  const startLocationTracking = () => {
    if (locationWatchIdRef.current !== null) return

    // Get initial location
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }
        setStartLocation(location)
      },
      (error) => {
        console.error("Error getting start location:", error)
      },
      { enableHighAccuracy: true }
    )

    // Start watching position
    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const location: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }
        // Store last known location
        lastKnownLocationRef.current = location
        // Update end location continuously while recording
        if (isRecording) {
          setEndLocation(location)
        }
      },
      (error) => {
        console.error("Location tracking error:", error)
      },
      { enableHighAccuracy: true }
    )
  }

  const stopLocationTracking = () => {
    if (locationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current)
      locationWatchIdRef.current = null
    }
  }

  const handleStartRecording = async () => {
    if (!streamRef.current) return

    try {
      // Start location tracking
      startLocationTracking()

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: "video/webm;codecs=vp8,opus",
      })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        // Create blob from all chunks
        const blob = new Blob(chunksRef.current, { type: "video/webm" })
        const url = URL.createObjectURL(blob)
        setRecordedBlobUrl(url)
        
        // Set video source and wait for it to load
        if (previewRef.current) {
          previewRef.current.src = url
          previewRef.current.load()
          
          // Wait for video to be ready
          const handleLoadedMetadata = () => {
            setIsStopping(false)
            if (previewRef.current) {
              previewRef.current.removeEventListener("loadedmetadata", handleLoadedMetadata)
            }
          }
          
          previewRef.current.addEventListener("loadedmetadata", handleLoadedMetadata)
          
          // Fallback timeout
          setTimeout(() => {
            setIsStopping(false)
          }, 2000)
        } else {
          setIsStopping(false)
        }
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
        }
      }

      // Start recording with timeslice to ensure data is collected
      mediaRecorder.start(1000) // Request data every second
      setIsRecording(true)
      setStep("recording")
      setStartTimestamp(new Date())
      setRecordingTime(0)

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (error) {
      console.error("Error starting recording:", error)
    }
  }

  const handleStopRecording = async () => {
    if (mediaRecorderRef.current && isRecording && !isStopping) {
      setIsStopping(true)
      
      // Update UI immediately to prevent stuck view
      setIsRecording(false)
      setEndTimestamp(new Date())
      
      // Stop timer immediately
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }

      // Request final data chunk and stop recording (this will trigger onstop callback)
      if (mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.requestData() // Request any remaining data
          mediaRecorderRef.current.stop()
        } catch (error) {
          console.error("Error stopping recorder:", error)
          // Still try to create blob from existing chunks
          if (chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { type: "video/webm" })
            const url = URL.createObjectURL(blob)
            setRecordedBlobUrl(url)
            if (previewRef.current) {
              previewRef.current.src = url
              previewRef.current.load()
            }
            setIsStopping(false)
          }
        }
      }

      // Stop location tracking
      stopLocationTracking()

      // Get final location asynchronously (non-blocking)
      // Use last known location as fallback
      if (lastKnownLocationRef.current) {
        setEndLocation(lastKnownLocationRef.current)
      }

      // Try to get current position with short timeout (non-blocking)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setEndLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
        },
        (error) => {
          console.error("Error getting end location:", error)
          // Keep the last known location if getCurrentPosition fails
        },
        { enableHighAccuracy: true, timeout: 2000, maximumAge: 0 }
      )

      // Move to stopped step immediately (preview will load when blob is ready)
      setStep("stopped")
    }
  }

  const handlePlayPreview = () => {
    if (previewRef.current) {
      if (isPlayingPreview) {
        previewRef.current.pause()
      } else {
        previewRef.current.play()
      }
      setIsPlayingPreview(!isPlayingPreview)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const formatTimestamp = (date: Date | null) => {
    if (!date) return "N/A"
    return date.toLocaleString()
  }

  // Effect to set video stream when in preview or recording
  useEffect(() => {
    if ((step === "preview" || step === "recording") && streamRef.current && videoRef.current) {
      const video = videoRef.current
      video.srcObject = streamRef.current
      
      const playVideo = async () => {
        try {
          await video.play()
        } catch (error) {
          console.error("Error playing video:", error)
          setTimeout(() => {
            video.play().catch(console.error)
          }, 100)
        }
      }
      
      playVideo()
    }
  }, [step])

  // Effect to load preview video when blob URL is ready
  useEffect(() => {
    if (step === "stopped" && recordedBlobUrl && previewRef.current && !isStopping) {
      const video = previewRef.current
      if (video.src !== recordedBlobUrl) {
        video.src = recordedBlobUrl
        video.load()
      }
    }
  }, [step, recordedBlobUrl, isStopping])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      stopLocationTracking()
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      // Clean up blob URL
      if (recordedBlobUrl) {
        URL.revokeObjectURL(recordedBlobUrl)
      }
    }
  }, [recordedBlobUrl])

  return (
    <div className="p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-[95%] md:max-w-[70%] space-y-6 md:space-y-8">
        {/* Back button */}
        <div className="mb-4">
          <Link href={`/app/${campaignId}`} className="text-gray-400 hover:text-white transition-colors inline-flex items-center gap-2">
            <ArrowLeft size={20} />
            <span>Back to Campaign</span>
          </Link>
        </div>

        {step === "ready" && (
          <>
            {/* Header */}
            <div className="text-center mb-6 md:mb-8">
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 md:mb-4">Get ready to record</h1>
              <p className="text-gray-400 text-base md:text-lg">Follow these tips for better dashcam video submissions.</p>
            </div>

            {/* Tips container */}
            <div className="bg-gray-900 rounded-2xl p-8 space-y-6 border border-white/10">
              {/* Tip 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-black border border-[#6efcd9] text-[#6efcd9]">
                    <Video size={24} />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Clear visibility</h3>
                  <p className="text-gray-400">Ensure your dashcam lens is clean and provides clear footage of road conditions and traffic.</p>
                </div>
              </div>

              {/* Tip 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-black border border-[#6efcd9] text-[#6efcd9]">
                    <Camera size={24} />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Stable recording</h3>
                  <p className="text-gray-400">Record during normal driving conditions with minimal camera shake for best quality.</p>
                </div>
              </div>

              {/* Tip 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-black border border-[#6efcd9] text-[#6efcd9]">
                    <Shield size={24} />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Privacy & Safety</h3>
                  <p className="text-gray-400">Only submit footage from public roads. Ensure no personal information or license plates are clearly visible if required.</p>
                </div>
              </div>

              {/* Tip 4 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-black border border-[#6efcd9] text-[#6efcd9]">
                    <AlertTriangle size={24} />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Video Quality</h3>
                  <p className="text-gray-400">Submit videos in good resolution (minimum 720p). Low-quality or corrupted files may be rejected.</p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleStartRecordingClick}
                className="flex-[2] bg-[#6efcd9] text-black py-4 rounded-full text-lg font-semibold hover:bg-[#5ee8c9] transition-colors"
              >
                Start Recording
              </button>
              <button
                onClick={handleUploadRecordingClick}
                className="flex-[1] bg-white text-black py-4 rounded-full text-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                Upload Recording
              </button>
            </div>
          </>
        )}

        {step === "permissions" && (
          <>
            {/* Permissions Section */}
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 md:mb-4">Permissions Required</h1>
              <p className="text-gray-400 text-lg">We need your permission to record and verify your dashcam footage.</p>
            </div>

            <div className="space-y-6">
              {/* Camera Permission */}
              <div className="bg-gray-900 rounded-2xl p-6 border border-white/10 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-black border border-[#6efcd9] text-[#6efcd9]">
                    <Camera size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">Camera Permission</h3>
                    <p className="text-sm text-gray-400">Allow access to your camera to record dashcam footage</p>
                  </div>
                </div>
                {cameraPermission === "pending" && (
                  <button
                    onClick={requestCameraPermission}
                    className="w-full bg-[#6efcd9] text-black py-3 rounded-full font-semibold hover:bg-[#5ee8c9] transition-colors"
                  >
                    Grant Camera Permission
                  </button>
                )}
                {cameraPermission === "granted" && (
                  <div className="text-green-400 text-center py-2 font-semibold">
                    Camera Permission Granted
                  </div>
                )}
                {cameraPermission === "denied" && (
                  <>
                    <div className="text-red-400 text-center py-2 font-semibold mb-2">
                      Camera Permission Denied
                    </div>
                    <button
                      onClick={requestCameraPermission}
                      className="w-full bg-[#6efcd9] text-black py-3 rounded-full font-semibold hover:bg-[#5ee8c9] transition-colors"
                    >
                      Grant Camera Permission
                    </button>
                  </>
                )}
              </div>

              {/* Location Permission */}
              <div className="bg-gray-900 rounded-2xl p-6 border border-white/10 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-black border border-[#6efcd9] text-[#6efcd9]">
                    <MapPin size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">Location Permission</h3>
                    <p className="text-sm text-gray-400">Allow access to your location to verify the legitimacy of recording. Location tracking will stop once recording is off.</p>
                  </div>
                </div>
                {locationPermission === "pending" && (
                  <button
                    onClick={requestLocationPermission}
                    className="w-full bg-[#6efcd9] text-black py-3 rounded-full font-semibold hover:bg-[#5ee8c9] transition-colors"
                  >
                    Grant Location Permission
                  </button>
                )}
                {locationPermission === "granted" && (
                  <div className="text-green-400 text-center py-2 font-semibold">
                    Location Permission Granted
                  </div>
                )}
                {locationPermission === "denied" && (
                  <>
                    <div className="text-red-400 text-center py-2 font-semibold mb-2">
                      Location Permission Denied
                    </div>
                    <button
                      onClick={requestLocationPermission}
                      className="w-full bg-[#6efcd9] text-black py-3 rounded-full font-semibold hover:bg-[#5ee8c9] transition-colors"
                    >
                      Grant Location Permission
                    </button>
                  </>
                )}
              </div>

              {/* Continue Button - Only shown when both permissions are granted */}
              {cameraPermission === "granted" && locationPermission === "granted" && (
                <div className="pt-4">
                  <button
                    onClick={handleContinueToPreview}
                    className="w-full bg-[#6efcd9] text-black py-4 rounded-full text-lg font-semibold hover:bg-[#5ee8c9] transition-colors"
                  >
                    Continue to Preview
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {(step === "preview" || step === "recording" || step === "stopped") && (
          <>
            {/* Recording Interface */}
            <div className="space-y-6">
              {/* Camera/Preview View - Square (60% size) */}
              <div className="relative w-[60%] mx-auto aspect-square bg-black rounded-2xl overflow-hidden border-2 border-white/10 flex items-center justify-center">
                {(step === "preview" || step === "recording") && (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-contain bg-black"
                  />
                )}
                {step === "stopped" && (
                  <>
                    {isStopping ? (
                      <div className="text-white text-center">
                        <p className="text-lg">Processing recording...</p>
                      </div>
                    ) : (
                      <video
                        ref={previewRef}
                        controls={false}
                        className="w-full h-full object-contain bg-black"
                        onPlay={() => setIsPlayingPreview(true)}
                        onPause={() => setIsPlayingPreview(false)}
                        onLoadedData={() => {
                          // Video is ready to play
                          if (previewRef.current) {
                            previewRef.current.currentTime = 0
                          }
                        }}
                        onError={(e) => {
                          console.error("Video load error:", e)
                          setIsStopping(false)
                        }}
                        preload="metadata"
                      />
                    )}
                  </>
                )}
                {step === "recording" && (
                  <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2 z-10">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                    <span className="font-semibold">Recording {formatTime(recordingTime)}</span>
                  </div>
                )}
              </div>

              {/* Start/Stop/Play Button */}
              <div className="flex justify-center">
                {step === "preview" && (
                  <button
                    onClick={handleStartRecording}
                    className="bg-[#6efcd9] text-black px-6 py-2 rounded-full text-lg font-semibold hover:bg-[#5ee8c9] transition-colors"
                  >
                    Start Recording
                  </button>
                )}
                {step === "recording" && (
                  <button
                    onClick={handleStopRecording}
                    disabled={isStopping}
                    className="bg-red-600 text-white px-6 py-2 rounded-full text-lg font-semibold hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Square size={20} fill="white" />
                    {isStopping ? "Stopping..." : "Stop Recording"}
                  </button>
                )}
                {step === "stopped" && (
                  <div className="flex gap-4 items-center">
                    <button
                      onClick={handlePlayPreview}
                      className="bg-[#6efcd9] text-black px-6 py-2 rounded-full text-lg font-semibold hover:bg-[#5ee8c9] transition-colors flex items-center gap-2"
                    >
                      {isPlayingPreview ? (
                        <>
                          <Square size={20} fill="black" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play size={20} fill="black" />
                          Play
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleSubmitRecording}
                      disabled={isUploading}
                      className="bg-white text-black px-6 py-2 rounded-full text-lg font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploading ? "Submitting Recording..." : "Submit"}
                    </button>
                  </div>
                )}
              </div>

              {/* Details Window */}
              {(step === "recording" || step === "stopped") && (
                <div className="bg-gray-900 rounded-2xl p-6 border border-white/10">
                  <h3 className="text-xl font-semibold text-white mb-4">Recording Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Time</p>
                      <p className="text-white font-medium">{formatTime(recordingTime)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Start Timestamp</p>
                      <p className="text-white font-medium">{formatTimestamp(startTimestamp)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Start Location</p>
                      <p className="text-white font-medium">
                        {startLocation
                          ? `${startLocation.latitude.toFixed(6)}, ${startLocation.longitude.toFixed(6)}`
                          : "N/A"}
                      </p>
                    </div>
                    {step === "stopped" && (
                      <>
                        <div>
                          <p className="text-gray-400 text-sm mb-1">End Timestamp</p>
                          <p className="text-white font-medium">{formatTimestamp(endTimestamp)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm mb-1">End Location</p>
                          <p className="text-white font-medium">
                            {endLocation
                              ? `${endLocation.latitude.toFixed(6)}, ${endLocation.longitude.toFixed(6)}`
                              : "N/A"}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {step === "upload" && (
          <>
            {/* Upload Form Section */}
            <div className="text-center mb-6 md:mb-8">
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 md:mb-4">Upload Recording</h1>
              <p className="text-gray-400 text-base md:text-lg">Fill in the details and upload your dashcam video recording.</p>
            </div>

            <div className="bg-gray-900 rounded-2xl p-8 border border-white/10 space-y-6">
              {/* Location Fields - Two Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Start Location */}
                <div className="relative">
                  <label className="block text-white font-semibold mb-2">
                    Select Start Location <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={uploadStartLocation}
                    onChange={(e) => handleLocationInputChange(e.target.value, true)}
                    onFocus={() => {
                      if (startLocationSuggestions.length > 0) {
                        setShowStartSuggestions(true)
                      }
                    }}
                    onBlur={() => {
                      // Delay to allow click on suggestion
                      setTimeout(() => setShowStartSuggestions(false), 200)
                    }}
                    placeholder="Type location name (e.g., New York)"
                    className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#6efcd9] transition-colors"
                  />
                  {showStartSuggestions && startLocationSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-white/20 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {startLocationSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleLocationSelect(suggestion, true)}
                          className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/10 last:border-b-0"
                        >
                          <div className="text-white font-medium">{suggestion.display_name}</div>
                          <div className="text-gray-400 text-sm mt-1">
                            {parseFloat(suggestion.lat).toFixed(4)}, {parseFloat(suggestion.lon).toFixed(4)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {startLocationCoords && (
                    <p className="text-xs text-gray-400 mt-1">
                      Coordinates: {startLocationCoords.lat.toFixed(6)}, {startLocationCoords.lon.toFixed(6)}
                    </p>
                  )}
                </div>

                {/* End Location */}
                <div className="relative">
                  <label className="block text-white font-semibold mb-2">
                    Select End Location <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={uploadEndLocation}
                    onChange={(e) => handleLocationInputChange(e.target.value, false)}
                    onFocus={() => {
                      if (endLocationSuggestions.length > 0) {
                        setShowEndSuggestions(true)
                      }
                    }}
                    onBlur={() => {
                      // Delay to allow click on suggestion
                      setTimeout(() => setShowEndSuggestions(false), 200)
                    }}
                    placeholder="Type location name (e.g., London)"
                    className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#6efcd9] transition-colors"
                  />
                  {showEndSuggestions && endLocationSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-white/20 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {endLocationSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleLocationSelect(suggestion, false)}
                          className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/10 last:border-b-0"
                        >
                          <div className="text-white font-medium">{suggestion.display_name}</div>
                          <div className="text-gray-400 text-sm mt-1">
                            {parseFloat(suggestion.lat).toFixed(4)}, {parseFloat(suggestion.lon).toFixed(4)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {endLocationCoords && (
                    <p className="text-xs text-gray-400 mt-1">
                      Coordinates: {endLocationCoords.lat.toFixed(6)}, {endLocationCoords.lon.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>

              {/* Time Fields - Two Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Start Time */}
                <div>
                  <label className="block text-white font-semibold mb-2">
                    Select Start Time <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={uploadStartTime}
                      onChange={(e) => setUploadStartTime(e.target.value)}
                      className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#6efcd9] transition-colors pr-12"
                    />
                    {uploadStartTime && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          // Close the calendar popup by blurring the input
                          const input = e.currentTarget.previousElementSibling as HTMLInputElement
                          if (input) {
                            input.blur()
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#6efcd9] text-black px-2 py-1.5 rounded text-xs font-medium hover:bg-[#5ee8c9] transition-colors flex items-center justify-center"
                        title="Confirm date"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                </div>

                {/* End Time */}
                <div>
                  <label className="block text-white font-semibold mb-2">
                    Select End Time <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={uploadEndTime}
                      onChange={(e) => setUploadEndTime(e.target.value)}
                      className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#6efcd9] transition-colors pr-12"
                    />
                    {uploadEndTime && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          // Close the calendar popup by blurring the input
                          const input = e.currentTarget.previousElementSibling as HTMLInputElement
                          if (input) {
                            input.blur()
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#6efcd9] text-black px-2 py-1.5 rounded text-xs font-medium hover:bg-[#5ee8c9] transition-colors flex items-center justify-center"
                        title="Confirm date"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Upload Video */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  Upload Video <span className="text-red-400">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-black border-2 border-dashed border-white/20 rounded-lg px-4 py-6 text-white hover:border-[#6efcd9] transition-colors flex items-center justify-center gap-2"
                >
                  <Upload size={24} />
                  {uploadedVideo ? uploadedVideo.name : "Click to upload video file"}
                </button>
                {uploadedVideo && (
                  <p className="text-sm text-gray-400 mt-2">
                    Selected: {uploadedVideo.name} ({(uploadedVideo.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              {/* Checkboxes */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                {/* Checkbox 1 */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkbox1}
                    onChange={(e) => setCheckbox1(e.target.checked)}
                    className="mt-1 w-5 h-5 min-w-[1.25rem] min-h-[1.25rem] flex-shrink-0 rounded border-2 border-[#6efcd9] bg-black text-[#6efcd9] focus:ring-[#6efcd9] focus:ring-offset-0 cursor-pointer appearance-none checked:bg-[#6efcd9] checked:border-[#6efcd9] relative"
                    style={{
                      backgroundImage: checkbox1 ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 20 20\' fill=\'black\'%3E%3Cpath fill-rule=\'evenodd\' d=\'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z\' clip-rule=\'evenodd\'/%3E%3C/svg%3E")' : 'none',
                      backgroundSize: 'contain',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat'
                    }}
                  />
                  <span className="text-white text-sm">
                    I confirm that the video is completely owned by me, and I have the full rights to submit this content. 
                    In case of any copyright issues or disputes, the video will be immediately taken down from the platform.
                  </span>
                </label>

                {/* Checkbox 2 */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkbox2}
                    onChange={(e) => setCheckbox2(e.target.checked)}
                    className="mt-1 w-5 h-5 min-w-[1.25rem] min-h-[1.25rem] flex-shrink-0 rounded border-2 border-[#6efcd9] bg-black text-[#6efcd9] focus:ring-[#6efcd9] focus:ring-offset-0 cursor-pointer appearance-none checked:bg-[#6efcd9] checked:border-[#6efcd9] relative"
                    style={{
                      backgroundImage: checkbox2 ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 20 20\' fill=\'black\'%3E%3Cpath fill-rule=\'evenodd\' d=\'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z\' clip-rule=\'evenodd\'/%3E%3C/svg%3E")' : 'none',
                      backgroundSize: 'contain',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat'
                    }}
                  />
                  <span className="text-white text-sm">
                    I confirm that I have provided legitimate and accurate data above, including location coordinates 
                    and timestamps that correspond to the actual recording.
                  </span>
                </label>

                {/* Checkbox 3 */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkbox3}
                    onChange={(e) => setCheckbox3(e.target.checked)}
                    className="mt-1 w-5 h-5 min-w-[1.25rem] min-h-[1.25rem] flex-shrink-0 rounded border-2 border-[#6efcd9] bg-black text-[#6efcd9] focus:ring-[#6efcd9] focus:ring-offset-0 cursor-pointer appearance-none checked:bg-[#6efcd9] checked:border-[#6efcd9] relative"
                    style={{
                      backgroundImage: checkbox3 ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 20 20\' fill=\'black\'%3E%3Cpath fill-rule=\'evenodd\' d=\'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z\' clip-rule=\'evenodd\'/%3E%3C/svg%3E")' : 'none',
                      backgroundSize: 'contain',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat'
                    }}
                  />
                  <span className="text-white text-sm">
                    I agree to the{" "}
                    <Link
                      href="/terms-and-conditions"
                      target="_blank"
                      className="text-[#6efcd9] hover:underline"
                    >
                      Terms and Conditions
                    </Link>
                    {" "}and understand the platform's policies regarding data submission and usage.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  onClick={handleSubmitUpload}
                  disabled={!checkbox1 || !checkbox2 || !checkbox3 || !uploadStartLocation || !uploadEndLocation || !uploadStartTime || !uploadEndTime || !uploadedVideo || !startLocationCoords || !endLocationCoords || isUploading}
                  className="w-full bg-[#6efcd9] text-black py-4 rounded-full text-lg font-semibold hover:bg-[#5ee8c9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? "Submitting Recording..." : "Submit Recording"}
                </button>
              </div>
            </div>
          </>
        )}

        {step === "review" && (
          <>
            {/* Review Interface */}
            <div className="text-center space-y-8">
              {/* Icon */}
              <div className="flex justify-center">
                <LuAlarmClock size={80} className="text-[#6efcd9]" />
              </div>

              {/* Under Review Text */}
              <div>
                <h2 className="text-3xl font-bold text-white mb-4">Under Review</h2>
              </div>

              {/* Description */}
              <div className="max-w-2xl mx-auto">
                <p className="text-gray-400 text-lg leading-relaxed">
                  Your submission is under review and it can take nearly 5 to 6 hours for review, until then you can explore more campaigns. 
                  You can see your submission in your profile section.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Link
                  href="/app"
                  className="bg-[#6efcd9] text-black px-6 md:px-8 py-3 rounded-full text-base md:text-lg font-semibold hover:bg-[#5ee8c9] transition-colors text-center"
                >
                  Home Page
                </Link>
                <Link
                  href="/app/profile"
                  className="bg-white text-black px-6 md:px-8 py-3 rounded-full text-base md:text-lg font-semibold hover:bg-gray-100 transition-colors text-center"
                >
                  Profile
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </div>
  )
}
