import type { Metadata } from "next"
import { Header } from "@/components/header"
import { ChainDetailClient } from "@/components/chains/chain-detail-client"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Chain — LOOP",
  description: "Explore a collaborative Chain and add your contribution.",
}

export default async function ChainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <ChainDetailClient chainId={id} />
    </div>
  )
}
