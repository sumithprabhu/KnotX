import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { CasperWalletWrapper } from "@/components/casper-wallet-wrapper"
import { RainbowWalletProvider } from "@/components/rainbow-wallet-provider"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "KnotX - Connecting Value Across Networks",
  description: "KnotX is the leading interoperability platform connecting value across networks. Seamlessly bridge assets and data across blockchains and traditional systems.",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/logo.png",
        type: "image/png",
      },
    ],
    apple: "/logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <RainbowWalletProvider>
            <CasperWalletWrapper>
              {children}
            </CasperWalletWrapper>
          </RainbowWalletProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
