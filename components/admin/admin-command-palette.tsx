"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import {
  Search,
  Users,
  Shield,
  Coins,
  BarChart3,
  Settings,
  Flag,
  Zap,
  Crown,
  Ban,
  CheckCircle,
  MessageSquare,
  TrendingUp,
  Palette,
  Image,
  Gift,
  Calendar,
  Heart,
  GitBranch,
  LogOut,
  ExternalLink,
  ArrowRight,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CommandAction {
  id: string
  label: string
  description?: string
  icon: any
  category: string
  action: () => void
  keywords?: string[]
}

interface AdminCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdminCommandPalette({ open, onOpenChange }: AdminCommandPaletteProps) {
  const router = useRouter()
  const { getAuthHeader, user } = useAuth()
  const { toast } = useToast()
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [executing, setExecuting] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const actions: CommandAction[] = [
    // Navigation
    {
      id: "nav-analytics",
      label: "View Analytics",
      description: "Platform analytics dashboard",
      icon: BarChart3,
      category: "Navigation",
      action: () => { router.push("/admin"); onOpenChange(false) },
      keywords: ["stats", "metrics", "data"],
    },
    {
      id: "nav-users",
      label: "Manage Users",
      description: "Search, ban, verify users",
      icon: Users,
      category: "Navigation",
      action: () => { router.push("/admin?tab=users"); onOpenChange(false) },
      keywords: ["people", "accounts"],
    },
    {
      id: "nav-revenue",
      label: "Revenue Dashboard",
      description: "Platform revenue overview",
      icon: Coins,
      category: "Navigation",
      action: () => { router.push("/admin?tab=revenue"); onOpenChange(false) },
      keywords: ["money", "earnings", "payouts"],
    },
    {
      id: "nav-moderation",
      label: "Moderation Queue",
      description: "Review flagged content",
      icon: Flag,
      category: "Navigation",
      action: () => { router.push("/admin?tab=moderation"); onOpenChange(false) },
      keywords: ["reports", "flags", "content"],
    },
    {
      id: "nav-health",
      label: "System Health",
      description: "Server status and metrics",
      icon: Zap,
      category: "Navigation",
      action: () => { router.push("/admin?tab=health"); onOpenChange(false) },
      keywords: ["status", "uptime", "performance"],
    },
    {
      id: "nav-themes",
      label: "Theme Management",
      description: "Manage shop themes and cosmetics",
      icon: Palette,
      category: "Navigation",
      action: () => { router.push("/admin?tab=catalog"); onOpenChange(false) },
      keywords: ["shop", "cosmetics", "effects"],
    },
    {
      id: "nav-events",
      label: "Global Events",
      description: "Manage platform events",
      icon: Calendar,
      category: "Navigation",
      action: () => { router.push("/admin?tab=events"); onOpenChange(false) },
      keywords: ["happening", "live"],
    },
    // Quick Actions
    {
      id: "action-verify",
      label: "Verify a User",
      description: "Grant blue checkmark",
      icon: CheckCircle,
      category: "Quick Actions",
      action: () => { router.push("/admin?tab=checkmarks"); onOpenChange(false) },
      keywords: ["badge", "verified", "check"],
    },
    {
      id: "action-broadcast",
      label: "Send Broadcast",
      description: "Send announcement to all users",
      icon: MessageSquare,
      category: "Quick Actions",
      action: () => { router.push("/admin?tab=broadcast"); onOpenChange(false) },
      keywords: ["announce", "notify", "message"],
    },
    {
      id: "action-featured",
      label: "Feature Content",
      description: "Pin content to explore page",
      icon: Heart,
      category: "Quick Actions",
      action: () => { router.push("/admin?tab=featured"); onOpenChange(false) },
      keywords: ["pin", "highlight", "showcase"],
    },
    {
      id: "action-ban",
      label: "Ban User",
      description: "Ban a user account",
      icon: Ban,
      category: "Quick Actions",
      action: () => { router.push("/admin?tab=users"); onOpenChange(false) },
      keywords: ["block", "suspend", "remove"],
    },
    {
      id: "action-maintenance",
      label: "Toggle Maintenance",
      description: "Enable/disable maintenance mode",
      icon: Settings,
      category: "Quick Actions",
      action: () => { router.push("/admin?tab=maintenance"); onOpenChange(false) },
      keywords: ["downtime", "offline", "mode"],
    },
    {
      id: "action-payouts",
      label: "Review Payouts",
      description: "Approve pending withdrawals",
      icon: Gift,
      category: "Quick Actions",
      action: () => { router.push("/admin?tab=payouts"); onOpenChange(false) },
      keywords: ["withdraw", "approve", "money"],
    },
    // External Links
    {
      id: "link-supabase",
      label: "Open Supabase Dashboard",
      description: "Database management",
      icon: ExternalLink,
      category: "External",
      action: () => { window.open("https://supabase.com/dashboard", "_blank"); onOpenChange(false) },
      keywords: ["database", "sql", "data"],
    },
    {
      id: "link-vercel",
      label: "Open Vercel Dashboard",
      description: "Deployment management",
      icon: ExternalLink,
      category: "External",
      action: () => { window.open("https://vercel.com/dashboard", "_blank"); onOpenChange(false) },
      keywords: ["deploy", "hosting", "build"],
    },
    {
      id: "link-github",
      label: "Open GitHub Repo",
      description: "Source code",
      icon: ExternalLink,
      category: "External",
      action: () => { window.open("https://github.com/JammyVibez/loop-app", "_blank"); onOpenChange(false) },
      keywords: ["code", "repository", "source"],
    },
  ]

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("")
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Filter actions
  const filtered = actions.filter((action) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      action.label.toLowerCase().includes(q) ||
      action.description?.toLowerCase().includes(q) ||
      action.category.toLowerCase().includes(q) ||
      action.keywords?.some((k) => k.includes(q))
    )
  })

  // Group by category
  const grouped = filtered.reduce((acc, action) => {
    if (!acc[action.category]) acc[action.category] = []
    acc[action.category].push(action)
    return acc
  }, {} as Record<string, CommandAction[]>)

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault()
      const action = filtered[selectedIndex]
      if (action) action.action()
    } else if (e.key === "Escape") {
      onOpenChange(false)
    }
  }

  let flatIndex = 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base h-auto py-0"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto p-2">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="mb-2">
              <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {category}
              </p>
              {items.map((action) => {
                const Icon = action.icon
                const idx = flatIndex++
                const isSelected = idx === selectedIndex
                return (
                  <button
                    key={action.id}
                    onClick={action.action}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      isSelected ? "bg-muted" : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{action.label}</p>
                      {action.description && (
                        <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100" />
                  </button>
                )
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-8 text-center">
              <Search className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No results for &quot;{query}&quot;</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-4 py-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span>⌘K to toggle</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
