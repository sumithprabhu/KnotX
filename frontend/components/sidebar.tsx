"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Home, User } from "lucide-react"
import { MdLeaderboard } from "react-icons/md"

export function Sidebar() {
  const pathname = usePathname()

  const links = [
    { href: "/app", label: "Home", icon: Home },
    { href: "/app/leaderboard", label: "Leaderboard", icon: MdLeaderboard },
    { href: "/app/profile", label: "Profile", icon: User },
  ]

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-52 border-r border-white/20 bg-black p-6 flex-col">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <Image src="/logo.png" alt="Dashmint" width={32} height={32} className="h-8 w-8" />
        <span className="text-lg font-semibold">Dashmint</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-lg px-4 py-2 transition-colors ${
                isActive ? "bg-[#6efcd9] text-black font-medium" : "text-gray-400 hover:text-[#6efcd9] hover:bg-white/5"
              }`}
            >
              <Icon size={20} className={isActive ? "text-black" : ""} />
              <span>{link.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer Links */}
      <div className="space-y-2 border-t border-white/20 pt-4">
        <Link href="#faq" className="block text-sm text-gray-400 hover:text-[#6efcd9] px-4 py-2 transition-colors">
          FAQ
        </Link>
        <Link href="#terms" className="block text-sm text-gray-400 hover:text-[#6efcd9] px-4 py-2 transition-colors">
          Terms of Service
        </Link>
        <Link href="#privacy" className="block text-sm text-gray-400 hover:text-[#6efcd9] px-4 py-2 transition-colors">
          Privacy Policy
        </Link>
      </div>
    </aside>
  )
}
