import type { Metadata } from "next"
import QuestDetailClient from "./quest-detail-client"

export const metadata: Metadata = {
  title: "Quest — Loop",
}

export default async function QuestDetailPage({ params }: { params: Promise<{ questId: string }> }) {
  const { questId } = await params
  return <QuestDetailClient questId={questId} />
}
