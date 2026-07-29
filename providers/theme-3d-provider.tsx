"use client";
import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import { applyThemeCssVars, clearThemeCssOverrides, isShopThemePayload } from "@/lib/theme-css";

interface Theme3D {
  id: string
  name: string
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string
    text: string
  }
  effects: {
    glow: boolean
    particles: boolean
    animations: boolean
    shadows: boolean
  }
  materials: {
    metallic: number
    roughness: number
    opacity: number
  }
  lighting: {
    ambient: string
    directional: string
    intensity: number
  }
}

interface Theme3DContextType {
  currentTheme: Theme3D
  availableThemes: Theme3D[]
  setTheme: (themeId: string) => void
  customizeTheme: (customizations: Partial<Theme3D>) => void
  resetTheme: () => void
  applyTheme: (theme: any) => void
  previewTheme: (theme: any) => void
  stopPreview: () => void
  isPreviewMode: boolean
}

const defaultTheme: Theme3D = {
  id: "default",
  name: "Default Loop",
  colors: {
    primary: "#8b5cf6",
    secondary: "#3b82f6",
    accent: "#f59e0b",
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#1f2937",
  },
  effects: {
    glow: true,
    particles: false,
    animations: true,
    shadows: true,
  },
  materials: {
    metallic: 0.2,
    roughness: 0.8,
    opacity: 1.0,
  },
  lighting: {
    ambient: "#ffffff",
    directional: "#fbbf24",
    intensity: 1.0,
  },
}

const availableThemes: Theme3D[] = [
  defaultTheme,
  {
    id: "neon-cyber",
    name: "Neon Cyber",
    colors: {
      primary: "#00ff88",
      secondary: "#00ccff",
      accent: "#ff0080",
      background: "#0a0a0a",
      surface: "#1a1a1a",
      text: "#ffffff",
    },
    effects: {
      glow: true,
      particles: true,
      animations: true,
      shadows: true,
    },
    materials: {
      metallic: 0.9,
      roughness: 0.1,
      opacity: 0.9,
    },
    lighting: {
      ambient: "#001122",
      directional: "#00ffff",
      intensity: 1.5,
    },
  },
  {
    id: "sunset-dream",
    name: "Sunset Dream",
    colors: {
      primary: "#ff6b6b",
      secondary: "#ffa500",
      accent: "#ff1744",
      background: "#fff3e0",
      surface: "#ffe0b2",
      text: "#bf360c",
    },
    effects: {
      glow: true,
      particles: false,
      animations: true,
      shadows: true,
    },
    materials: {
      metallic: 0.3,
      roughness: 0.6,
      opacity: 1.0,
    },
    lighting: {
      ambient: "#fff3e0",
      directional: "#ff9800",
      intensity: 1.2,
    },
  },
  {
    id: "galaxy-explorer",
    name: "Galaxy Explorer",
    colors: {
      primary: "#667eea",
      secondary: "#764ba2",
      accent: "#f093fb",
      background: "#0c0c0c",
      surface: "#1a1a2e",
      text: "#eee",
    },
    effects: {
      glow: true,
      particles: true,
      animations: true,
      shadows: true,
    },
    materials: {
      metallic: 0.8,
      roughness: 0.2,
      opacity: 0.95,
    },
    lighting: {
      ambient: "#16213e",
      directional: "#667eea",
      intensity: 1.3,
    },
  },
]

const Theme3DContext = createContext<Theme3DContextType | undefined>(undefined)

function coerceTheme(theme: any): Theme3D | null {
  if (typeof theme === "string") {
    return availableThemes.find((item) => item.id === theme) || null
  }
  if (!theme) return null
  return {
    ...defaultTheme,
    ...theme,
    id: theme.id || "custom",
    name: theme.name || "Custom Theme",
    colors: { ...defaultTheme.colors, ...(theme.colors || {}) },
    effects: {
      ...defaultTheme.effects,
      ...(typeof theme.effects === "object" && !Array.isArray(theme.effects)
        ? theme.effects
        : { particles: Array.isArray(theme.effects) }),
    },
    materials: { ...defaultTheme.materials, ...(theme.materials || {}) },
    lighting: { ...defaultTheme.lighting, ...(theme.lighting || {}) },
  }
}

export function Theme3DProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme3D>(defaultTheme)

  useEffect(() => {
    // Load saved theme from localStorage or profile-applied custom theme
    const savedThemeId = localStorage.getItem("loop-3d-theme")
    const customThemeJson = localStorage.getItem("loop-3d-custom-theme")
    if (customThemeJson) {
      try {
        const customTheme = JSON.parse(customThemeJson) as Theme3D
        if (customTheme?.colors) {
          setCurrentTheme({
            ...defaultTheme,
            ...customTheme,
            colors: { ...defaultTheme.colors, ...customTheme.colors },
            effects: { ...defaultTheme.effects, ...(customTheme.effects as any) },
          })
          return
        }
      } catch {
        /* ignore */
      }
    }
    if (savedThemeId) {
      const savedTheme = availableThemes.find((theme) => theme.id === savedThemeId)
      if (savedTheme) setCurrentTheme(savedTheme)
    }
  }, [])

  useEffect(() => {
    const onApplied = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (detail == null) {
        setCurrentTheme(defaultTheme)
        clearThemeCssOverrides(document.documentElement)
        localStorage.removeItem("loop-3d-custom-theme")
        localStorage.removeItem("loop-3d-theme")
        return
      }
      const next = coerceTheme(detail)
      if (next) setCurrentTheme(next)
    }
    const onProfileTheme = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (isShopThemePayload(detail)) {
        const next = coerceTheme(detail)
        if (next) {
          setCurrentTheme(next)
          localStorage.setItem("loop-3d-theme", next.id)
          localStorage.setItem("loop-3d-custom-theme", JSON.stringify(next))
        }
      }
    }
    window.addEventListener("loop-theme-applied", onApplied as EventListener)
    window.addEventListener("loop-profile-theme", onProfileTheme as EventListener)
    return () => {
      window.removeEventListener("loop-theme-applied", onApplied as EventListener)
      window.removeEventListener("loop-profile-theme", onProfileTheme as EventListener)
    }
  }, [])

  useEffect(() => {
    // Apply theme to CSS variables — bridge --theme-* into shadcn tokens app-wide
    const root = document.documentElement
    applyThemeCssVars(root, currentTheme.colors)

    Array.from(document.body.classList)
      .filter((cls) => cls.startsWith("theme-"))
      .forEach((cls) => document.body.classList.remove(cls))
    document.body.classList.add(`theme-${currentTheme.id}`)

    document.body.classList.toggle("theme-glow", Boolean(currentTheme.effects.glow))
    document.body.classList.toggle("theme-particles", Boolean(currentTheme.effects.particles))
    document.body.classList.toggle("theme-animations", Boolean(currentTheme.effects.animations))

    // Soft page atmosphere from theme background
    const env = document.getElementById("theme-environment")
    if (env) {
      env.style.background = `radial-gradient(1200px 600px at 10% -10%, ${currentTheme.colors.primary}22, transparent 55%), radial-gradient(900px 500px at 90% 0%, ${currentTheme.colors.secondary}18, transparent 50%), ${currentTheme.colors.background}`
      env.style.opacity = "1"
    }
  }, [currentTheme])

  const setTheme = (themeId: string) => {
    const theme = availableThemes.find((t) => t.id === themeId)
    if (theme) {
      setCurrentTheme(theme)
      localStorage.setItem("loop-3d-theme", themeId)
    }
  }

  const customizeTheme = (customizations: Partial<Theme3D>) => {
    const customTheme = {
      ...currentTheme,
      ...customizations,
      id: "custom",
      name: "Custom Theme",
    }
    setCurrentTheme(customTheme)
    localStorage.setItem("loop-3d-theme", "custom")
    localStorage.setItem("loop-3d-custom-theme", JSON.stringify(customTheme))
  }

  const resetTheme = () => {
    setCurrentTheme(defaultTheme)
    localStorage.removeItem("loop-3d-theme")
    localStorage.removeItem("loop-3d-custom-theme")
    clearThemeCssOverrides(document.documentElement)
  }

  const applyTheme = (theme: any) => {
    const nextTheme = coerceTheme(theme)
    if (!nextTheme) return
    setCurrentTheme(nextTheme)
    localStorage.setItem("loop-3d-theme", nextTheme.id)
    localStorage.setItem("loop-3d-custom-theme", JSON.stringify(nextTheme))
  }

  const previewTheme = (theme: any) => {
    const nextTheme = coerceTheme(theme)
    if (nextTheme) setCurrentTheme(nextTheme)
  }

  const stopPreview = () => {
    const customThemeJson = localStorage.getItem("loop-3d-custom-theme")
    if (customThemeJson) {
      try {
        const customTheme = JSON.parse(customThemeJson)
        const next = coerceTheme(customTheme)
        if (next) {
          setCurrentTheme(next)
          return
        }
      } catch {
        /* ignore */
      }
    }
    const savedThemeId = localStorage.getItem("loop-3d-theme")
    if (savedThemeId) setTheme(savedThemeId)
  }

  return (
    <Theme3DContext.Provider
      value={{
        currentTheme,
        availableThemes,
        setTheme,
        customizeTheme,
        resetTheme,
        applyTheme,
        previewTheme,
        stopPreview,
        isPreviewMode: false,
      }}
    >
      {children}
    </Theme3DContext.Provider>
  )
}

export function useTheme3D() {
  const context = useContext(Theme3DContext)
  if (context === undefined) {
    throw new Error("useTheme3D must be used within a Theme3DProvider")
  }
  return context
}

export function useThemeColors() {
  const { currentTheme } = useTheme3D()
  return currentTheme.colors
}
