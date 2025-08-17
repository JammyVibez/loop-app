import { Header } from "@/components/header"
import { CircleOwnerDashboard } from "@/components/circles/circle-owner-dashboard"
import { Theme3DProvider } from "@/providers/theme-3d-provider"
import { notFound } from "next/navigation"

interface CircleAdminPageProps {
  params: {
    id: string
  }
}

export default function CircleAdminPage({ params }: CircleAdminPageProps) {
  // In a real implementation, you would check if the user is the owner/admin of the circle
  // For now, we'll just render the dashboard component
  
  return (
    <Theme3DProvider>
      <div className="min-h-screen bg-gradient-to-br from-[var(--theme-bg-start,#0f172a)] via-[var(--theme-bg-mid,#581c87)] to-[var(--theme-bg-end,#0f172a)] dark:from-[var(--theme-bg-dark-start,#0f172a)] dark:via-[var(--theme-bg-dark-mid,#581c87)] dark:to-[var(--theme-bg-dark-end,#0f172a)] transition-colors duration-500">
        <Header />
        <main className="container mx-auto px-4 py-6 max-w-7xl">
          <CircleOwnerDashboard circleId={params.id} />
        </main>
      </div>
    </Theme3DProvider>
  )
}
