import { UserProfile } from "@/components/profile/user-profile"
import { Header } from "@/components/header"

interface ProfilePageProps {
  params: {
    username: string
  }
}

export default function ProfilePage({ params }: ProfilePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <UserProfile username={params.username} />
      </main>
    </div>
  )
}
