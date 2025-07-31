import { Header } from "@/components/header"
import { UserInventory } from "@/components/inventory/user-inventory"

export default function InventoryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              My Inventory
            </h1>
            <p className="text-gray-600 text-lg">Manage your purchased items and themes</p>
          </div>

          <UserInventory />
        </div>
      </main>
    </div>
  )
}
