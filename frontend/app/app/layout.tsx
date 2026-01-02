import type React from "react"
import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { MobileNavbar } from "@/components/mobile-navbar"
import { AuthGuard } from "@/components/auth-guard"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <div className="flex h-screen bg-black">
        <Sidebar />
        <MobileNavbar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto mt-16 lg:ml-52 bg-black pt-16 lg:pt-0">{children}</main>
        </div>
      </div>
    </AuthGuard>
  )
}
