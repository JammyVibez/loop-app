"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Sparkles, Zap, Crown, Star } from "lucide-react"

const button3DVariants = cva(
  "btn-3d inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden group transform-3d",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-xl hover:scale-105 hover:-translate-y-1",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg hover:shadow-xl hover:scale-105 hover:-translate-y-1",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-md hover:shadow-lg hover:scale-102 hover:-translate-y-0.5",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-md hover:shadow-lg hover:scale-102 hover:-translate-y-0.5",
        ghost: "hover:bg-accent hover:text-accent-foreground hover:scale-105 hover:-translate-y-0.5",
        link: "text-primary underline-offset-4 hover:underline hover:scale-105",
        premium: "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg hover:shadow-2xl hover:scale-110 hover:-translate-y-2 border-2 border-purple-400/50",
        neon: "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-2xl hover:shadow-cyan-500/50 hover:scale-110 hover:-translate-y-2",
        golden: "bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg shadow-yellow-500/25 hover:shadow-2xl hover:shadow-yellow-500/50 hover:scale-110 hover:-translate-y-2",
        glass: "bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-lg hover:bg-white/20 hover:shadow-xl hover:scale-105 hover:-translate-y-1"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        xl: "h-14 rounded-lg px-12 text-lg",
        icon: "h-10 w-10",
      },
      effect: {
        none: "",
        glow: "before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
        shimmer: "before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700",
        pulse: "animate-pulse hover:animate-none",
        bounce: "hover:animate-bounce",
        particles: "after:absolute after:inset-0 after:rounded-md after:pointer-events-none"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      effect: "none"
    },
  }
)

export interface Button3DProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button3DVariants> {
  asChild?: boolean
  icon?: React.ReactNode
  loading?: boolean
  particles?: boolean
}

const Button3D = React.forwardRef<HTMLButtonElement, Button3DProps>(
  ({ className, variant, size, effect, asChild = false, icon, loading, particles, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const [isHovered, setIsHovered] = React.useState(false)
    const [particleKey, setParticleKey] = React.useState(0)

    // Generate particles on hover for premium variants
    React.useEffect(() => {
      if (isHovered && (variant === "premium" || variant === "neon" || variant === "golden" || particles)) {
        setParticleKey(prev => prev + 1)
      }
    }, [isHovered, variant, particles])

    const getVariantIcon = () => {
      switch (variant) {
        case "premium":
          return <Crown className="h-4 w-4" />
        case "neon":
          return <Zap className="h-4 w-4" />
        case "golden":
          return <Star className="h-4 w-4" />
        default:
          return icon
      }
    }

    return (
      <Comp
        className={cn(button3DVariants({ variant, size, effect, className }))}
        ref={ref}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={loading || props.disabled}
        {...props}
      >
        {/* Particle effects */}
        {(particles || variant === "premium" || variant === "neon" || variant === "golden") && isHovered && (
          <div key={particleKey} className="absolute inset-0 pointer-events-none overflow-hidden rounded-md">
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className={`absolute w-1 h-1 rounded-full animate-ping ${
                  variant === "premium" ? "bg-purple-300" :
                  variant === "neon" ? "bg-cyan-300" :
                  variant === "golden" ? "bg-yellow-300" :
                  "bg-white"
                }`}
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  animationDuration: `${0.5 + Math.random() * 0.5}s`
                }}
              />
            ))}
          </div>
        )}

        {/* Glow effect for premium variants */}
        {(variant === "premium" || variant === "neon" || variant === "golden") && (
          <div className={`absolute -inset-1 rounded-lg blur opacity-30 transition-opacity duration-300 ${
            variant === "premium" ? "bg-gradient-to-r from-purple-600 to-pink-600" :
            variant === "neon" ? "bg-gradient-to-r from-cyan-500 to-blue-500" :
            "bg-gradient-to-r from-yellow-400 to-orange-500"
          } ${isHovered ? "opacity-60" : "opacity-30"}`} />
        )}

        {/* Loading spinner */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Content */}
        <div className={`relative z-10 flex items-center gap-2 ${loading ? "opacity-0" : "opacity-100"}`}>
          {(icon || getVariantIcon()) && (
            <span className="transition-transform duration-200 group-hover:scale-110">
              {icon || getVariantIcon()}
            </span>
          )}
          {children}
        </div>

        {/* Ripple effect */}
        <div className="absolute inset-0 rounded-md overflow-hidden">
          <div className="absolute inset-0 bg-white/20 scale-0 group-active:scale-100 transition-transform duration-200 rounded-full" />
        </div>
      </Comp>
    )
  }
)
Button3D.displayName = "Button3D"

export { Button3D, button3DVariants }
