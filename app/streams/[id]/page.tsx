"use client"

import { useParams } from "next/navigation"
import { TikTokLiveRoom } from "@/components/streams/tiktok-live-room"

export default function StreamDetailPage() {
  const params = useParams<{ id: string }>()
  const streamId = params?.id

  if (!streamId) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-black text-white">
        Stream not found
      </div>
    )
  }

  return <TikTokLiveRoom streamId={streamId} />
}
