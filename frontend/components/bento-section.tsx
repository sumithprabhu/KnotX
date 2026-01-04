import { MagicCard } from "@/components/ui/magic-card"
import { 
  Network, 
  Shield, 
  Code, 
  Server, 
  Wrench, 
  Rocket 
} from "lucide-react"

const BentoCard = ({ title, description, icon: Icon }) => {
  return (
    <MagicCard
      className="overflow-hidden rounded-2xl flex flex-col justify-start items-start relative min-h-[300px] border border-[#6efcd9]/20"
      gradientSize={200}
      gradientColor="#6efcd9"
      gradientOpacity={0.3}
      gradientFrom="#6efcd9"
      gradientTo="#5ee8c9"
    >
      <div className="self-stretch p-6 flex flex-col justify-start items-start gap-4 relative z-10 flex-1">
        <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10 mb-2">
          <Icon className="w-8 h-8 text-primary" />
        </div>
        <div className="self-stretch flex flex-col justify-start items-start gap-1.5">
          <p className="self-stretch text-foreground text-lg leading-7">
            <span className="font-bold">{title}</span> <br />
            <span className="text-muted-foreground font-normal">{description}</span>
          </p>
        </div>
      </div>
    </MagicCard>
  )
}

export function BentoSection() {
  const cards = [
    {
      title: "Universal message passing",
      description: "Send messages and data across any blockchain network with a single, unified interface. Connect EVM, non-EVM, and traditional systems seamlessly.",
      icon: Network,
    },
    {
      title: "Secure cross-chain transfers",
      description: "Move assets between chains with cryptographic security guarantees. Our protocol ensures trustless transfers without intermediaries.",
      icon: Shield,
    },
    {
      title: "Multi-chain smart contracts",
      description: "Deploy and execute contracts that interact across multiple networks. Build truly decentralized applications that span the entire blockchain ecosystem.",
      icon: Code,
    },
    {
      title: "Enterprise-grade reliability",
      description: "Built for production with battle-tested infrastructure. Handle high-volume transactions with guaranteed delivery and finality.",
      icon: Server,
    },
    {
      title: "Contract interfaces & relayer",
      description: "Integrate KnotX using standard contract interfaces. Your contracts implement IKnotXReceiver to receive messages, and interact with gateway contracts. A decentralized relayer network handles message routing between chains.",
      icon: Wrench,
    },
    {
      title: "Future-proof architecture",
      description: "Designed to support emerging networks and protocols. KnotX adapts as the blockchain ecosystem evolves, ensuring long-term compatibility.",
      icon: Rocket,
    },
  ]

  return (
    <section className="w-full px-5 flex flex-col justify-center items-center overflow-visible bg-transparent">
      <div className="w-full py-8 md:py-16 relative flex flex-col justify-start items-start gap-6">
        <div className="w-[547px] h-[938px] absolute top-[614px] left-[80px] origin-top-left rotate-[-33.39deg] bg-primary/10 blur-[130px] z-0" />
        <div className="self-stretch py-8 md:py-14 flex flex-col justify-center items-center gap-2 z-10">
          <div className="flex flex-col justify-start items-center gap-4">
            <h2 className="w-full max-w-[800px] text-center text-foreground text-4xl md:text-6xl font-semibold leading-tight md:leading-[66px]">
              <span className="block">Seamless Cross-Chain Interoperability</span>
            </h2>
            <p className="w-full max-w-[700px] text-center text-muted-foreground text-lg md:text-xl font-medium leading-relaxed">
              KnotX enables secure, trustless communication between different blockchain networks and traditional systems.
              <br />
              <br />
              Connect your assets, data, and applications across multiple chains with a unified, reliable protocol built for the future of decentralized finance.
            </p>
          </div>
        </div>
        <div className="self-stretch grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 z-10">
          {cards.map((card) => (
            <BentoCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </section>
  )
}
