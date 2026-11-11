import { Header } from "@/components/header"
import { CreateCommunityWizard } from "@/components/communities/create-community-wizard"
import { Layers, Users } from "@/components/icons/lucide-compat"

export const dynamic = "force-dynamic"

const PERKS = [
  {
    icon: Layers,
    title: "Spaces, not just a feed",
    body: "Threads, media, projects, events and polls — picked for your category, removable any time.",
  },
  {
    icon: Users,
    title: "Roles from day one",
    body: "You start as owner, with moderators, members and a join flow that already works.",
  },
  {
    icon: Users,
    title: "Memory that compounds",
    body: "Every milestone, project and decision is kept, so the world grows instead of scrolling away.",
  },
]

export default function CreateCommunityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              New world
            </div>
            <h1 className="mt-5 text-4xl font-black leading-[0.98] tracking-tight sm:text-5xl">
              Create a community
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Three steps: pick a category, shape the identity, then choose what you start with. Categories are
              blueprints, not restrictions — everything is editable afterwards.
            </p>

            <div className="mt-8">
              <CreateCommunityWizard />
            </div>
          </div>

          <aside className="hidden space-y-3 lg:sticky lg:top-6 lg:block">
            {PERKS.map((perk) => {
              const Icon = perk.icon
              return (
                <div key={perk.title} className="rounded-2xl border border-border bg-card p-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="mt-3 text-sm font-bold">{perk.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{perk.body}</p>
                </div>
              )
            })}
          </aside>
        </div>
      </main>
    </div>
  )
}
