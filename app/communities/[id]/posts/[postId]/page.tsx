import { Metadata } from "next"
import { Header } from "@/components/header"
import { ForumThread } from "@/components/communities/forum/thread-view"
import { createClient } from "@/lib/supabase"
import { getAbsoluteAppUrl } from "@/lib/app-url"
import { buildOgMetadata } from "@/lib/og/metadata"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)

interface PostPageProps {
  params: Promise<{ id: string; postId: string }>
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { id, postId } = await params
  const baseUrl = await getAbsoluteAppUrl()

  let title = "Community Post — Loop"
  let description = "A post from a Loop community."
  let authorName = ""
  let authorHandle = ""
  let avatarUrl = ""
  let isVerified = false
  let body = ""

  try {
    const { data: post } = await supabase
        .from("circle_posts")
        .select("content, content_metadata, author:profiles!author_id(display_name, username, avatar_url, is_verified)")
        .eq("id", postId)
        .eq("circle_id", id)
        .maybeSingle()

    if (post) {
      const author = Array.isArray(post.author) ? post.author[0] : post.author
      const threadTitle = (post.content_metadata as any)?.title
      const preview = (post.content || "").slice(0, 120)
      authorName = author?.display_name || author?.username || ""
      authorHandle = author?.username || ""
      avatarUrl = author?.avatar_url || ""
      isVerified = Boolean(author?.is_verified)
      body = (post.content || "").slice(0, 480)
      title = threadTitle ? `${threadTitle} — Loop Community` : author?.display_name ? `${author.display_name} — Loop Community` : title
      description = threadTitle || preview || description
    }
  } catch {
    /* metadata is best-effort */
  }

  return buildOgMetadata({
    baseUrl,
    path: `/communities/${id}/posts/${postId}`,
    type: "post",
    title,
    description,
    ogType: "article",
    params: {
      name: authorName,
      username: authorHandle,
      avatar: avatarUrl,
      body,
      verified: isVerified,
      category: "Community post",
      url: `loopapp.me/communities/${id}/posts/${postId}`,
    },
  })
}

export default async function CommunityPostPage({ params }: PostPageProps) {
  const { id, postId } = await params

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-4xl px-3 py-4 sm:px-5 sm:py-6">
        <ForumThread communityId={id} threadId={postId} />
      </main>
    </div>
  )
}
