<div align="center">
  <img src="/logo.png" alt="KnotX Logo" width="120" height="120" />
  
  # KnotX Frontend
  
  **Connecting value across networks**
</div>

## About

The KnotX Frontend is a Next.js application that provides a user interface for interacting with the KnotX cross-chain messaging protocol. It enables users to send messages and execute cross-chain operations through an intuitive web interface.

## Routes

### `/` - Home
The main landing page featuring:
- Hero section with tagline
- Features showcase
- Interactive demo preview
- FAQ section
- Call-to-action sections

**Link:** [http://localhost:3000/](http://localhost:3000/)

### `/demo` - Universal Counter Demo
Interactive demonstration of cross-chain messaging:
- Swap interface for selecting source and destination chains
- Live counter display showing synchronized values across chains
- Real-time updates from both Sepolia and Casper networks
- Connect wallets for both EVM (Rainbow Wallet) and Casper networks

**Link:** [http://localhost:3000/demo](http://localhost:3000/demo)

### `/docs` - Documentation
Comprehensive documentation built with Docusaurus:
- Overview of KnotX messaging protocol
- Getting started guide
- Tutorials and guides
- Contract interfaces and addresses
- Architecture and concepts

**Link:** [http://localhost:3000/docs/overview](http://localhost:3000/docs/overview)

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Tech Stack

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Wagmi** - Ethereum wallet integration
- **RainbowKit** - Wallet connection UI
- **Casper Wallet** - Casper network integration
- **Sonner** - Toast notifications
- **Framer Motion** - Animations
- **Docusaurus** - Documentation

