"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

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

export function Theme3DProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme3D>(defaultTheme)

  useEffect(() => {
    // Load saved theme from localStorage
    const savedThemeId = localStorage.getItem("loop-3d-theme")
    if (savedThemeId) {
      const savedTheme = availableThemes.find((theme) => theme.id === savedThemeId)
      if (savedTheme) {
        setCurrentTheme(savedTheme)
      } else if (savedThemeId === "custom") {
        const customThemeJson = localStorage.getItem("loop-3d-custom-theme")
        if (customThemeJson) {
          const customTheme = JSON.parse(customThemeJson) as Theme3D
          setCurrentTheme(customTheme)
        }
      }
    }
  }, [])

  useEffect(() => {
    // Apply theme to CSS variables
    const root = document.documentElement
    root.style.setProperty("--theme-primary", currentTheme.colors.primary)
    root.style.setProperty("--theme-secondary", currentTheme.colors.secondary)
    root.style.setProperty("--theme-accent", currentTheme.colors.accent)
    root.style.setProperty("--theme-background", currentTheme.colors.background)
    root.style.setProperty("--theme-surface", currentTheme.colors.surface)
    root.style.setProperty("--theme-text", currentTheme.colors.text)

    // Apply 3D effects classes
    document.body.className = document.body.className.replace(/theme-\w+/g, "")
    document.body.classList.add(`theme-${currentTheme.id}`)

    if (currentTheme.effects.glow) {
      document.body.classList.add("theme-glow")
    }
    if (currentTheme.effects.particles) {
      document.body.classList.add("theme-particles")
    }
    if (currentTheme.effects.animations) {
      document.body.classList.add("theme-animations")
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
  }

  return (
    <Theme3DContext.Provider
      value={{
        currentTheme,
        availableThemes,
        setTheme,
        customizeTheme,
        resetTheme,
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
