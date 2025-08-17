
"use client"

import { supabase } from "@/lib/supabase"

export interface Theme {
  id: string
  name: string
  description: string
  category: 'free' | 'premium' | 'exclusive'
  price: number
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string
    text: string
  }
  effects: {
    particles: boolean
    glow: boolean
    animation: string
  }
  preview_url?: string
  is_active?: boolean
}

export class ThemeManager {
  private static instance: ThemeManager
  private currentTheme: Theme | null = null
  private availableThemes: Theme[] = []

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager()
    }
    return ThemeManager.instance
  }

  async loadThemes(): Promise<Theme[]> {
    try {
      const { data, error } = await supabase
        .from('themes')
        .select('*')
        .order('category', { ascending: true })

      if (error) throw error

      this.availableThemes = data || []
      return this.availableThemes
    } catch (error) {
      console.error('Error loading themes:', error)
      return []
    }
  }

  async getUserTheme(userId: string): Promise<Theme | null> {
    try {
      const { data, error } = await supabase
        .from('user_themes')
        .select(`
          theme_id,
          themes (*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()

      if (error) throw error

      return data?.themes as Theme || null
    } catch (error) {
      console.error('Error loading user theme:', error)
      return null
    }
  }

  async applyTheme(theme: Theme): Promise<void> {
    this.currentTheme = theme
    
    // Apply CSS variables
    const root = document.documentElement
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--theme-${key}`, value)
    })

    // Apply effects
    if (theme.effects.particles) {
      this.enableParticles()
    } else {
      this.disableParticles()
    }

    if (theme.effects.glow) {
      root.classList.add('theme-glow')
    } else {
      root.classList.remove('theme-glow')
    }

    root.setAttribute('data-theme', theme.id)
  }

  async purchaseTheme(themeId: string, userId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/themes/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ themeId, userId })
      })

      const result = await response.json()
      return result.success
    } catch (error) {
      console.error('Error purchasing theme:', error)
      return false
    }
  }

  async setActiveTheme(themeId: string, userId: string): Promise<boolean> {
    try {
      // Deactivate current theme
      await supabase
        .from('user_themes')
        .update({ is_active: false })
        .eq('user_id', userId)

      // Activate new theme
      const { error } = await supabase
        .from('user_themes')
        .update({ is_active: true })
        .eq('user_id', userId)
        .eq('theme_id', themeId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('Error setting active theme:', error)
      return false
    }
  }

  private enableParticles() {
    // Create particle system
    const particleContainer = document.getElementById('particle-container')
    if (!particleContainer) {
      const container = document.createElement('div')
      container.id = 'particle-container'
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: -1;
      `
      document.body.appendChild(container)
      
      // Add particles
      for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div')
        particle.className = 'theme-particle'
        particle.style.cssText = `
          position: absolute;
          width: 2px;
          height: 2px;
          background: var(--theme-accent);
          border-radius: 50%;
          left: ${Math.random() * 100}%;
          top: ${Math.random() * 100}%;
          animation: float ${3 + Math.random() * 4}s ease-in-out infinite;
          opacity: 0.6;
        `
        container.appendChild(particle)
      }
    }
  }

  private disableParticles() {
    const particleContainer = document.getElementById('particle-container')
    if (particleContainer) {
      particleContainer.remove()
    }
  }

  getCurrentTheme(): Theme | null {
    return this.currentTheme
  }

  getAvailableThemes(): Theme[] {
    return this.availableThemes
  }
}

export const themeManager = ThemeManager.getInstance()

// CSS animation for particles
const style = document.createElement('style')
style.textContent = `
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    33% { transform: translateY(-10px) rotate(120deg); }
    66% { transform: translateY(10px) rotate(240deg); }
  }
  
  .theme-glow * {
    box-shadow: 0 0 10px var(--theme-accent);
  }
`
document.head.appendChild(style)
