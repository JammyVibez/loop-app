import { redirect } from "next/navigation"

/**
 * Trending was folded into the blended For You feed. Keep the old URL alive
 * as a permanent shortcut into Explore's trending hashtags.
 */
export default function TrendingPage() {
  redirect("/explore?tab=hashtags")
}
