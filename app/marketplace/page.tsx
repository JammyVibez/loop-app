import { Header } from "@/components/header"
import { CommunityMarketplace } from "@/components/marketplace/community-marketplace"
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav"

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40 pb-24 lg:pb-8">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <CommunityMarketplace />
      </main>
      <MobileBottomNav />
    </div>
  )
}
