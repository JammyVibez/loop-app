import { Suspense } from "react"
import { RealTimeChat } from "@/components/messages/real-time-chat"
import { Theme3DProvider } from "@/providers/theme-3d-provider"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function MessagesLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <Skeleton className="h-8 w-32 mb-4" />
            <Skeleton className="h-10 w-full mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="flex space-x-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
            <div className="space-y-4 mb-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                  <Skeleton className={`h-12 ${i % 2 === 0 ? "w-64" : "w-48"} rounded-lg`} />
                </div>
              ))}
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-10" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Theme3DProvider>
      <div className="min-h-screen bg-gradient-to-br from-[var(--theme-bg-start,#581c87)]/20 via-[var(--theme-bg-mid,#1e40af)]/20 to-[var(--theme-bg-end,#4338ca)]/20 dark:from-[var(--theme-bg-dark-start,#581c87)]/20 dark:via-[var(--theme-bg-dark-mid,#1e40af)]/20 dark:to-[var(--theme-bg-dark-end,#4338ca)]/20 transition-colors duration-500">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[var(--theme-primary,#a855f7)] to-[var(--theme-secondary,#3b82f6)] bg-clip-text text-transparent">
              Messages
            </h1>
            <p className="text-muted-foreground mt-2">Connect with your community in real-time</p>
          </div>

          <Suspense fallback={<MessagesLoading />}>
            <RealTimeChat />
          </Suspense>
        </div>
      </div>
    </Theme3DProvider>
  )
}
