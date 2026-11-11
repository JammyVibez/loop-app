"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Radio } from "@/components/icons/lucide-compat"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { CreateStreamForm } from "@/components/create/create-stream-form"

export default function CreateStreamPage() {
  const { user } = useAuth()
  const router = useRouter()

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground">Sign in to start an audio room.</p>
        <Link href="/login">
          <Button className="rounded-full">Log in</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-4 py-8">
        <Link
          href="/streams"
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Audio Rooms
        </Link>

        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <Radio className="h-6 w-6 text-primary" />
            Start an Audio Room
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Audio-first rooms with live conversation, listener chat, reactions, and gifts.
          </p>
        </div>

        <CreateStreamForm onStreamCreated={(streamId) => router.push(streamId ? `/streams/${streamId}` : "/streams")} />
      </div>
    </div>
  )
}
