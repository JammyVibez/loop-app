import { Enhanced3DProfile } from "@/components/profile/enhanced-3d-profile"
import { Header } from "@/components/header"
import { Theme3DProvider } from "@/providers/theme-3d-provider"

interface ProfilePageProps {
  params: Promise<{ username: string }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params // ✅ Await params

  return (
    <Theme3DProvider>
      <div className="min-h-screen bg-gradient-to-br from-[var(--theme-bg-start,#faf5ff)] via-[var(--theme-bg-mid,#eff6ff)] to-[var(--theme-bg-end,#eef2ff)] dark:from-[var(--theme-bg-dark-start,#111827)] dark:via-[var(--theme-bg-dark-mid,#1e1b4b)] dark:to-[var(--theme-bg-dark-end,#312e81)] transition-colors duration-500">
        <Header />
        <main className="container mx-auto px-4 py-6 max-w-6xl">
          <Enhanced3DProfile username={username} />
        </main>
      </div>
    </Theme3DProvider>
  )
}
