import { Header } from "@/components/header"
import { CircleOwnerDashboard } from "@/components/circles/circle-owner-dashboard"

interface CircleAdminPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function CircleAdminPage({ params }: CircleAdminPageProps) {
  const { id } = await params

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        <CircleOwnerDashboard circleId={id} />
      </main>
    </div>
  )
}
