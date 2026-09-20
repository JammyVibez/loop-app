"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { ShopContent } from "@/components/shop/shop-content"
import { ShopUnderConstruction } from "@/components/shop/under-construction"
import { ShopLoading } from "@/components/shop/shop-states"

/**
 * The storefront.
 *
 * Admins can close it from Settings — the switch is read here rather than in
 * the shop itself, so a closed shop costs one request and nothing else.
 */
export default function ShopPage() {
  const [state, setState] = useState<"loading" | "open" | "closed">("loading")
  const [message, setMessage] = useState("")
  const [subtitle, setSubtitle] = useState("")

  useEffect(() => {
    let cancelled = false

    fetch("/api/admin/settings")
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return
        const setting = data.settings?.shop_under_construction
        const closed = Boolean(setting?.enabled)
        setMessage(setting?.message || "")
        setSubtitle(setting?.subtitle || "")
        setState(closed ? "closed" : "open")
      })
      .catch(() => {
        // If the setting cannot be read, the shop is open: a settings endpoint
        // having a bad day should not shut the store.
        if (!cancelled) setState("open")
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        {state === "loading" ? (
          <ShopLoading />
        ) : state === "closed" ? (
          <ShopUnderConstruction message={message || undefined} subtitle={subtitle || undefined} />
        ) : (
          <ShopContent />
        )}
      </main>
    </div>
  )
}
