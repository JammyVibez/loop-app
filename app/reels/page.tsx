import { Suspense } from "react"
import { TreeReels } from "@/components/reels/tree-reels"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Plus, TrendingUp, Clock, Users } from "lucide-react"

function ReelsLoading() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="bg-gray-900/50 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-64 w-full rounded-lg mb-4" />
            <div className="flex items-center justify-between">
              <div className="flex space-x-4">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function ReelsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-indigo-900/20">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Tree Reels
            </h1>
            <p className="text-gray-400 mt-2">Discover branching stories and creative content</p>
          </div>
          <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600">
            <Plus className="w-4 h-4 mr-2" />
            Create Reel
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="flex space-x-4 mb-6">
              <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent">
                <TrendingUp className="w-4 h-4 mr-2" />
                Trending
              </Button>
              <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent">
                <Clock className="w-4 h-4 mr-2" />
                Recent
              </Button>
              <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent">
                <Users className="w-4 h-4 mr-2" />
                Following
              </Button>
            </div>

            <Suspense fallback={<ReelsLoading />}>
              <TreeReels />
            </Suspense>
          </div>

          <div className="lg:col-span-1">
            <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Trending Tags</h3>
                <div className="space-y-2">
                  {["#timetravel", "#scifi", "#mystery", "#adventure", "#comedy"].map((tag) => (
                    <div key={tag} className="flex items-center justify-between">
                      <span className="text-purple-400 hover:text-purple-300 cursor-pointer">{tag}</span>
                      <span className="text-xs text-gray-500">1.2k</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-700 backdrop-blur-sm mt-6">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Active Branches</h3>
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm text-white">Time Loop #{i + 1}</p>
                        <p className="text-xs text-gray-400">{3 + i} branches</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
