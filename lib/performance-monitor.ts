"use client"

import { useEffect } from "react"

import { useState } from "react"

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private observers: PerformanceObserver[] = []
  private metrics: Map<string, number[]> = new Map()

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  startMonitoring() {
    // Monitor long tasks
    if ("PerformanceObserver" in window) {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            console.warn(`Long task detected: ${entry.duration}ms`)
            this.trackMetric("longTasks", entry.duration)
          }
        }
      })

      try {
        longTaskObserver.observe({ entryTypes: ["longtask"] })
        this.observers.push(longTaskObserver)
      } catch (e) {
        console.warn("Long task monitoring not supported")
      }

      // Monitor layout shifts
      const layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput && entry.value > 0.1) {
            console.warn(`Layout shift detected: ${entry.value}`)
            this.trackMetric("layoutShifts", entry.value)
          }
        }
      })

      try {
        layoutShiftObserver.observe({ entryTypes: ["layout-shift"] })
        this.observers.push(layoutShiftObserver)
      } catch (e) {
        console.warn("Layout shift monitoring not supported")
      }

      // Monitor largest contentful paint
      const lcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.trackMetric("lcp", entry.startTime)
        }
      })

      try {
        lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] })
        this.observers.push(lcpObserver)
      } catch (e) {
        console.warn("LCP monitoring not supported")
      }
    }

    // Monitor memory usage
    this.monitorMemoryUsage()
  }

  private trackMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    const values = this.metrics.get(name)!
    values.push(value)

    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift()
    }
  }

  private monitorMemoryUsage() {
    if ("memory" in performance) {
      setInterval(() => {
        const memory = (performance as any).memory
        this.trackMetric("memoryUsed", memory.usedJSHeapSize)

        // Alert if memory usage is high
        if (memory.usedJSHeapSize > 100 * 1024 * 1024) {
          // 100MB
          console.warn("High memory usage detected:", memory.usedJSHeapSize / 1024 / 1024, "MB")
        }
      }, 30000) // Check every 30 seconds
    }
  }

  getMetrics() {
    const result: Record<string, { avg: number; max: number; count: number }> = {}

    for (const [name, values] of this.metrics.entries()) {
      if (values.length > 0) {
        result[name] = {
          avg: values.reduce((sum, val) => sum + val, 0) / values.length,
          max: Math.max(...values),
          count: values.length,
        }
      }
    }

    return result
  }

  measureComponent(name: string, fn: () => void) {
    const start = performance.now()
    fn()
    const duration = performance.now() - start
    this.trackMetric(`component_${name}`, duration)

    if (duration > 16.67) {
      // Slower than 60fps
      console.warn(`Slow component render: ${name} took ${duration.toFixed(2)}ms`)
    }
  }

  cleanup() {
    this.observers.forEach((observer) => observer.disconnect())
    this.observers = []
    this.metrics.clear()
  }
}

// Hook for component performance monitoring
export function usePerformanceMonitor(componentName: string) {
  const monitor = PerformanceMonitor.getInstance()

  return {
    measureRender: (fn: () => void) => monitor.measureComponent(componentName, fn),
    getMetrics: () => monitor.getMetrics(),
  }
}

// Hook for adaptive performance based on device capabilities
export function useAdaptivePerformance() {
  const [performanceLevel, setPerformanceLevel] = useState<"high" | "medium" | "low">("high")
  const [batteryLevel, setBatteryLevel] = useState(1)
  const [isCharging, setIsCharging] = useState(true)

  useEffect(() => {
    // Detect device performance
    const detectPerformance = () => {
      const start = performance.now()

      requestAnimationFrame(() => {
        const frameTime = performance.now() - start

        if (frameTime > 32) {
          // < 30fps
          setPerformanceLevel("low")
        } else if (frameTime > 20) {
          // < 50fps
          setPerformanceLevel("medium")
        } else {
          setPerformanceLevel("high")
        }
      })
    }

    detectPerformance()

    // Monitor battery if available
    if ("getBattery" in navigator) {
      ;(navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(battery.level)
        setIsCharging(battery.charging)

        battery.addEventListener("levelchange", () => setBatteryLevel(battery.level))
        battery.addEventListener("chargingchange", () => setIsCharging(battery.charging))
      })
    }
  }, [])

  const shouldReduceAnimations = performanceLevel === "low" || (batteryLevel < 0.2 && !isCharging)
  const shouldReduceEffects = performanceLevel !== "high" || shouldReduceAnimations

  return {
    performanceLevel,
    batteryLevel,
    isCharging,
    shouldReduceAnimations,
    shouldReduceEffects,
  }
}
