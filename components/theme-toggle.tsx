"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { animateThemeChange } from "@/lib/theme-transition"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn("rounded-full text-muted-foreground hover:bg-muted hover:text-foreground", className)}
      onClick={() => animateThemeChange(isDark ? "light" : "dark", setTheme)}
    >
      {mounted ? (
        isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5 opacity-0" />
      )}
    </Button>
  )
}
