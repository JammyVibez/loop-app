import { Header } from "@/components/header"
import { MiniGames } from "@/components/games/mini-games"

export default function GamesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Mini Games
            </h1>
            <p className="text-gray-600 dark:text-gray-300 text-lg">
              Play games, earn XP and coins, and compete with other users
            </p>
          </div>

          <MiniGames />
        </div>
      </main>
    </div>
  )
}
