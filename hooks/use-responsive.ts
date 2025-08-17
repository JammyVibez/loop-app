"use client"

import { useState, useEffect } from 'react'

interface BreakpointConfig {
  xs: number
  sm: number
  md: number
  lg: number
  xl: number
  '2xl': number
}

const defaultBreakpoints: BreakpointConfig = {
  xs: 475,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
}

export function useResponsive(breakpoints: Partial<BreakpointConfig> = {}) {
  const bp = { ...defaultBreakpoints, ...breakpoints }
  
  const [screenSize, setScreenSize] = useState<{
    width: number
    height: number
    isXs: boolean
    isSm: boolean
    isMd: boolean
    isLg: boolean
    isXl: boolean
    is2xl: boolean
    isMobile: boolean
    isTablet: boolean
    isDesktop: boolean
  }>({
    width: 0,
    height: 0,
    isXs: false,
    isSm: false,
    isMd: false,
    isLg: false,
    isXl: false,
    is2xl: false,
    isMobile: false,
    isTablet: false,
    isDesktop: false,
  })

  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      setScreenSize({
        width,
        height,
        isXs: width < bp.xs,
        isSm: width >= bp.sm && width < bp.md,
        isMd: width >= bp.md && width < bp.lg,
        isLg: width >= bp.lg && width < bp.xl,
        isXl: width >= bp.xl && width < bp['2xl'],
        is2xl: width >= bp['2xl'],
        isMobile: width < bp.md,
        isTablet: width >= bp.md && width < bp.lg,
        isDesktop: width >= bp.lg,
      })
    }

    // Set initial values
    updateScreenSize()

    // Add event listener
    window.addEventListener('resize', updateScreenSize)
    window.addEventListener('orientationchange', updateScreenSize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', updateScreenSize)
      window.removeEventListener('orientationchange', updateScreenSize)
    }
  }, [bp.xs, bp.sm, bp.md, bp.lg, bp.xl, bp['2xl']])

  return screenSize
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    
    const updateMatch = () => setMatches(media.matches)
    
    // Set initial value
    updateMatch()
    
    // Add listener
    media.addEventListener('change', updateMatch)
    
    // Cleanup
    return () => media.removeEventListener('change', updateMatch)
  }, [query])

  return matches
}

export function useOrientation() {
  const [orientation, setOrientation] = useState<{
    isPortrait: boolean
    isLandscape: boolean
    angle: number
  }>({
    isPortrait: true,
    isLandscape: false,
    angle: 0,
  })

  useEffect(() => {
    const updateOrientation = () => {
      const angle = window.screen?.orientation?.angle ?? 0
      const isPortrait = window.innerHeight > window.innerWidth
      
      setOrientation({
        isPortrait,
        isLandscape: !isPortrait,
        angle,
      })
    }

    updateOrientation()

    window.addEventListener('orientationchange', updateOrientation)
    window.addEventListener('resize', updateOrientation)

    return () => {
      window.removeEventListener('orientationchange', updateOrientation)
      window.removeEventListener('resize', updateOrientation)
    }
  }, [])

  return orientation
}

export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

export function useHighContrast(): boolean {
  return useMediaQuery('(prefers-contrast: high)')
}

export function useDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)')
}

export function useTouchDevice(): boolean {
  return useMediaQuery('(hover: none) and (pointer: coarse)')
}

// Utility function to get responsive values
export function getResponsiveValue<T>(
  values: {
    xs?: T
    sm?: T
    md?: T
    lg?: T
    xl?: T
    '2xl'?: T
    default: T
  },
  screenSize: ReturnType<typeof useResponsive>
): T {
  if (screenSize.is2xl && values['2xl'] !== undefined) return values['2xl']
  if (screenSize.isXl && values.xl !== undefined) return values.xl
  if (screenSize.isLg && values.lg !== undefined) return values.lg
  if (screenSize.isMd && values.md !== undefined) return values.md
  if (screenSize.isSm && values.sm !== undefined) return values.sm
  if (screenSize.isXs && values.xs !== undefined) return values.xs
  
  return values.default
}

// Hook for responsive classes
export function useResponsiveClasses() {
  const screenSize = useResponsive()
  const isTouch = useTouchDevice()
  const reducedMotion = useReducedMotion()
  const highContrast = useHighContrast()

  return {
    screenSize,
    classes: {
      container: screenSize.isMobile ? 'px-4' : screenSize.isTablet ? 'px-6' : 'px-8',
      spacing: screenSize.isMobile ? 'space-y-3' : 'space-y-6',
      text: screenSize.isMobile ? 'text-sm' : 'text-base',
      button: isTouch ? 'touch-target' : '',
      motion: reducedMotion ? 'reduce-motion' : '',
      contrast: highContrast ? 'high-contrast' : '',
      grid: screenSize.isMobile ? 'grid-cols-1' : screenSize.isTablet ? 'grid-cols-2' : 'grid-cols-3',
    }
  }
}
