import Image from "next/image"
import AiCodeReviews from "./bento/ai-code-reviews"
import RealtimeCodingPreviews from "./bento/real-time-previews"
import OneClickIntegrationsIllustration from "./bento/one-click-integrations-illustration"
import MCPConnectivityIllustration from "./bento/mcp-connectivity-illustration" // Updated import
import EasyDeployment from "./bento/easy-deployment"
import ParallelCodingAgents from "./bento/parallel-agents" // Updated import

const BentoCard = ({ title, description, Component, image, featureIndex }) => {
  // Determine image styling based on feature index
  const getImageStyle = () => {
    if (featureIndex === 3) { // Feature 4 (0-indexed)
      return {
        transform: 'scale(1)',
      }
    } else if (featureIndex === 4) { // Feature 5
      return {
        transform: 'scale(1.05) translateY(-5%)',
      }
    } else if (featureIndex === 5) { // Feature 6
      return {
        transform: 'scale(0.95)',
      }
    }
    return {}
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/20 flex flex-col justify-start items-start relative">
      {/* Background with blur effect */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: "rgba(231, 236, 235, 0.08)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />
      {/* Additional subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl" />

      <div className="self-stretch p-6 flex flex-col justify-start items-start gap-2 relative z-10">
        <div className="self-stretch flex flex-col justify-start items-start gap-1.5">
          <p className="self-stretch text-foreground text-lg leading-7">
            <span className="font-bold">{title}</span> <br />
            <span className="text-muted-foreground font-normal">{description}</span>
          </p>
        </div>
      </div>
      <div className="self-stretch h-72 relative -mt-0.5 z-10 overflow-hidden">
        {image ? (
          <Image
            src={image}
            alt={title}
            fill
            className="object-contain"
            style={{
              ...getImageStyle(),
              ...(featureIndex === 3 && {
                maskImage: 'linear-gradient(to bottom, black 0%, black 50%, rgba(0, 0, 0, 0.8) 75%, rgba(0, 0, 0, 0.2) 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 50%, rgba(0, 0, 0, 0.8) 75%, rgba(0, 0, 0, 0.2) 100%)',
              }),
            }}
          />
        ) : (
          <Component />
        )}
      </div>
    </div>
  )
}

export function BentoSection() {
  const cards = [
    {
      title: "Record or upload your dashcam footage",
      description: "Capture real-time videos from your phone or upload pre-recorded clips from your dashcam to join live campaigns.",
      Component: AiCodeReviews,
      image: "/images/feature-1.png",
    },
    {
      title: "Instant on-chain IP registration",
      description: "Your recordings are instantly secured with Story Protocol, verifying your ownership forever.",
      Component: RealtimeCodingPreviews,
      image: "/images/feature-2.png",
    },
    {
      title: "Earn rewards automatically",
      description: "Gain points every time your footage powers AI research or model training projects.",
      Component: OneClickIntegrationsIllustration,
      image: "/images/feature-3.png",
    },
    {
      title: "Access cleaned real-world data",
      description: "AI companies get structured, high-quality driving data ready for vision and mapping models.",
      Component: MCPConnectivityIllustration,
      image: "/images/feature-4.png",
    },
    {
      title: "Legally safe, consent-backed data",
      description: "AI developers can confidently use your footage, fully backed by transparent rights and user consent.",
      Component: ParallelCodingAgents,
      image: "/images/feature-5.png",
    },
    {
      title: "Community-driven datasets",
      description: "Join global contributors building the world's first user-owned AI data network.",
      Component: EasyDeployment,
      image: "/images/feature-6.png",
    },
  ]

  return (
    <section className="w-full px-5 flex flex-col justify-center items-center overflow-visible bg-transparent">
      <div className="w-full py-8 md:py-16 relative flex flex-col justify-start items-start gap-6">
        <div className="w-[547px] h-[938px] absolute top-[614px] left-[80px] origin-top-left rotate-[-33.39deg] bg-primary/10 blur-[130px] z-0" />
        <div className="self-stretch py-8 md:py-14 flex flex-col justify-center items-center gap-2 z-10">
          <div className="flex flex-col justify-start items-center gap-4">
            <h2 className="w-full max-w-[800px] text-center text-foreground text-4xl md:text-6xl font-semibold leading-tight md:leading-[66px]">
              <span className="block">Empower Your Drive with Ownership</span>
            </h2>
            <p className="w-full max-w-[700px] text-center text-muted-foreground text-lg md:text-xl font-medium leading-relaxed">
              Record your journeys, upload dashcam videos, and secure your data as intellectual property through Story Protocol.
              <br />
              <br />
              Your drives don't just stay stored — they fuel AI innovation, and you earn rewards every time your data contributes to model training.
            </p>
          </div>
        </div>
        <div className="self-stretch grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 z-10">
          {cards.map((card, index) => (
            <BentoCard key={card.title} {...card} featureIndex={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
