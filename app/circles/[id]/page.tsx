import { redirect } from "next/navigation"

/**
 * The legacy circle UI was replaced by the Communities system, but many
 * places still link here: backend notification action URLs, mention links,
 * profile bio tags, search results and recap modules. Redirect everything
 * to the canonical community world page so none of those links 404.
 */
export default async function LegacyCircleRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/communities/${id}`)
}
