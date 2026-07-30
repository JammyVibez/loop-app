"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Code, BookOpen, Database, Sparkles, CheckCircle, Copy, Layers, Palette, Terminal, ArrowRight, Shield, Rocket } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

const SAMPLE_TELEGRAM_MANIFEST = {
  listing_type: "design",
  title: "Telegram Channel Pro Layout",
  description: "Authentic Telegram channel theme with left room list, centered message bubbles, and right detail panel.",
  price_coins: 200,
  tags: ["telegram", "messaging", "chat-first", "channels"],
  payload: {
    layout: "telegram",
    header_style: "glass-gradient",
    sidebar_layout: "compact-dock",
    chat_density: "spacious-bubbles",
    forum_layout: "3d-cards",
    colors: {
      primary: "#24A1DE",
      secondary: "#0088cc",
      background: "#0e1621"
    },
    css_variables: {
      "--circle-accent": "#24A1DE",
      "--circle-primary": "#0088cc",
      "--circle-surface": "#17212b",
      "--circle-radius": "1.2rem",
      "--circle-font": "Inter"
    }
  }
}

const SAMPLE_DISCORD_MANIFEST = {
  listing_type: "design",
  title: "Discord Server Dark Theme",
  description: "Discord-styled layout featuring dark server icon bar, text & voice channel hierarchy, role colors, and member roster.",
  price_coins: 250,
  tags: ["discord", "gaming", "role-tags", "channels"],
  payload: {
    layout: "discord",
    header_style: "neon-border",
    sidebar_layout: "full-nav",
    chat_density: "compact-rows",
    forum_layout: "bento-grid",
    colors: {
      primary: "#5865F2",
      secondary: "#57F287",
      background: "#313338"
    },
    css_variables: {
      "--circle-accent": "#5865F2",
      "--circle-primary": "#eb459e",
      "--circle-surface": "#2b2d31",
      "--circle-radius": "0.8rem",
      "--circle-font": "Space Grotesk"
    }
  }
}

export function DeveloperDocs() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [manifestCode, setManifestCode] = useState(JSON.stringify(SAMPLE_TELEGRAM_MANIFEST, null, 2))
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null)
  const [publishing, setPublishing] = useState(false)

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    toast({ title: "Copied to Clipboard! 📋" })
    setTimeout(() => setCopied(false), 2000)
  }

  const validateManifest = () => {
    try {
      const parsed = JSON.parse(manifestCode)
      if (!parsed.title || !parsed.payload || !parsed.payload.layout) {
        setValidationResult({
          valid: false,
          message: "Validation Error: Manifest must contain 'title', 'listing_type', and 'payload.layout'."
        })
        return false
      }
      setValidationResult({
        valid: true,
        message: "✅ Manifest syntax and layout schema parameters are fully valid!"
      })
      return true
    } catch (err: any) {
      setValidationResult({
        valid: false,
        message: `JSON Syntax Error: ${err.message}`
      })
      return false
    }
  }

  const publishToMarketplace = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Sign in to publish layouts to the Community Marketplace.", variant: "destructive" })
      return
    }

    if (!validateManifest()) return

    try {
      setPublishing(true)
      const parsed = JSON.parse(manifestCode)
      const response = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          listing_type: parsed.listing_type || "design",
          title: parsed.title,
          description: parsed.description || "Custom Community Layout",
          price_coins: Number(parsed.price_coins) || 100,
          tags: parsed.tags || ["custom-layout"],
          payload: parsed.payload
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to publish layout")

      toast({
        title: "Published to Marketplace! 🚀",
        description: `Successfully listed "${parsed.title}" on the Community Marketplace!`
      })
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" })
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/70 via-slate-900 to-violet-950/70 p-6 sm:p-8">
        <div className="relative z-10 max-w-3xl space-y-3">
          <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-300 font-semibold px-3 py-1 text-xs">
            <BookOpen className="mr-1.5 h-3.5 w-3.5 text-cyan-400" /> Loop Developer Specification (v1.0)
          </Badge>
          <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
            Community Layout & Theme Developer Docs
          </h1>
          <p className="text-sm sm:text-base text-slate-300">
            Build custom community layouts (Telegram, Discord, Reddit, Dev.to, Cyberpunk) for Circle Owners. Ensure zero schema mismatch by following our official manifest specification.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-[#030712]/60 p-1 border border-white/10 rounded-2xl">
          <TabsTrigger value="overview">Layout Specs</TabsTrigger>
          <TabsTrigger value="schema">Supabase Schema</TabsTrigger>
          <TabsTrigger value="tokens">CSS Tokens</TabsTrigger>
          <TabsTrigger value="tester">Manifest Builder</TabsTrigger>
        </TabsList>

        {/* Tab 1: Layout Specs */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-white/10 bg-white/[0.03]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-cyan-400">
                  <Layers className="h-4 w-4" /> Telegram Layout
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-300 space-y-2">
                <p>Identifier: <code className="text-cyan-300 bg-black/40 px-1 py-0.5 rounded">telegram</code></p>
                <p>Renders a channel sidebar on left, central message thread with reply bars, and right-side channel details & pinned info.</p>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.03]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-violet-400">
                  <Terminal className="h-4 w-4" /> Discord Layout
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-300 space-y-2">
                <p>Identifier: <code className="text-violet-300 bg-black/40 px-1 py-0.5 rounded">discord</code></p>
                <p>Features dark server navigation bar, text/voice categories (`# general`, `🔊 voice`), colored user role tags, and online member roster.</p>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.03]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-400">
                  <Sparkles className="h-4 w-4" /> Reddit Layout
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-300 space-y-2">
                <p>Identifier: <code className="text-orange-300 bg-black/40 px-1 py-0.5 rounded">reddit</code></p>
                <p>Subreddit header banner with Karma points, Upvote/Downvote buttons, Hot/Top post sorting, and Subreddit Rules wiki card.</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-white/10 bg-white/[0.04]">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Code className="h-5 w-5 text-cyan-400" /> Standard Community Layout Manifest Format
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Developers must use this JSON structure when uploading custom layout packs to avoid property mismatches.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative rounded-2xl bg-black/80 border border-white/10 p-4 font-mono text-xs text-emerald-400 overflow-x-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(JSON.stringify(SAMPLE_TELEGRAM_MANIFEST, null, 2))}
                  className="absolute top-3 right-3 rounded-full text-[10px] h-7 border-white/20"
                >
                  {copied ? "Copied!" : "Copy JSON Spec"}
                </Button>
                <pre>{JSON.stringify(SAMPLE_TELEGRAM_MANIFEST, null, 2)}</pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Supabase Schema */}
        <TabsContent value="schema" className="space-y-6 mt-6">
          <Card className="border-white/10 bg-white/[0.04]">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Database className="h-5 w-5 text-emerald-400" /> Supabase Database Schema Guidelines
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Required database columns and automated fallbacks when storing community layouts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-300">
              <div className="space-y-2 rounded-xl bg-black/40 p-4 border border-white/10">
                <h4 className="font-semibold text-white text-sm">Table: <code className="text-cyan-300">circles</code></h4>
                <p>Column <code className="text-emerald-300">settings (JSONB)</code> stores per-community studio and marketplace design configurations:</p>
                <div className="font-mono text-[11px] text-slate-400 pl-4 space-y-1">
                  <p>• settings.community_studio.layout → "telegram" | "discord" | "reddit" | "devto" | "forum" | "cyberpunk"</p>
                  <p>• settings.community_studio.accent → "#22d3ee"</p>
                  <p>• settings.marketplace.design → Marketplace Installed Layout Object</p>
                </div>
              </div>

              <div className="space-y-2 rounded-xl bg-black/40 p-4 border border-white/10">
                <h4 className="font-semibold text-white text-sm">Table: <code className="text-cyan-300">community_marketplace_listings</code></h4>
                <p>Stores developer layout uploads and pricing in Loop Coins.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: CSS Tokens */}
        <TabsContent value="tokens" className="space-y-6 mt-6">
          <Card className="border-white/10 bg-white/[0.04]">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Palette className="h-5 w-5 text-pink-400" /> CSS Variables & Design Tokens
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {[
                { var: "--circle-primary", desc: "Main brand color for buttons, active tabs, and primary accents" },
                { var: "--circle-accent", desc: "Secondary highlight color for badges, neon borders, and notification dots" },
                { var: "--circle-surface", desc: "Background surface color for cards and sidebars" },
                { var: "--circle-radius", desc: "Border-radius token for cards and control pills (e.g. 1rem)" },
                { var: "--circle-font", desc: "Font family override for community headers (e.g. Space Grotesk)" },
              ].map((token) => (
                <div key={token.var} className="p-3 rounded-xl border border-white/10 bg-black/40">
                  <code className="text-cyan-300 font-bold text-xs">{token.var}</code>
                  <p className="text-xs text-slate-400 mt-1">{token.desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Manifest Builder */}
        <TabsContent value="tester" className="space-y-6 mt-6">
          <Card className="border-white/10 bg-white/[0.04]">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Rocket className="h-5 w-5 text-amber-400" /> Developer Manifest Builder & Publisher
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Edit your layout manifest JSON below, validate it against Developer Docs specs, and publish directly to the Community Marketplace!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setManifestCode(JSON.stringify(SAMPLE_TELEGRAM_MANIFEST, null, 2))}
                  className="rounded-full text-xs"
                >
                  Load Telegram Preset
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setManifestCode(JSON.stringify(SAMPLE_DISCORD_MANIFEST, null, 2))}
                  className="rounded-full text-xs"
                >
                  Load Discord Preset
                </Button>
              </div>

              <Textarea
                value={manifestCode}
                onChange={(e) => setManifestCode(e.target.value)}
                rows={16}
                className="font-mono text-xs bg-black/80 border-white/10 text-cyan-300"
              />

              {validationResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium ${
                    validationResult.valid
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-red-500/30 bg-red-500/10 text-red-300"
                  }`}
                >
                  {validationResult.message}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={validateManifest}
                  variant="outline"
                  className="rounded-full border-white/20 text-white"
                >
                  <CheckCircle className="mr-2 h-4 w-4 text-emerald-400" /> Validate Syntax
                </Button>

                <Button
                  onClick={publishToMarketplace}
                  disabled={publishing}
                  className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-white shadow-lg"
                >
                  {publishing ? "Publishing..." : "Publish to Marketplace 🚀"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
