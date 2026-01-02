"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { Home, User, Menu, X } from "lucide-react"
import { MdLeaderboard } from "react-icons/md"
import { IoPersonSharp } from "react-icons/io5"
import { usePrivy } from "@privy-io/react-auth"
import { useUser } from "@/contexts/user-context"

export function MobileNavbar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = usePrivy()
  const { userData } = useUser()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  const links = [
    { href: "/app", label: "Home", icon: Home },
    { href: "/app/leaderboard", label: "Leaderboard", icon: MdLeaderboard },
    { href: "/app/profile", label: "Profile", icon: User },
  ]

  const footerLinks = [
    { href: "/terms-and-conditions", label: "Terms" },
    { href: "#privacy", label: "Privacy" },
    { href: "#faq", label: "FAQ" },
  ]

  // Get user display name from userData or Privy user
  const userDisplayName = userData?.username || user?.email?.address?.split("@")[0] || user?.wallet?.address || "User"
  const userInitials = userData?.username?.charAt(0).toUpperCase() || userDisplayName.charAt(0).toUpperCase()

  return (
    <>
      {/* Mobile Navbar Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b border-white/20 bg-black z-50 flex items-center justify-between px-4">
        {/* Logo and Points */}
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Dashmint" width={24} height={24} className="h-6 w-6" />
          <span className="text-lg font-semibold text-white">Dashmint</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-white">{(userData?.totalPoints || 0).toLocaleString()} pts</div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="h-10 w-10 rounded-full bg-[#6efcd9] text-black flex items-center justify-center hover:bg-[#5ee8c9] transition-colors"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-40" onClick={() => setIsOpen(false)}>
          <div
            ref={menuRef}
            className="fixed right-0 top-0 h-full w-80 bg-black border-l border-white/20 shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User Profile Section */}
            <div className="p-6 border-b border-white/20">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-[#6efcd9] text-black flex items-center justify-center text-lg font-semibold">
                  {user?.email?.address ? (
                    <IoPersonSharp size={24} />
                  ) : (
                    <span>{userInitials}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{userDisplayName}</p>
                  <p className="text-gray-400 text-sm">{(userData?.totalPoints || 0).toLocaleString()} pts</p>
                </div>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="p-4 space-y-2">
              {links.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                      isActive
                        ? "bg-[#6efcd9] text-black font-medium"
                        : "text-gray-400 hover:text-[#6efcd9] hover:bg-white/5"
                    }`}
                  >
                    <Icon size={20} className={isActive ? "text-black" : ""} />
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </nav>

            {/* Footer Links */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/20 space-y-2 bg-black">
              {footerLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="block text-sm text-gray-400 hover:text-[#6efcd9] px-4 py-2 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <button
                onClick={async () => {
                  setIsOpen(false)
                  await logout()
                  router.push("/")
                }}
                className="w-full text-left text-sm text-gray-400 hover:text-[#6efcd9] px-4 py-2 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


