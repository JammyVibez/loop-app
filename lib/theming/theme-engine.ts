import { Theme } from '@/lib/enhanced-database.types'

// 3D Theme Configuration Interface
export interface Theme3DConfig {
  // Core theme properties
  id: string
  name: string
  category: string
  
  // Color system with 3D variations
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string
    text: string
    // 3D specific colors
    shadow: string
    highlight: string
    depth: string
    glow: string
  }
  
  // 3D Effects configuration
  effects3D: {
    // Depth and layering
    cardDepth: number
    hoverLift: number
    shadowIntensity: number
    
    // Animations
    transitionDuration: string
    easeFunction: string
    
    // Particle effects
    particles: {
      enabled: boolean
      count: number
      color: string
      size: number
      speed: number
    }
    
    // Glow effects
    glow: {
      enabled: boolean
      intensity: number
      color: string
      blur: number
    }
    
    // Parallax settings
    parallax: {
      enabled: boolean
      intensity: number
      layers: number
    }
  }
  
  // Component-specific styling
  components: {
    // Loop cards
    loopCard: {
      background: string
      border: string
      borderRadius: string
      transform3D: string
      boxShadow: string
      hoverTransform: string
    }
    
    // Navigation
    navigation: {
      background: string
      backdropFilter: string
      border: string
      itemHover: string
    }
    
    // Buttons
    button: {
      primary: {
        background: string
        color: string
        boxShadow: string
        hoverTransform: string
      }
      secondary: {
        background: string
        color: string
        boxShadow: string
        hoverTransform: string
      }
    }
    
    // Profile elements
    profile: {
      avatar: {
        border: string
        boxShadow: string
        hoverTransform: string
      }
      banner: {
        background: string
        overlay: string
        filter: string
      }
    }
    
    // Text styling with 3D effects
    text: {
      heading: {
        color: string
        textShadow: string
        fontWeight: string
      }
      body: {
        color: string
        textShadow: string
      }
      accent: {
        color: string
        textShadow: string
        background: string
      }
    }
  }
  
  // Animation presets
  animations: {
    fadeIn: string
    slideIn: string
    bounce: string
    pulse: string
    rotate3D: string
    flip: string
    morphing: string
  }
  
  // Background environments
  environment: {
    type: 'gradient' | 'particles' | 'geometric' | 'abstract' | 'nature'
    config: Record<string, any>
  }
}

// Theme Engine Class
export class ThemeEngine {
  private currentTheme: Theme3DConfig | null = null
  private cssVariables: Map<string, string> = new Map()
  
  constructor() {
    this.initializeDefaultTheme()
  }
  
  // Initialize with default theme
  private initializeDefaultTheme() {
    this.currentTheme = this.getDefaultTheme()
    this.applyTheme(this.currentTheme)
  }
  
  // Get default theme configuration
  private getDefaultTheme(): Theme3DConfig {
    return {
      id: 'default',
      name: 'Default 3D',
      category: 'standard',
      colors: {
        primary: '#6366f1',
        secondary: '#8b5cf6',
        accent: '#06b6d4',
        background: '#0f172a',
        surface: '#1e293b',
        text: '#f8fafc',
        shadow: 'rgba(0, 0, 0, 0.3)',
        highlight: 'rgba(255, 255, 255, 0.1)',
        depth: 'rgba(99, 102, 241, 0.2)',
        glow: 'rgba(99, 102, 241, 0.5)'
      },
      effects3D: {
        cardDepth: 8,
        hoverLift: 12,
        shadowIntensity: 0.3,
        transitionDuration: '0.3s',
        easeFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        particles: {
          enabled: true,
          count: 50,
          color: '#6366f1',
          size: 2,
          speed: 1
        },
        glow: {
          enabled: true,
          intensity: 0.5,
          color: '#6366f1',
          blur: 20
        },
        parallax: {
          enabled: true,
          intensity: 0.1,
          layers: 3
        }
      },
      components: {
        loopCard: {
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '12px',
          transform3D: 'translateZ(0)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          hoverTransform: 'translateY(-4px) rotateX(2deg) rotateY(2deg)'
        },
        navigation: {
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(99, 102, 241, 0.1)',
          itemHover: 'rgba(99, 102, 241, 0.1)'
        },
        button: {
          primary: {
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#ffffff',
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)',
            hoverTransform: 'translateY(-2px) scale(1.02)'
          },
          secondary: {
            background: 'rgba(99, 102, 241, 0.1)',
            color: '#6366f1',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)',
            hoverTransform: 'translateY(-1px) scale(1.01)'
          }
        },
        profile: {
          avatar: {
            border: '3px solid rgba(99, 102, 241, 0.5)',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)',
            hoverTransform: 'scale(1.05) rotateZ(5deg)'
          },
          banner: {
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.3))',
            overlay: 'rgba(0, 0, 0, 0.2)',
            filter: 'blur(0.5px)'
          }
        },
        text: {
          heading: {
            color: '#f8fafc',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
            fontWeight: '700'
          },
          body: {
            color: '#cbd5e1',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
          },
          accent: {
            color: '#6366f1',
            textShadow: '0 0 10px rgba(99, 102, 241, 0.5)',
            background: 'rgba(99, 102, 241, 0.1)'
          }
        }
      },
      animations: {
        fadeIn: 'fadeIn 0.5s ease-out',
        slideIn: 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        bounce: 'bounce 0.6s ease-in-out',
        pulse: 'pulse 2s ease-in-out infinite',
        rotate3D: 'rotate3D 1s ease-in-out',
        flip: 'flip 0.6s ease-in-out',
        morphing: 'morphing 2s ease-in-out infinite'
      },
      environment: {
        type: 'gradient',
        config: {
          gradient: 'radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)'
        }
      }
    }
  }
  
  // Apply theme to the DOM
  applyTheme(theme: Theme3DConfig) {
    this.currentTheme = theme
    this.generateCSSVariables(theme)
    this.injectCSS()
    this.setupEnvironment(theme.environment)
  }
  
  // Generate CSS variables from theme config
  private generateCSSVariables(theme: Theme3DConfig) {
    this.cssVariables.clear()
    
    // Colors
    Object.entries(theme.colors).forEach(([key, value]) => {
      this.cssVariables.set(`--theme-color-${key}`, value)
    })
    
    // 3D Effects
    this.cssVariables.set('--theme-card-depth', `${theme.effects3D.cardDepth}px`)
    this.cssVariables.set('--theme-hover-lift', `${theme.effects3D.hoverLift}px`)
    this.cssVariables.set('--theme-shadow-intensity', theme.effects3D.shadowIntensity.toString())
    this.cssVariables.set('--theme-transition-duration', theme.effects3D.transitionDuration)
    this.cssVariables.set('--theme-ease-function', theme.effects3D.easeFunction)
    
    // Component styles
    Object.entries(theme.components).forEach(([component, styles]) => {
      Object.entries(styles).forEach(([property, value]) => {
        if (typeof value === 'object') {
          Object.entries(value).forEach(([subProperty, subValue]) => {
            this.cssVariables.set(`--theme-${component}-${property}-${subProperty}`, subValue as string)
          })
        } else {
          this.cssVariables.set(`--theme-${component}-${property}`, value as string)
        }
      })
    })
  }
  
  // Inject CSS variables into the document
  private injectCSS() {
    const root = document.documentElement
    this.cssVariables.forEach((value, key) => {
      root.style.setProperty(key, value)
    })
    
    // Add theme-specific classes
    document.body.className = document.body.className.replace(/theme-\w+/g, '')
    document.body.classList.add(`theme-${this.currentTheme?.id}`)
  }
  
  // Setup environment effects
  private setupEnvironment(environment: Theme3DConfig['environment']) {
    const existingEnv = document.getElementById('theme-environment')
    if (existingEnv) {
      existingEnv.remove()
    }
    
    const envElement = document.createElement('div')
    envElement.id = 'theme-environment'
    envElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: -1;
    `
    
    switch (environment.type) {
      case 'gradient':
        envElement.style.background = environment.config.gradient
        break
      case 'particles':
        this.setupParticleEnvironment(envElement, environment.config)
        break
      // Add more environment types as needed
    }
    
    document.body.appendChild(envElement)
  }
  
  // Setup particle environment
  private setupParticleEnvironment(container: HTMLElement, config: any) {
    // This would integrate with a particle system library
    // For now, we'll create a simple CSS-based particle effect
    container.innerHTML = `
      <div class="particles">
        ${Array.from({ length: config.count || 50 }, (_, i) => `
          <div class="particle" style="
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation-delay: ${Math.random() * 2}s;
          "></div>
        `).join('')}
      </div>
    `
  }
  
  // Get current theme
  getCurrentTheme(): Theme3DConfig | null {
    return this.currentTheme
  }
  
  // Load theme from database
  async loadTheme(themeId: string): Promise<void> {
    try {
      // This would fetch from your database
      const response = await fetch(`/api/themes/${themeId}`)
      const themeData = await response.json()
      
      if (themeData) {
        this.applyTheme(themeData)
      }
    } catch (error) {
      console.error('Failed to load theme:', error)
    }
  }
  
  // Create theme transition animation
  transitionToTheme(newTheme: Theme3DConfig, duration: number = 1000) {
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle, transparent 0%, rgba(0,0,0,0.8) 100%);
      z-index: 9999;
      opacity: 0;
      transition: opacity ${duration/2}ms ease-in-out;
      pointer-events: none;
    `
    
    document.body.appendChild(overlay)
    
    // Fade in overlay
    requestAnimationFrame(() => {
      overlay.style.opacity = '1'
    })
    
    // Apply new theme at halfway point
    setTimeout(() => {
      this.applyTheme(newTheme)
      
      // Fade out overlay
      overlay.style.opacity = '0'
      
      // Remove overlay after transition
      setTimeout(() => {
        overlay.remove()
      }, duration/2)
    }, duration/2)
  }
}

// Global theme engine instance
export const themeEngine = new ThemeEngine()

// Theme utility functions
export const getThemeVariable = (variable: string): string => {
  return getComputedStyle(document.documentElement).getPropertyValue(`--theme-${variable}`)
}

export const setThemeVariable = (variable: string, value: string): void => {
  document.documentElement.style.setProperty(`--theme-${variable}`, value)
}

// Theme validation
export const validateTheme = (theme: Partial<Theme3DConfig>): boolean => {
  const requiredFields = ['id', 'name', 'colors', 'effects3D', 'components']
  return requiredFields.every(field => field in theme)
}
