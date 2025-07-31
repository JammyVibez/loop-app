import { Header } from "@/components/header"
import { CircleDetail } from "@/components/circles/circle-detail"

interface CirclePageProps {
  params: {
    id: string
  }
}

export default function CirclePage({ params }: CirclePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <CircleDetail circleId={params.id} />
      </main>
    </div>
  )
}
