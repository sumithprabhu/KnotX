"use client"

import type React from "react"
import { useState } from "react"
import { ChevronDown } from "lucide-react"

const faqData = [
  {
    question: "What is KnotX and how does it work?",
    answer:
      "KnotX is an interoperability protocol that enables secure communication and asset transfers between different blockchain networks. It acts as a universal bridge, allowing developers and users to seamlessly move data, tokens, and execute cross-chain smart contracts across EVM, non-EVM, and traditional systems with cryptographic security guarantees.",
  },
  {
    question: "Which blockchains does KnotX support?",
    answer:
      "KnotX supports a wide range of blockchain networks including Ethereum, Solana, Casper, and other major chains. Our protocol is designed to be chain-agnostic, meaning we can integrate with any blockchain that supports our message passing interface. We continuously expand our network coverage based on community demand.",
  },
  {
    question: "How secure is KnotX?",
    answer:
      "KnotX uses cryptographic proofs and consensus mechanisms to ensure the security of all cross-chain transactions. Our protocol has been audited by leading security firms and uses battle-tested cryptographic primitives. All messages are verified on-chain before execution, providing strong security guarantees without relying on trusted intermediaries.",
  },
  {
    question: "How do I integrate KnotX into my application?",
    answer:
      "KnotX provides comprehensive SDKs and developer tools for easy integration. You can use our JavaScript, Python, or Rust SDKs to send messages and execute cross-chain operations. Our documentation includes code examples, API references, and step-by-step guides to get you started quickly.",
  },
  {
    question: "What are the costs for using KnotX?",
    answer:
      "Transaction costs vary based on the networks involved and gas prices at the time of execution. KnotX charges minimal protocol fees to maintain the network infrastructure. You'll pay standard gas fees on the source and destination chains, plus a small protocol fee. Exact costs are displayed before transaction confirmation.",
  },
  {
    question: "Can KnotX handle high-volume transactions?",
    answer:
      "Yes, KnotX is built for production workloads and can handle high transaction volumes. Our infrastructure is designed with scalability in mind, using efficient message routing and batching techniques. We support both individual transactions and bulk operations for enterprise use cases.",
  },
]

interface FAQItemProps {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
}

const FAQItem = ({ question, answer, isOpen, onToggle }: FAQItemProps) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    onToggle()
  }
  return (
    <div
      className={`w-full bg-[rgba(231,236,235,0.08)] shadow-[0px_2px_4px_rgba(0,0,0,0.16)] overflow-hidden rounded-[10px] outline outline-1 outline-border outline-offset-[-1px] transition-all duration-500 ease-out cursor-pointer`}
      onClick={handleClick}
    >
      <div className="w-full px-5 py-[18px] pr-4 flex justify-between items-center gap-5 text-left transition-all duration-300 ease-out">
        <div className="flex-1 text-foreground text-base font-medium leading-6 break-words">{question}</div>
        <div className="flex justify-center items-center">
          <ChevronDown
            className={`w-6 h-6 text-muted-foreground-dark transition-all duration-500 ease-out ${isOpen ? "rotate-180 scale-110" : "rotate-0 scale-100"}`}
          />
        </div>
      </div>
      <div
        className={`overflow-hidden transition-all duration-500 ease-out ${isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}
        style={{
          transitionProperty: "max-height, opacity, padding",
          transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div
          className={`px-5 transition-all duration-500 ease-out ${isOpen ? "pb-[18px] pt-2 translate-y-0" : "pb-0 pt-0 -translate-y-2"}`}
        >
          <div className="text-foreground/80 text-sm font-normal leading-6 break-words">{answer}</div>
        </div>
      </div>
    </div>
  )
}

export function FAQSection() {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set())
  const toggleItem = (index: number) => {
    const newOpenItems = new Set(openItems)
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index)
    } else {
      newOpenItems.add(index)
    }
    setOpenItems(newOpenItems)
  }
  return (
    <section className="w-full pt-[66px] pb-20 md:pb-40 px-5 relative flex flex-col justify-center items-center">
      <div className="w-[300px] h-[500px] absolute top-[150px] left-1/2 -translate-x-1/2 origin-top-left rotate-[-33.39deg] bg-primary/10 blur-[100px] z-0" />
      <div className="self-stretch pt-8 pb-8 md:pt-14 md:pb-14 flex flex-col justify-center items-center gap-2 relative z-10">
        <div className="flex flex-col justify-start items-center gap-4">
          <h2 className="w-full max-w-[435px] text-center text-foreground text-4xl font-semibold leading-10 break-words">
            Frequently Asked Questions
          </h2>
          <p className="self-stretch text-center text-muted-foreground text-sm font-medium leading-[18.20px] break-words">
            Everything you need to know about KnotX and cross-chain interoperability
          </p>
        </div>
      </div>
      <div className="w-full max-w-[600px] pt-0.5 pb-10 flex flex-col justify-start items-start gap-4 relative z-10">
        {faqData.map((faq, index) => (
          <FAQItem key={index} {...faq} isOpen={openItems.has(index)} onToggle={() => toggleItem(index)} />
        ))}
      </div>
    </section>
  )
}
