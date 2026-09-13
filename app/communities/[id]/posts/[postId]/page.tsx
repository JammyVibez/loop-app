import { Metadata } from "next"
import { Header } from "@/components/header"
import { CommunityPostDetail } from "@/components/communities/community-post-detail"
import { createClient } from "@/lib/supabase"
import { getAbsoluteAppUrl } from "@/lib/app-url"

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

  try {
    const { data: post } = await supabase
      .from("circle_posts")
      .select("content, author:profiles!author_id(display_name, username)")
      .eq("id", postId)
      .eq("circle_id", id)
      .maybeSingle()

    if (post) {
      const author = Array.isArray(post.author) ? post.author[0] : post.author
      const preview = (post.content || "").slice(0, 120)
      title = author?.display_name ? `${author.display_name} — Loop Community` : title
      description = preview || description
    }
  } catch {
    /* metadata is best-effort */
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/communities/${id}/posts/${postId}`,
      siteName: "Loop",
      type: "article",
    },
  }
}

export default async function CommunityPostPage({ params }: PostPageProps) {
  const { id, postId } = await params

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-2xl px-4 py-6">
        <CommunityPostDetail communityId={id} postId={postId} />
      </main>
    </div>
  )
}
