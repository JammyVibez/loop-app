import type { Metadata } from "next"
import { ChannelsBrowser } from "@/components/channels/channels-browser"

export const metadata: Metadata = {
  title: "Channels — Movies, shows, dramas & novels",
  description:
    "Watch movies and shows added by the Loop team, Asian dramas and web novels, all in one channel guide.",
}

export default function ChannelsPage() {
  return <ChannelsBrowser />
}
