import type { Metadata } from "next"
import QuestsClient from "./quests-client"

export const metadata: Metadata = {
  title: "Quests — Loop",
  description: "Do more. Earn more. Unlock more.",
}

export default function QuestsPage() {
  return <QuestsClient />
}
