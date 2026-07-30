import { Header } from "@/components/header"
import { EnhancedCircleDetail } from "@/components/circles/enhanced-circle-detail"

interface CirclePageProps {
  params: Promise<{
    id: string
  }>
}

export default async function CirclePage({ params }: CirclePageProps) {
  const { id } = await params
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <EnhancedCircleDetail circleId={id} />
      </main>
    </div>
  )
}
