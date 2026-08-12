import { CoLoopJoinLanding } from "@/components/loops/co-loop-join-landing"

interface PageProps {
  searchParams: Promise<{ session?: string; id?: string; invitedBy?: string; inviter?: string }>
}

export default async function CoLoopJoinPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const session = resolvedSearchParams?.session || resolvedSearchParams?.id || "demo-session-1"
  const invitedBy = resolvedSearchParams?.invitedBy || resolvedSearchParams?.inviter || ""

  return <CoLoopJoinLanding sessionId={session} invitedByUsername={invitedBy} />
}
