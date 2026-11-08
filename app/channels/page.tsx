import type { Metadata } from "next"
import { ChannelsBrowser } from "@/components/channels/channels-browser"

export const metadata: Metadata = {
  title: "Channels — Live TV, dramas & novels",
  description:
    "A channel guide for live TV, Asian dramas and web novels, streamed through UltraSrc.",
}

export default function ChannelsPage() {
  return <ChannelsBrowser />
}
