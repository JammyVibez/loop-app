import { Header } from "@/components/header"
import { UserInventory } from "@/components/inventory/user-inventory"

export default function InventoryPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="space-y-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Inventory
            </h1>
            <p className="text-sm text-muted-foreground">
              Equip and manage everything you own
            </p>
          </div>
          <UserInventory />
        </div>
      </main>
    </div>
  )
}
