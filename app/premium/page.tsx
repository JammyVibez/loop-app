import { PremiumUpgrade } from "@/components/premium/premium-upgrade"
import { Header } from "@/components/header"

export default function PremiumPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <PremiumUpgrade />
      </div>
    </div>
  )
}
