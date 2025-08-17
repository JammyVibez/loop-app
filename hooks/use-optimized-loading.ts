"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef } from "react"

// Hook for intersection observer-based lazy loading
export function useIntersectionObserver(options: IntersectionObserverInit = { threshold: 0.1 }) {
  const [isVisible, setIsVisible] = useState(false)
  const [hasBeenVisible, setHasBeenVisible] = useState(false)
  const elementRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting
      setIsVisible(visible)

      if (visible && !hasBeenVisible) {
        setHasBeenVisible(true)
      }
    }, options)

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [options, hasBeenVisible])

  return { elementRef, isVisible, hasBeenVisible }
}

// Hook for optimized image loading with placeholder
export function useOptimizedImage(src: string, placeholder?: string) {
  const [imageSrc, setImageSrc] = useState(placeholder || "")
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!src) return

    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      setImageSrc(src)
      setIsLoading(false)
      setHasError(false)
    }

    img.onerror = () => {
      setIsLoading(false)
      setHasError(true)
    }

    img.src = src
  }, [src])

  return { imageSrc, isLoading, hasError }
}

// Hook for debounced API calls
export function useDebouncedCallback<T extends (...args: any[]) => any>(callback: T, delay: number): T {
  const timeoutRef = useRef<NodeJS.Timeout>()

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay],
  ) as T

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}

// Hook for optimized infinite scroll
export function useInfiniteScroll(fetchMore: () => Promise<void>, hasMore: boolean, threshold = 200) {
  const [isFetching, setIsFetching] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (entry.isIntersecting && !isFetching && hasMore) {
          setIsFetching(true)
          try {
            await fetchMore()
          } catch (error) {
            console.error("Error fetching more data:", error)
          } finally {
            setIsFetching(false)
          }
        }
      },
      { rootMargin: `${threshold}px` },
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [fetchMore, hasMore, isFetching, threshold])

  return { sentinelRef, isFetching }
}

// Hook for virtual scrolling (for large lists)
export function useVirtualScroll<T>(items: T[], itemHeight: number, containerHeight: number, overscan = 5) {
  const [scrollTop, setScrollTop] = useState(0)

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(items.length - 1, Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan)

  const visibleItems = items.slice(startIndex, endIndex + 1).map((item, index) => ({
    item,
    index: startIndex + index,
  }))

  const totalHeight = items.length * itemHeight
  const offsetY = startIndex * itemHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
  }
}

// Hook for preloading resources
export function usePreloader(resources: string[]) {
  const [loadedResources, setLoadedResources] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (resources.length === 0) {
      setIsLoading(false)
      return
    }

    const loadResource = (url: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          const img = new Image()
          img.onload = () => resolve()
          img.onerror = reject
          img.src = url
        } else if (url.match(/\.(mp4|webm|ogg)$/i)) {
          const video = document.createElement("video")
          video.onloadeddata = () => resolve()
          video.onerror = reject
          video.src = url
        } else {
          // For other resources, use fetch
          fetch(url)
            .then(() => resolve())
            .catch(reject)
        }
      })
    }

    const loadAllResources = async () => {
      const loaded = new Set<string>()

      for (const resource of resources) {
        try {
          await loadResource(resource)
          loaded.add(resource)
          setLoadedResources(new Set(loaded))
        } catch (error) {
          console.warn(`Failed to preload resource: ${resource}`, error)
        }
      }

      setIsLoading(false)
    }

    loadAllResources()
  }, [resources])

  return {
    loadedResources,
    isLoading,
    progress: resources.length > 0 ? loadedResources.size / resources.length : 1,
  }
}
