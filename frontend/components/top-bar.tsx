"use client"

import { useState, useRef, useEffect } from "react"
import { IoPersonSharp } from "react-icons/io5"
import Link from "next/link"
import { usePrivy } from "@privy-io/react-auth"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"

export function TopBar() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { logout } = usePrivy()
  const router = useRouter()
  const { userData } = useUser()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  return (
    <header className="hidden lg:flex fixed right-0 top-0 h-16 border-b border-white/20 bg-black items-center justify-end px-8 w-[calc(100%-13rem)] z-50">
      {/* Right side */}
      <div className="flex items-center gap-4 relative">
        <div className="text-sm text-white">{(userData?.totalPoints || 0).toLocaleString()} pts</div>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="h-10 w-10 rounded-full bg-[#6efcd9] text-black flex items-center justify-center hover:bg-[#5ee8c9] transition-colors"
          >
            <IoPersonSharp size={20} />
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div className="absolute right-0 top-12 w-48 bg-black border-2 border-[#6efcd9]/30 rounded-lg shadow-2xl overflow-hidden backdrop-blur-sm">
              <div className="bg-gradient-to-b from-black to-black/95 p-1">
                <Link
                  href="/app/profile"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-3 text-white hover:bg-[#6efcd9] hover:text-black transition-colors rounded-md"
                >
                  Profile
                </Link>
                <div className="h-px bg-white/10 my-1" />
                <button
                  onClick={async () => {
                    setIsOpen(false)
                    await logout()
                    router.push("/")
                  }}
                  className="w-full text-left px-4 py-3 text-white hover:bg-[#6efcd9] hover:text-black transition-colors rounded-md"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
