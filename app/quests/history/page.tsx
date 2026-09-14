import type { Metadata } from "next"
import QuestHistoryClient from "./history-client"

export const metadata: Metadata = {
  title: "Quest History — Loop",
}

export default function QuestHistoryPage() {
  return <QuestHistoryClient />
}
