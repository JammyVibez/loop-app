import { Header } from "@/components/header";
import { TrendingContent } from "@/components/trending/trending-content";

export default function TrendingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Trending
            </h1>
            <p className="text-muted-foreground text-lg">Discover what's popular in the loopapp.me community</p>
          </div>

          <TrendingContent />
        </div>
      </main>
    </div>
  )
}
