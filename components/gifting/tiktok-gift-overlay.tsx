"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Crown, Flame, Rocket, Heart, Trophy, Zap, Star } from "@/components/icons/lucide-compat"

export interface ActiveGiftEffect {
  id: string
  giftName: string
  senderName: string
  senderAvatar?: string
  icon?: string
  rarity?: "common" | "rare" | "epic" | "legendary"
  cost?: number
}

interface TikTokGiftOverlayProps {
  activeGift: ActiveGiftEffect | null
  onComplete?: () => void
}

export function TikTokGiftOverlay({ activeGift, onComplete }: TikTokGiftOverlayProps) {
  const [current, setCurrent] = useState<ActiveGiftEffect | null>(null)

  useEffect(() => {
    if (activeGift) {
      setCurrent(activeGift)
      const timer = setTimeout(() => {
        setCurrent(null)
        onComplete?.()
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [activeGift, onComplete])

  if (!current) return null

  const lowerName = current.giftName.toLowerCase()

  const isSupercar = lowerName.includes("car") || lowerName.includes("supercar") || current.cost === 5000
  const isDragon = lowerName.includes("dragon") || lowerName.includes("fire") || current.cost === 1000
  const isRocket = lowerName.includes("rocket") || lowerName.includes("space") || current.cost === 500
  const isCrown = lowerName.includes("crown") || lowerName.includes("vip") || current.cost === 250
  const isRose = lowerName.includes("rose") || lowerName.includes("flower")

  return (
    <AnimatePresence>
      <div className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
        {/* Banner Announcement */}
        <motion.div
          initial={{ y: -80, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: "spring", damping: 15 }}
          className="absolute top-16 z-50 flex items-center gap-3 rounded-full bg-black/80 px-6 py-3 border border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.5)] backdrop-blur-md"
        >
          {current.senderAvatar ? (
            <img
              src={current.senderAvatar}
              alt={current.senderName}
              className="h-10 w-10 rounded-full border-2 border-amber-400 object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 font-bold text-white">
              {current.senderName.slice(0, 1)}
            </div>
          )}

          <div className="text-left">
            <p className="text-xs text-amber-300 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Gift Received!
            </p>
            <p className="text-sm font-bold text-white">
              <span className="text-amber-300">{current.senderName}</span> sent{" "}
              <span className="text-pink-400 font-extrabold">{current.giftName}</span>
            </p>
          </div>
        </motion.div>

        {/* 1. Supercar Animation */}
        {isSupercar && (
          <motion.div
            initial={{ x: "-120vw", scale: 0.8 }}
            animate={{ x: "120vw", scale: 1.2 }}
            transition={{ duration: 2.8, ease: "easeInOut" }}
            className="absolute flex items-center justify-center"
          >
            <div className="relative">
              <div className="text-8xl drop-shadow-[0_0_40px_rgba(236,72,153,0.9)]">🏎️</div>
              {/* Speed lines */}
              <div className="absolute -left-32 top-1/2 h-4 w-32 -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-400 to-pink-500 rounded-full blur-sm" />
            </div>
          </motion.div>
        )}

        {/* 2. Dragon Fire Animation */}
        {isDragon && (
          <div className="relative flex items-center justify-center">
            <motion.div
              initial={{ scale: 0, rotate: -20, opacity: 0 }}
              animate={{ scale: [0, 1.4, 1.2], rotate: 0, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="text-9xl drop-shadow-[0_0_50px_rgba(245,158,11,1)]"
            >
              🐉
            </motion.div>

            {/* Flame Breath */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0.5, 2.5, 3], opacity: [0, 1, 0] }}
              transition={{ duration: 2, delay: 0.5 }}
              className="absolute -right-20 top-0 text-7xl"
            >
              🔥🔥🔥
            </motion.div>
          </div>
        )}

        {/* 3. Rocket Launch Animation */}
        {isRocket && (
          <motion.div
            initial={{ y: "100vh", scale: 0.6 }}
            animate={{ y: "-100vh", scale: 1.5 }}
            transition={{ duration: 2.5, ease: "anticipate" }}
            className="absolute flex flex-col items-center"
          >
            <div className="text-9xl drop-shadow-[0_0_40px_rgba(59,130,246,0.9)]">🚀</div>
            <div className="h-40 w-12 bg-gradient-to-t from-transparent via-amber-500 to-orange-600 blur-md rounded-full animate-pulse" />
          </motion.div>
        )}

        {/* 4. Crown Animation */}
        {isCrown && (
          <motion.div
            initial={{ y: -100, scale: 0, opacity: 0 }}
            animate={{ y: 0, scale: [0, 1.5, 1.2], opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 12 }}
            className="flex flex-col items-center justify-center"
          >
            <Crown className="h-32 w-32 text-amber-400 drop-shadow-[0_0_35px_rgba(251,191,36,0.9)] animate-bounce" />
            <div className="mt-4 text-2xl font-black text-amber-300 tracking-widest drop-shadow-md uppercase">
              ROYAL VIP
            </div>
          </motion.div>
        )}

        {/* 5. Rose Storm / Default Floating Particles */}
        {!isSupercar && !isDragon && !isRocket && !isCrown && (
          <div className="absolute inset-0 flex items-center justify-center">
            {Array.from({ length: 18 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{
                  x: (Math.random() - 0.5) * 300,
                  y: (Math.random() - 0.5) * 300,
                  scale: 0,
                  opacity: 0,
                }}
                animate={{
                  x: (Math.random() - 0.5) * 600,
                  y: (Math.random() - 0.5) * 600,
                  scale: [0, 1.8, 1],
                  opacity: [0, 1, 0],
                }}
                transition={{ duration: 2.5, delay: i * 0.1 }}
                className="absolute text-5xl"
              >
                {isRose ? "🌹" : current.icon || "🎁"}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AnimatePresence>
  )
}
