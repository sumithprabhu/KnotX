"use client"

import type React from "react"
import { useState } from "react"
import { ChevronDown } from "lucide-react"

const faqData = [
  {
    question: "What is Dashmint and how does it work?",
    answer:
      "Dashmint is a platform that allows you to record or upload your dashcam footage and contribute to AI research campaigns. Your videos are instantly registered on-chain with Story Protocol, securing your intellectual property rights. You earn points and rewards every time your footage is used for AI model training or research projects.",
  },
  {
    question: "How do I submit my dashcam videos?",
    answer:
      "You can either record videos directly from your phone through our app or upload pre-recorded clips from your dashcam. Simply join an active campaign, record or upload your video with location and timestamp data, and submit it. Your video will be uploaded to IPFS and registered on-chain automatically.",
  },
  {
    question: "How is my video protected and who owns it?",
    answer:
      "Your videos are instantly secured with Story Protocol, which creates an on-chain record of your ownership. This verifies your intellectual property rights forever. You maintain ownership of your content, and AI companies can only use it with your explicit consent through our transparent rights system.",
  },
  {
    question: "How do I earn rewards and points?",
    answer:
      "You earn points automatically every time your footage powers AI research or model training projects. Points are awarded based on video quality, campaign participation, and usage. You can track your earnings in real-time through your profile dashboard and see exactly how your data is being used.",
  },
  {
    question: "Is my data private and secure?",
    answer:
      "Yes, absolutely. All data is handled with full transparency and user consent. Your videos are stored securely on IPFS, and we use legally safe, consent-backed data practices. AI developers can only access your footage through our transparent rights system, ensuring you always know how your data is being used.",
  },
  {
    question: "Who can use my dashcam footage?",
    answer:
      "AI companies and researchers can access cleaned, structured real-world driving data through our platform. However, they can only use your footage with your explicit consent, and all usage is tracked transparently. The data is provided in a structured format ready for vision and mapping models, while maintaining your ownership rights.",
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
            Everything you need to know about Dashmint and how to monetize your dashcam footage
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
