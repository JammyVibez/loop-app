import { Header } from "@/components/header";
import { BookmarksContent } from "@/components/bookmarks/bookmarks-content";

export default function BookmarksPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Bookmarks
            </h1>
            <p className="text-muted-foreground text-lg">Your saved loops and trees</p>
          </div>

          <BookmarksContent />
        </div>
      </main>
    </div>
  )
}
