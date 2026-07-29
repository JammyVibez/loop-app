import { Enhanced3DProfile } from "@/components/profile/enhanced-3d-profile";
import { Header } from "@/components/header";

interface ProfilePageProps {
  params: Promise<{ username: string }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <Enhanced3DProfile username={username} />
      </main>
    </div>
  )
}
