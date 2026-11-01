import { Header } from "@/components/header"
import { CollectionDetailClient } from "@/components/collections/collection-detail-client"

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <CollectionDetailClient collectionId={id} />
    </div>
  )
}
