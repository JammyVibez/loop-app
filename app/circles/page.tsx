import { Header } from "@/components/header"
import { CirclesList } from "@/components/circles/circles-list"
import { CreateCircleButton } from "@/components/circles/create-circle-button"
import { Theme3DProvider } from "@/providers/theme-3d-provider"

export default function CirclesPage() {
  return (
    <Theme3DProvider>
      <div className="min-h-screen bg-gradient-to-br from-[var(--theme-bg-start,#faf5ff)] via-[var(--theme-bg-mid,#eff6ff)] to-[var(--theme-bg-end,#eef2ff)] dark:from-[var(--theme-bg-dark-start,#111827)] dark:via-[var(--theme-bg-dark-mid,#1e1b4b)] dark:to-[var(--theme-bg-dark-end,#312e81)] transition-colors duration-500">
        <Header />
        <main className="container mx-auto px-4 py-6 max-w-6xl">
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-[var(--theme-primary,#8b5cf6)] to-[var(--theme-secondary,#3b82f6)] bg-clip-text text-transparent">
                Loop Circles
              </h1>
              <p className="text-muted-foreground text-lg">Join communities and collaborate on amazing loop projects</p>
            </div>

            <CreateCircleButton />
            <CirclesList />
          </div>
        </main>
      </div>
    </Theme3DProvider>
  )
}
