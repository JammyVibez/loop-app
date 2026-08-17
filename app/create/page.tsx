import { CreatePageContent } from "@/components/create/create-page-content"
import type { CreateTab } from "@/components/create/create-hub"

const VALID_TABS: CreateTab[] = ["loop", "reel", "moment", "live"]

/**
 * /create?tab=moment (or reel/live) opens the create hub on that tab — used
 * by in-feed call-to-action links like “Post a moment”.
 */
export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const tab = VALID_TABS.includes(params.tab as CreateTab) ? (params.tab as CreateTab) : "loop"
  return <CreatePageContent defaultTab={tab} />
}
