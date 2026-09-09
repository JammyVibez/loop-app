import { Header } from "@/components/header";
import { ExploreContent } from "@/components/explore/explore-content";

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Explore
            </h1>
            <p className="text-muted-foreground text-lg">Discover amazing loop trees and creative content</p>
          </div>

          <ExploreContent />
        </div>
      </main>
    </div>
  )
}
