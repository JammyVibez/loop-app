"use client"

import { Header } from "@/components/header"
import { DeveloperDocs } from "@/components/developers/developer-docs"

export default function DeveloperDocsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <DeveloperDocs />
      </main>
    </div>
  )
}
