"use client"

import { Header } from "@/components/header"
import { CreateLoopButton } from "@/components/create-loop-button"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function CreatePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-100">
      <Header />
      <main className="container mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Create a Loop</h1>
        <CreateLoopButton defaultOpen onLoopCreated={() => router.push("/")} />
      </main>
    </div>
  )
}
