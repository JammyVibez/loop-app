import { Header } from "@/components/header"
import { CreateCommunityWizard } from "@/components/communities/create-community-wizard"
import { Globe2 } from "lucide-react"

export const dynamic = "force-dynamic"

export default function CreateCommunityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/30">
              <Globe2 className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Create a <span className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 bg-clip-text text-transparent">Community</span>
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Three steps: pick a category, shape your identity, then choose a template.
              Categories are blueprints, not restrictions — customize everything after.
            </p>
          </div>
          <CreateCommunityWizard />
        </div>
      </main>
    </div>
  )
}