import type { Metadata } from "next"
import QuestsClient from "./quests-client"

export const metadata: Metadata = {
  title: "Quests — Loop",
  description: "Complete quests to earn coins, XP, and rare cosmetics.",
}

export default function QuestsPage() {
  return <QuestsClient />
}
