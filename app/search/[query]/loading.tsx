import { Header } from "@/components/header"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function SearchLoading() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Search Header Skeleton */}
          <Card>
            <CardContent className="p-6">
              <div className="flex space-x-4">
                <Skeleton className="flex-1 h-10" />
                <Skeleton className="w-20 h-10" />
              </div>
              <Skeleton className="h-4 w-48 mt-4" />
            </CardContent>
          </Card>

          {/* Tabs Skeleton */}
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />

            {/* Results Skeleton */}
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4 mb-4">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
