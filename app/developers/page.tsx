import { Header } from "@/components/header";
import { DevelopersContent } from "@/components/developers/developers-content";

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              Developers Mode
            </h1>
            <p className="text-muted-foreground text-lg">Collaborate on code, share projects, and build together</p>
          </div>

          <DevelopersContent />
        </div>
      </main>
    </div>
  )
}
