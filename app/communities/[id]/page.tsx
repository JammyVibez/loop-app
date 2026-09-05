import { Header } from "@/components/header"
import { CommunityWorld } from "@/components/communities/community-world"

export const dynamic = "force-dynamic"

export default async function CommunityWorldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-7xl">
        <CommunityWorld communityId={id} />
      </main>
    </div>
  )
}