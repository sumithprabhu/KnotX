"use client"

import React, { useState, useEffect } from "react"
import { motion } from "motion/react"
import Lottie from "lottie-react"
import { useReadContract } from "wagmi"
import { parseAbi } from "viem"

// Chain colors
const CASPER_COLOR = "#6efcd9" // Primary green/teal
const ETHEREUM_COLOR = "#627EEA" // Ethereum blue

interface RacingTrackProps {
  network: "casper" | "sepolia"
  count: number
  maxCount: number
}

function RacingTrack({ network, count, maxCount }: RacingTrackProps) {
  const networkName = network === "casper" ? "Casper" : "Ethereum"
  const networkColor = network === "casper" ? CASPER_COLOR : ETHEREUM_COLOR
  
  // Calculate position: max count reaches 70% of track, others relative to that
  const maxPosition = 70 // 70% is the maximum position for the leading horse
  const position = maxCount > 0 ? (count / maxCount) * maxPosition : 0

  // Load horse animation
  const [horseData, setHorseData] = useState<any>(null)

  useEffect(() => {
    fetch("/mypink horse.json")
      .then((res) => res.json())
      .then((data) => {
        setHorseData(data)
      })
      .catch((err) => {
        console.error("Failed to load horse animation:", err)
        setHorseData(null)
      })
  }, [])

  return (
    <div className="relative w-full mb-6">
      {/* Network Label */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: networkColor }}
          />
          <span className="text-sm font-semibold text-foreground">{networkName}</span>
        </div>
        <span className="text-lg font-bold text-white">
          {count.toLocaleString()}
        </span>
      </div>

      {/* Racing Track */}
      <div className="relative w-full h-24 bg-gradient-to-r from-background/80 via-background/60 to-background/80 rounded-lg overflow-hidden">
        {/* Road markings */}
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-0.5 bg-border/30 relative">
            {/* Dashed center line */}
            <div className="absolute inset-0 flex gap-2">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="h-full w-8 bg-primary/20"
                  style={{ marginLeft: `${i * 48}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Random black lines below horse for running effect */}
        <div className="absolute bottom-2 left-0 right-0 h-1 overflow-hidden">
          {[...Array(15)].map((_, i) => {
            const lineWidth = Math.random() * 20 + 10
            const lineLeft = Math.random() * 100
            const opacity = Math.random() * 0.5 + 0.3
            return (
              <motion.div
                key={i}
                className="absolute h-full bg-black"
                style={{
                  left: `${lineLeft}%`,
                  width: `${lineWidth}px`,
                  opacity: opacity,
                }}
                animate={{
                  x: [0, -100, -200],
                  opacity: [opacity, opacity * 0.5, 0],
                }}
                transition={{
                  duration: Math.random() * 2 + 1,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                  ease: "linear",
                }}
              />
            )
          })}
        </div>

        {/* Horse Animation - moved up and made larger */}
        <motion.div
          className="absolute"
          style={{
            left: `${Math.min(position, maxPosition)}%`,
            top: "20%", // Moved up to align with path
            width: "88px", // 10% larger (80px * 1.1 = 88px)
            height: "88px", // 10% larger
            zIndex: 10,
            transform: "translateX(-50%) translateY(-50%)",
          }}
          initial={{ x: 0 }}
          animate={{ x: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
        >
          {horseData ? (
            <div 
              className="relative w-full h-full"
              style={{
                transform: "scaleX(-1)", // Flip horizontally to face right
                filter: network === "casper" 
                  ? `hue-rotate(160deg) saturate(1.6) brightness(1.2)` // Casper: teal/green (#6efcd9)
                  : `hue-rotate(220deg) saturate(1.3) brightness(1.1)`, // Ethereum: blue (#627EEA)
              }}
            >
              <Lottie
                animationData={horseData}
                loop={true}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          ) : (
            // Fallback: Colored circle with network icon
            <div
              className="w-full h-full rounded-full flex items-center justify-center text-2xl font-bold shadow-lg"
              style={{
                backgroundColor: networkColor,
                color: "#000",
              }}
            >
              {network === "casper" ? "C" : "E"}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

// UniversalCounter contract ABI (only the counter function)
const UNIVERSAL_COUNTER_ABI = parseAbi([
  "function counter() view returns (uint256)"
])

// UniversalCounter contract address on Sepolia
const SEPOLIA_UNIVERSAL_COUNTER_ADDRESS = 
  process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RECEIVER_ADDRESS || 
  "0xD3B1c72361f03d5F138C2c768AfdF700266bb39a"

// Casper receiver contract hash (UniversalCounter on Casper)
const CASPER_RECEIVER_CONTRACT_HASH = 
  process.env.NEXT_PUBLIC_CASPER_TESTNET_RECEIVER_ADDRESS || 
  "hash-2ede3272d048e81c344c68f65db55141e1132d70da6443770ac0de443534d36e"

// Casper RPC URL
const CASPER_RPC_URL = 
  process.env.NEXT_PUBLIC_CASPER_TESTNET_RPC_URL || 
  "https://node.testnet.cspr.cloud/rpc"

// Named key for counter in Casper contract
const KEY_COUNTER = "count"

export function UniversalCounterDisplay() {
  const [casperCount, setCasperCount] = useState(7)
  const [isLoadingCasper, setIsLoadingCasper] = useState(false)
  
  // Smart polling state
  const [pollInterval, setPollInterval] = useState(30000) // Default: 30 seconds
  const [previousCasperCount, setPreviousCasperCount] = useState(7)
  const [previousSepoliaCount, setPreviousSepoliaCount] = useState(10)
  const [isFastPolling, setIsFastPolling] = useState(false) // Track if we're in fast polling mode
  
  // Listen for transaction events to trigger fast polling
  useEffect(() => {
    const handleTransactionSent = () => {
      console.log("🔍 Transaction sent - switching to fast polling (10s)")
      setPollInterval(10000) // Switch to 10 seconds
      setIsFastPolling(true)
    }

    // Listen for custom event when transaction is sent
    window.addEventListener('transaction-sent', handleTransactionSent)
    
    return () => {
      window.removeEventListener('transaction-sent', handleTransactionSent)
    }
  }, [])

  // Fetch counter from Sepolia contract with smart polling
  const { data: sepoliaCounter, isLoading: isLoadingSepolia, refetch: refetchSepolia } = useReadContract({
    address: SEPOLIA_UNIVERSAL_COUNTER_ADDRESS as `0x${string}`,
    abi: UNIVERSAL_COUNTER_ABI,
    functionName: "counter",
    query: {
      refetchInterval: pollInterval, // Dynamic polling interval
    },
  })

  // Convert BigInt to number for display
  const sepoliaCount = sepoliaCounter ? Number(sepoliaCounter) : 10 // Default to 10 if not loaded yet

  // Detect changes in Sepolia counter
  useEffect(() => {
    if (sepoliaCount !== previousSepoliaCount && previousSepoliaCount !== 10) {
      console.log(`🔍 Sepolia counter changed: ${previousSepoliaCount} → ${sepoliaCount}`)
      if (isFastPolling) {
        console.log("🔍 Change detected - switching back to normal polling (30s)")
        setPollInterval(30000)
        setIsFastPolling(false)
      }
      setPreviousSepoliaCount(sepoliaCount)
    }
  }, [sepoliaCount, previousSepoliaCount, isFastPolling])

  // Detect changes in Casper counter and adjust polling
  useEffect(() => {
    if (casperCount !== previousCasperCount && previousCasperCount !== 7) {
      console.log(`🔍 Casper counter changed: ${previousCasperCount} → ${casperCount}`)
      if (isFastPolling) {
        console.log("🔍 Change detected - switching back to normal polling (30s)")
        setPollInterval(30000)
        setIsFastPolling(false)
      }
      setPreviousCasperCount(casperCount)
    }
  }, [casperCount, previousCasperCount, isFastPolling])

  // Fetch counter from Casper contract via API route (to avoid CORS)
  useEffect(() => {
    const fetchCasperCounter = async () => {
      try {
        setIsLoadingCasper(true)
        
        // Call Next.js API route to query counter (avoids CORS)
        const response = await fetch('/api/casper/query-counter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contractHash: CASPER_RECEIVER_CONTRACT_HASH,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          const errorMessage = errorData.error || errorData.err || 'Failed to fetch counter'
          const errorCode = errorData.code ? `Code: ${errorData.code}` : ''
          throw new Error(errorCode ? `${errorCode}, err: ${errorMessage}` : errorMessage)
        }

        const data = await response.json()
        if (data.counter !== undefined) {
          const newCount = data.counter
          setCasperCount(newCount)
          console.log("🔍 Casper counter fetched:", newCount)
        } else {
          console.warn("⚠️ Counter not found in response")
        }
        setIsLoadingCasper(false)
      } catch (error) {
        console.error("❌ Failed to fetch Casper counter:", error)
        setIsLoadingCasper(false)
      }
    }

    // Fetch immediately
    fetchCasperCounter()
    
    // Set up interval with dynamic polling
    const interval = setInterval(fetchCasperCounter, pollInterval)
    
    return () => clearInterval(interval)
  }, [pollInterval])

  // Calculate max count for positioning (largest count reaches 70% of track)
  const maxCount = Math.max(casperCount, sepoliaCount, 1) // Ensure at least 1 to avoid division by zero

  return (
    <div className="w-full max-w-2xl mx-auto relative">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h2 className="text-3xl font-bold text-foreground mb-2">Universal Counter</h2>
        <p className="text-sm text-muted-foreground">Live cross-chain race</p>
      </motion.div>

      {/* Common Start line on the left - shared for both tracks, color same as Get Started button */}
      <div 
        className="absolute left-0 w-8 flex items-center justify-center z-30" 
        style={{ 
          top: "calc(3rem + 2rem)", // Below title
          bottom: "3rem", // Above legend area
          backgroundColor: "#6efcd9", // Same as Get Started button
          borderRight: "3px solid #5ee8c9" // Slightly darker border
        }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-black whitespace-nowrap -rotate-90 px-3 py-2 rounded-md shadow-xl">
          START
        </div>
      </div>

      {/* Common Finish line on the right - shared for both tracks, at the very end */}
      <div
        className="absolute right-0 w-8 z-30"
        style={{ 
          top: "calc(3rem + 2rem)", // Below title
          bottom: "3rem", // Above legend area
          borderLeft: "2px solid black", 
          borderRight: "2px solid black" 
        }}
      >
        {/* Checkered pattern */}
        <div className="absolute inset-0 grid grid-cols-2" style={{ gridTemplateRows: "repeat(8, 1fr)" }}>
          {[...Array(16)].map((_, i) => {
            const row = Math.floor(i / 2)
            const col = i % 2
            const isBlack = (row + col) % 2 === 0
            return (
              <div
                key={i}
                className={isBlack ? "bg-black" : "bg-white"}
              />
            )
          })}
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-white whitespace-nowrap -rotate-90 bg-black/95 px-3 py-2 rounded-md border-2 border-white/60 shadow-xl">
          FINISH
        </div>
      </div>

      {/* Racing Tracks - with padding for start/finish lines */}
      <div className="space-y-6 pl-10 pr-10">
        <RacingTrack network="sepolia" count={sepoliaCount} maxCount={maxCount} />
        <RacingTrack network="casper" count={casperCount} maxCount={maxCount} />
      </div>
    </div>
  )
}
