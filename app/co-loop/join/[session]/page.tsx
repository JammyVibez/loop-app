import { CoLoopJoinLanding } from "@/components/loops/co-loop-join-landing"

interface PageProps {
  params: Promise<{ session: string }>
  searchParams: Promise<{ invitedBy?: string; inviter?: string }>
}

export default async function CoLoopJoinSessionPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const session = resolvedParams?.session || "demo-session-1"
  const invitedBy = resolvedSearchParams?.invitedBy || resolvedSearchParams?.inviter || ""

  return <CoLoopJoinLanding sessionId={session} invitedByUsername={invitedBy} />
}
