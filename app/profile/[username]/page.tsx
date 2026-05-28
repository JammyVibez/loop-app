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
      <div className="min-h-screen bg-transparent text-slate-100 transition-colors duration-500">
        <Header />
        <main className="container mx-auto px-4 py-6 max-w-6xl">
          <Enhanced3DProfile username={username} />
        </main>
      </div>
    </Theme3DProvider>
  )
}
