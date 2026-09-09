import { Header } from "@/components/header";
import { HashtagContent } from "@/components/hashtag/hashtag-content";

interface HashtagPageProps {
  params: Promise<{
    tag: string
  }>
}

export default async function HashtagPage({ params }: HashtagPageProps) {
  const { tag } = await params
  const decodedTag = decodeURIComponent(tag)

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <HashtagContent tag={decodedTag} />
      </main>
    </div>
  )
}
