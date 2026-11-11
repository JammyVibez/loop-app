"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Moon, Sun, Circle, Flower2, TreePine, Palette } from "@/components/icons/lucide-compat"
import { cn } from "@/lib/utils"

const themes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "midnight", label: "Midnight", icon: Circle },
  { value: "sakura", label: "Sakura", icon: Flower2 },
  { value: "forest", label: "Forest", icon: TreePine },
]

function themeIcon(name: string) {
  const t = themes.find((t) => t.value === name)
  return t?.icon ?? Palette
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"
  const currentTheme = mounted ? (theme ?? "system") : "system"
  const Icon = mounted ? themeIcon(currentTheme) : Palette

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Change theme"
          className={cn("rounded-full text-muted-foreground hover:bg-muted hover:text-foreground", className)}
        >
          {mounted ? <Icon className="h-5 w-5" /> : <Palette className="h-5 w-5 opacity-0" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 p-1">
        {themes.map((t) => {
          const TIcon = t.icon
          const active = currentTheme === t.value
          return (
            <DropdownMenuItem
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={cn(
                "flex items-center gap-2 rounded-xl text-xs font-medium cursor-pointer",
                active && "bg-accent text-accent-foreground",
              )}
            >
              <TIcon className="h-4 w-4" />
              {t.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
