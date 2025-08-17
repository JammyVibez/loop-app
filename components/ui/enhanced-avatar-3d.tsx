"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Crown, Star, Zap, Shield, Sparkles } from "lucide-react"

const avatar3DVariants = cva(
  "avatar-3d relative inline-flex shrink-0 overflow-hidden transition-all duration-300 transform-3d",
  {
    variants: {
      size: {
        sm: "h-8 w-8",
        default: "h-10 w-10",
        lg: "h-12 w-12",
        xl: "h-16 w-16",
        "2xl": "h-20 w-20",
        "3xl": "h-24 w-24"
      },
      shape: {
        circle: "rounded-full",
        rounded: "rounded-lg",
        square: "rounded-none"
      },
      variant: {
        default: "border-2 border-border hover:border-primary/50",
        premium: "border-3 border-gradient-to-r from-purple-500 to-pink-500 shadow-lg shadow-purple-500/25",
        verified: "border-3 border-blue-500 shadow-lg shadow-blue-500/25",
        admin: "border-3 border-red-500 shadow-lg shadow-red-500/25",
        vip: "border-3 border-yellow-500 shadow-lg shadow-yellow-500/25",
        neon: "border-3 border-cyan-500 shadow-lg shadow-cyan-500/50 animate-pulse",
        glow: "border-2 border-white/50 shadow-2xl"
      },
      effect: {
        none: "",
        hover: "hover:scale-110 hover:rotate-3 hover:shadow-xl",
        float: "hover:scale-105 hover:-translate-y-1 hover:shadow-lg",
        spin: "hover:rotate-12 hover:scale-110",
        pulse: "hover:animate-pulse hover:scale-105",
        bounce: "hover:animate-bounce",
        glow: "hover:shadow-2xl hover:shadow-primary/50"
      },
      status: {
        none: "",
        online: "after:absolute after:bottom-0 after:right-0 after:h-3 after:w-3 after:bg-green-500 after:rounded-full after:border-2 after:border-background",
        away: "after:absolute after:bottom-0 after:right-0 after:h-3 after:w-3 after:bg-yellow-500 after:rounded-full after:border-2 after:border-background",
        busy: "after:absolute after:bottom-0 after:right-0 after:h-3 after:w-3 after:bg-red-500 after:rounded-full after:border-2 after:border-background",
        offline: "after:absolute after:bottom-0 after:right-0 after:h-3 after:w-3 after:bg-gray-500 after:rounded-full after:border-2 after:border-background"
      }
    },
    defaultVariants: {
      size: "default",
      shape: "circle",
      variant: "default",
      effect: "hover",
      status: "none"
    }
  }
)

export interface Avatar3DProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatar3DVariants> {
  level?: number
  xp?: number
  isPremium?: boolean
  isVerified?: boolean
  isAdmin?: boolean
  showParticles?: boolean
  glowColor?: string
}

const Avatar3D = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  Avatar3DProps
>(({ 
  className, 
  size, 
  shape, 
  variant, 
  effect, 
  status, 
  level, 
  xp, 
  isPremium, 
  isVerified, 
  isAdmin,
  showParticles,
  glowColor,
  ...props 
}, ref) => {
  const [isHovered, setIsHovered] = React.useState(false)
  const [particleKey, setParticleKey] = React.useState(0)

  // Determine variant based on user status
  const getVariant = () => {
    if (isAdmin) return "admin"
    if (isPremium) return "premium"
    if (isVerified) return "verified"
    return variant
  }

  // Generate particles on hover
  React.useEffect(() => {
    if (isHovered && (showParticles || isPremium || isAdmin)) {
      setParticleKey(prev => prev + 1)
    }
  }, [isHovered, showParticles, isPremium, isAdmin])

  const getBadgeIcon = () => {
    if (isAdmin) return <Shield className="h-3 w-3 text-red-500" />
    if (isPremium) return <Crown className="h-3 w-3 text-purple-500" />
    if (isVerified) return <Star className="h-3 w-3 text-blue-500" />
    return null
  }

  const getGlowColor = () => {
    if (glowColor) return glowColor
    if (isAdmin) return "red"
    if (isPremium) return "purple"
    if (isVerified) return "blue"
    return "primary"
  }

  return (
    <div className="relative inline-block">
      <AvatarPrimitive.Root
        ref={ref}
        className={cn(avatar3DVariants({ 
          size, 
          shape, 
          variant: getVariant(), 
          effect, 
          status, 
          className 
        }))}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          boxShadow: isHovered && glowColor ? `0 0 20px ${glowColor}` : undefined
        }}
        {...props}
      >
        {/* Particle effects */}
        {(showParticles || isPremium || isAdmin) && isHovered && (
          <div key={particleKey} className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className={`absolute w-1 h-1 rounded-full animate-ping ${
                  isAdmin ? "bg-red-300" :
                  isPremium ? "bg-purple-300" :
                  isVerified ? "bg-blue-300" :
                  "bg-primary/50"
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

        {/* Rotating border for premium users */}
        {(isPremium || isAdmin) && (
          <div className={`absolute -inset-1 rounded-full animate-spin-slow ${
            isAdmin 
              ? "bg-gradient-to-r from-red-500 via-orange-500 to-red-500" 
              : "bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500"
          } opacity-75 blur-sm`} />
        )}

        {/* Glow effect */}
        {isHovered && (variant === "premium" || variant === "neon" || variant === "glow") && (
          <div className={`absolute -inset-2 rounded-full blur-md opacity-50 ${
            variant === "premium" ? "bg-purple-500" :
            variant === "neon" ? "bg-cyan-500" :
            "bg-white"
          }`} />
        )}

        <AvatarPrimitive.Image className="aspect-square h-full w-full object-cover" />
        <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center rounded-full bg-muted font-medium" />
      </AvatarPrimitive.Root>

      {/* Level indicator */}
      {level && level > 1 && (
        <div className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-background font-bold text-xs ${
          size === "sm" ? "h-4 w-4 text-[10px]" :
          size === "default" ? "h-5 w-5" :
          size === "lg" ? "h-6 w-6" :
          "h-7 w-7"
        } ${
          isAdmin ? "bg-red-500 text-white" :
          isPremium ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white" :
          isVerified ? "bg-blue-500 text-white" :
          "bg-primary text-primary-foreground"
        }`}>
          {level}
        </div>
      )}

      {/* Status badge */}
      {(isAdmin || isPremium || isVerified) && (
        <div className={`absolute -top-1 -right-1 ${
          size === "sm" ? "h-4 w-4" :
          size === "default" ? "h-5 w-5" :
          size === "lg" ? "h-6 w-6" :
          "h-7 w-7"
        } flex items-center justify-center rounded-full border-2 border-background ${
          isAdmin ? "bg-red-500" :
          isPremium ? "bg-purple-500" :
          "bg-blue-500"
        }`}>
          {getBadgeIcon()}
        </div>
      )}

      {/* XP progress ring */}
      {xp && level && (
        <svg 
          className="absolute inset-0 -rotate-90 transform"
          width="100%" 
          height="100%"
        >
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-muted-foreground/20"
          />
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${(xp % 1000) / 1000 * 283} 283`}
            className={`transition-all duration-500 ${
              isAdmin ? "text-red-500" :
              isPremium ? "text-purple-500" :
              isVerified ? "text-blue-500" :
              "text-primary"
            }`}
          />
        </svg>
      )}
    </div>
  )
})
Avatar3D.displayName = "Avatar3D"

const Avatar3DImage = AvatarPrimitive.Image
const Avatar3DFallback = AvatarPrimitive.Fallback

export { Avatar3D, Avatar3DImage, Avatar3DFallback }
