"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { ShopContent } from "@/components/shop/shop-content"
import { ShopUnderConstruction } from "@/components/shop/under-construction"

export default function ShopPage() {
  const [underConstruction, setUnderConstruction] = useState(true)
  const [constructionMsg, setConstructionMsg] = useState("")
  const [constructionSub, setConstructionSub] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        const setting = data.settings?.shop_under_construction
        if (setting) {
          setUnderConstruction(!!setting.enabled)
          setConstructionMsg(setting.message || "")
          setConstructionSub(setting.subtitle || "")
        }
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : underConstruction ? (
          <ShopUnderConstruction
            message={constructionMsg || undefined}
            subtitle={constructionSub || undefined}
          />
        ) : (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Loop Shop
              </h1>
              <p className="text-muted-foreground text-lg">
                Customize your profile with themes, animations, cosmetics, and exclusive items
              </p>
            </div>

            <ShopContent />
          </div>
        )}
      </main>
    </div>
  )
}
