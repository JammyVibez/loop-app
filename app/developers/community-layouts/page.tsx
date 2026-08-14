import Link from "next/link"
import { Header } from "@/components/header"
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function CommunityLayoutDocsPage() {
  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      <Header />
      <main className="container mx-auto max-w-3xl space-y-8 px-4 py-10">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-600">Developer docs</p>
          <h1 className="text-4xl font-semibold tracking-tight">Community layout & styling packs</h1>
          <p className="text-muted-foreground">
            Build marketplace packs that change how a loopapp.me community looks and behaves. Packs are JSON payloads
            installed into <code>circle.settings</code> and applied live by the circle UI.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="rounded-full">
              <Link href="/marketplace">Open marketplace</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/developers">Developers hub</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Supported listing types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">design</strong> — full community layout packs. Keys:{" "}
              <code>layout</code>, <code>colors</code>, <code>header_style</code>, <code>components</code>.
            </p>
            <p>
              <strong className="text-foreground">styling</strong> — component tokens. Keys:{" "}
              <code>css_variables</code>, <code>button_style</code>, <code>card_style</code>.
            </p>
            <p>
              <strong className="text-foreground">bot</strong> — automation logic. Keys: <code>bot_type</code>,{" "}
              <code>name</code>, <code>configuration</code>, <code>triggers</code>, <code>messages</code>,{" "}
              <code>logic</code>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Layout presets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <code>immersive-hero</code> / <code>cinematic</code> — tall banner, glass cards, accent-driven header.
            </p>
            <p>
              <code>forum</code> — posts-first density with quieter chrome.
            </p>
            <p>
              <code>compact</code> / <code>minimal</code> — shorter header and flatter surfaces.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Example design pack JSON</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs leading-relaxed">{`{
  "layout": "immersive-hero",
  "colors": {
    "primary": "#7c3aed",
    "secondary": "#22d3ee",
    "background": "#030712"
  },
  "header_style": "gradient-blur",
  "components": {
    "feed": "timeline",
    "sidebar": "activity-rail"
  },
  "css_variables": {
    "--circle-accent": "#22d3ee",
    "--circle-primary": "#7c3aed",
    "--circle-radius": "1.25rem",
    "--circle-surface": "#0b1220"
  }
}`}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How install works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              1. Publish from <Link href="/marketplace" className="underline">Marketplace → Sell a pack</Link> and
              upload/paste your JSON.
            </p>
            <p>2. Buyers unlock the pack with Loop Coins.</p>
            <p>
              3. Install to a circle they admin. loopapp.me writes the payload into{" "}
              <code>settings.marketplace.[type]</code> and syncs <code>settings.community_studio</code>.
            </p>
            <p>
              4. <code>EnhancedCircleDetail</code> reads those settings and applies CSS variables + layout classes
              live.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Example bot pack JSON</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs leading-relaxed">{`{
  "bot_type": "welcome",
  "name": "Community Host Bot",
  "configuration": { "tone": "warm", "auto_reply": true },
  "triggers": ["member_join", "daily_checkin"],
  "messages": {
    "welcome": "Welcome — introduce yourself!",
    "checkin": "Drop your daily win below"
  },
  "logic": { "cooldown_minutes": 30, "max_replies_per_hour": 20 }
}`}</pre>
          </CardContent>
        </Card>
      </main>
      <MobileBottomNav />
    </div>
  )
}
