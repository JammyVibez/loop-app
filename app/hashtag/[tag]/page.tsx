import { Header } from "@/components/header"
import { HashtagContent } from "@/components/hashtag/hashtag-content"

interface HashtagPageProps {
  params: {
    tag: string
  }
}

export default function HashtagPage({ params }: HashtagPageProps) {
  const decodedTag = decodeURIComponent(params.tag)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <HashtagContent tag={decodedTag} />
      </main>
    </div>
  )
}
