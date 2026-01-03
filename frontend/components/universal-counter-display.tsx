"use client"

import React, { useState, useEffect } from "react"
import { motion } from "motion/react"
import Lottie from "lottie-react"

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
        <span className="text-lg font-bold" style={{ color: networkColor }}>
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

export function UniversalCounterDisplay() {
  const [casperCount, setCasperCount] = useState(7)
  const [sepoliaCount, setSepoliaCount] = useState(10)

  // Fixed scores - no incrementing
  useEffect(() => {
    setCasperCount(7)
    setSepoliaCount(10)
  }, [])

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
