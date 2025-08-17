"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Sparkles, Zap, Crown, Star } from "lucide-react"

const card3DVariants = cva(
  "card-3d rounded-lg border bg-card text-card-foreground shadow transition-all duration-300 transform-3d relative overflow-hidden group",
  {
    variants: {
      variant: {
        default: "hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02]",
        elevated: "shadow-lg hover:shadow-xl hover:-translate-y-2 hover:scale-[1.03]",
        floating: "shadow-xl hover:shadow-2xl hover:-translate-y-3 hover:scale-[1.04]",
        premium: "border-2 border-gradient-to-r from-purple-500 to-pink-500 shadow-lg shadow-purple-500/25 hover:shadow-2xl hover:shadow-purple-500/50 hover:-translate-y-2 hover:scale-[1.03]",
        neon: "border-2 border-cyan-500 shadow-lg shadow-cyan-500/25 hover:shadow-2xl hover:shadow-cyan-500/50 hover:-translate-y-2 hover:scale-[1.03]",
        golden: "border-2 border-yellow-500 shadow-lg shadow-yellow-500/25 hover:shadow-2xl hover:shadow-yellow-500/50 hover:-translate-y-2 hover:scale-[1.03]",
        glass: "bg-white/10 backdrop-blur-md border border-white/20 shadow-lg hover:bg-white/20 hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02]",
        interactive: "cursor-pointer hover:shadow-xl hover:-translate-y-2 hover:rotate-1 hover:scale-[1.03] active:scale-[0.98] active:translate-y-0"
      },
      depth: {
        flat: "",
        shallow: "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/5 before:to-transparent before:rounded-lg before:pointer-events-none",
        medium: "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-lg before:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-tl after:from-black/5 after:to-transparent after:rounded-lg after:pointer-events-none",
        deep: "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/15 before:to-transparent before:rounded-lg before:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-tl after:from-black/10 after:to-transparent after:rounded-lg after:pointer-events-none"
      },
      glow: {
        none: "",
        subtle: "hover:shadow-primary/20",
        medium: "hover:shadow-primary/40",
        intense: "hover:shadow-primary/60 hover:shadow-2xl"
      },
      tilt: {
        none: "",
        subtle: "hover:rotate-1",
        medium: "hover:rotate-2",
        dramatic: "hover:rotate-3"
      }
    },
    defaultVariants: {
      variant: "default",
      depth: "shallow",
      glow: "subtle",
      tilt: "none"
    }
  }
)

export interface Card3DProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof card3DVariants> {
  particles?: boolean
  shimmer?: boolean
  pulseOnHover?: boolean
  mouseTracking?: boolean
  glowColor?: string
}

const Card3D = React.forwardRef<HTMLDivElement, Card3DProps>(
  ({ 
    className, 
    variant, 
    depth, 
    glow, 
    tilt, 
    particles, 
    shimmer, 
    pulseOnHover,
    mouseTracking,
    glowColor,
    children,
    ...props 
  }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false)
    const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 })
    const [particleKey, setParticleKey] = React.useState(0)
    const cardRef = React.useRef<HTMLDivElement>(null)

    // Mouse tracking for 3D tilt effect
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!mouseTracking || !cardRef.current) return
      
      const rect = cardRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      
      const mouseX = e.clientX - centerX
      const mouseY = e.clientY - centerY
      
      setMousePosition({ x: mouseX, y: mouseY })
    }

    const handleMouseEnter = () => {
      setIsHovered(true)
      if (particles) {
        setParticleKey(prev => prev + 1)
      }
    }

    const handleMouseLeave = () => {
      setIsHovered(false)
      setMousePosition({ x: 0, y: 0 })
    }

    // Calculate 3D transform based on mouse position
    const getTransform = () => {
      if (!mouseTracking || !isHovered) return undefined
      
      const maxTilt = 10
      const rotateX = (mousePosition.y / 100) * maxTilt * -1
      const rotateY = (mousePosition.x / 100) * maxTilt
      
      return `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
    }

    const getGlowStyle = () => {
      if (!isHovered || !glowColor) return undefined
      return {
        boxShadow: `0 0 30px ${glowColor}, 0 0 60px ${glowColor}40`
      }
    }

    return (
      <div
        ref={cardRef}
        className={cn(card3DVariants({ variant, depth, glow, tilt, className }))}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: getTransform(),
          transformStyle: 'preserve-3d',
          ...getGlowStyle()
        }}
        {...props}
      >
        {/* Particle effects */}
        {particles && isHovered && (
          <div key={particleKey} className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
            {Array.from({ length: 12 }, (_, i) => (
              <div
                key={i}
                className={`absolute w-1 h-1 rounded-full animate-ping ${
                  variant === "premium" ? "bg-purple-300" :
                  variant === "neon" ? "bg-cyan-300" :
                  variant === "golden" ? "bg-yellow-300" :
                  "bg-primary/50"
                }`}
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 1}s`,
                  animationDuration: `${0.5 + Math.random() * 1}s`
                }}
              />
            ))}
          </div>
        )}

        {/* Shimmer effect */}
        {shimmer && (
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-lg pointer-events-none" />
        )}

        {/* Premium glow border */}
        {(variant === "premium" || variant === "neon" || variant === "golden") && (
          <div className={`absolute -inset-1 rounded-lg blur opacity-30 transition-opacity duration-300 ${
            variant === "premium" ? "bg-gradient-to-r from-purple-600 to-pink-600" :
            variant === "neon" ? "bg-gradient-to-r from-cyan-500 to-blue-500" :
            "bg-gradient-to-r from-yellow-400 to-orange-500"
          } ${isHovered ? "opacity-60" : "opacity-30"}`} />
        )}

        {/* Pulse effect */}
        {pulseOnHover && isHovered && (
          <div className="absolute inset-0 rounded-lg bg-primary/10 animate-pulse pointer-events-none" />
        )}

        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>

        {/* Interactive ripple effect */}
        {variant === "interactive" && (
          <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-primary/5 scale-0 group-active:scale-100 transition-transform duration-200 rounded-lg" />
          </div>
        )}
      </div>
    )
  }
)
Card3D.displayName = "Card3D"

const Card3DHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6 relative z-10", className)}
    {...props}
  />
))
Card3DHeader.displayName = "Card3DHeader"

const Card3DTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight text-3d-glow",
      className
    )}
    {...props}
  />
))
Card3DTitle.displayName = "Card3DTitle"

const Card3DDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
Card3DDescription.displayName = "Card3DDescription"

const Card3DContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0 relative z-10", className)} {...props} />
))
Card3DContent.displayName = "Card3DContent"

const Card3DFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0 relative z-10", className)}
    {...props}
  />
))
Card3DFooter.displayName = "Card3DFooter"

export {
  Card3D,
  Card3DHeader,
  Card3DFooter,
  Card3DTitle,
  Card3DDescription,
  Card3DContent,
}
