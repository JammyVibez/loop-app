import { Header } from "@/components/header";
import { UserInventory } from "@/components/inventory/user-inventory";

export default function InventoryPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              My Inventory
            </h1>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              Manage and equip your custom themes, avatar frames, badges, and visual effects
            </p>
          </div>

          <UserInventory />
        </div>
      </main>
    </div>
  )
}
