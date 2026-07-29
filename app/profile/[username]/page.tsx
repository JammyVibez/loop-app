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
      <main className="mx-auto w-full max-w-2xl px-0 sm:px-4 sm:py-6">
        <Enhanced3DProfile username={username} />
      </main>
    </div>
  )
}
