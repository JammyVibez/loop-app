import { Header } from "@/components/header"
import { UserInventory } from "@/components/inventory/user-inventory"
import { PageHeader } from "@/components/ui/page-header"

export default function InventoryPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Header />
      <main className="container mx-auto max-w-5xl px-4 py-6">
        <div className="space-y-6">
          <PageHeader
            eyebrow="Your collection"
            title="Inventory"
            description="Everything you own — themes, card effects, frames and badges — ready to equip. Items follow you across the app the moment they're active."
          />
          <UserInventory />
        </div>
      </main>
    </div>
  )
}
