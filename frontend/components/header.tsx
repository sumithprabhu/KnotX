"use client"

import type React from "react"
import Image from "next/image"
import { usePrivy } from "@privy-io/react-auth"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import Link from "next/link" // Import Link for client-side navigation

export function Header() {
  const { authenticated, login } = usePrivy()

  const navItems = [
    { name: "Features", href: "#features-section" },
  ]

  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    const targetId = href.substring(1) // Remove '#' from href
    const targetElement = document.getElementById(targetId)
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth" })
    }
  }

  const handleLogin = () => {
    login()
  }

  return (
    <header className="w-full py-4 px-6">
      <div className="max-w-[90%] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Dashmint" width={32} height={32} className="h-8 w-8" />
            <span className="text-foreground text-xl font-semibold">Dashmint</span>
          </div>
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={(e) => handleScroll(e, item.href)} // Add onClick handler
                className="text-[#888888] hover:text-foreground px-4 py-2 rounded-full font-medium transition-colors"
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {authenticated ? (
            <Link href="/app" className="hidden md:block">
              <Button className="bg-[#6efcd9] text-black hover:bg-[#5ee8c9] hover:scale-110 px-6 py-2 rounded-full font-medium shadow-sm transition-transform duration-200">
                Dashboard
              </Button>
            </Link>
          ) : (
            <Button
              onClick={handleLogin}
              className="hidden md:block bg-[#6efcd9] text-black hover:bg-[#5ee8c9] hover:scale-110 px-6 py-2 rounded-full font-medium shadow-sm transition-transform duration-200"
            >
              Login
            </Button>
          )}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="text-foreground">
                <Menu className="h-7 w-7" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-background border-t border-border text-foreground">
              <SheetHeader>
                <SheetTitle className="text-left text-xl font-semibold text-foreground">Navigation</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-6">
                {navItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={(e) => handleScroll(e, item.href)} // Add onClick handler
                    className="text-[#888888] hover:text-foreground justify-start text-lg py-2"
                  >
                    {item.name}
                  </Link>
                ))}
                {authenticated ? (
                  <Link href="/app" className="w-full mt-4">
                    <Button className="bg-[#6efcd9] text-black hover:bg-[#5ee8c9] hover:scale-105 px-6 py-2 rounded-full font-medium shadow-sm w-full transition-transform duration-200">
                      Dashboard
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={handleLogin}
                    className="bg-[#6efcd9] text-black hover:bg-[#5ee8c9] hover:scale-105 px-6 py-2 rounded-full font-medium shadow-sm w-full mt-4 transition-transform duration-200"
                  >
                    Login
                  </Button>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
