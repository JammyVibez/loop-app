"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { TreePine, Camera, ArrowRight, Sparkles } from "lucide-react"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { getDiceBearUrl } from "@/lib/dicebear"
import { useAuth } from "@/hooks/use-auth"

interface OnboardingWelcomeProps {
  onComplete: (data: { avatar_url: string; bio: string }) => void
}

const FLOATING_EMOJIS = ["🌳", "⚡", "🎨", "🎵", "🎮", "📸", "✨", "🚀"]

export function OnboardingWelcome({ onComplete }: OnboardingWelcomeProps) {
  const { user } = useAuth()
  const [bio, setBio] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    // Stagger the entrance
    const timer = setTimeout(() => setShowContent(true), 300)
    return () => clearTimeout(timer)
  }, [])

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const { uploadMediaFile } = await import("@/lib/client-media-upload")
    try {
      const uploaded = await uploadMediaFile(file, {
        type: "image",
        folder: "avatars",
        authHeaders: {},
      })
      setAvatarUrl(uploaded.url)
    } catch {
      console.error("Avatar upload failed")
    }
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Floating background emojis */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {FLOATING_EMOJIS.map((emoji, i) => (
          <motion.span
            key={i}
            className="absolute text-2xl opacity-20"
            initial={{ opacity: 0, y: 20 }}
            animate={{
              opacity: [0.1, 0.25, 0.1],
              y: [0, -20, 0],
              x: [0, Math.sin(i) * 10, 0],
            }}
            transition={{
              duration: 4 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.3,
            }}
            style={{
              left: `${10 + (i * 12) % 80}%`,
              top: `${10 + (i * 15) % 70}%`,
            }}
          >
            {emoji}
          </motion.span>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10"
      >
        <div className="landing-card-3d border-border bg-card/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-violet-950/10 overflow-hidden">
          {/* Gradient header */}
          <div className="relative h-32 bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            >
              <TreePine className="text-white w-16 h-16 drop-shadow-lg" />
            </motion.div>
            {/* Sparkle effects */}
            <motion.div
              className="absolute top-4 right-8"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="text-white/40 h-6 w-6" />
            </motion.div>
            <motion.div
              className="absolute bottom-4 left-8"
              animate={{ rotate: -360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="text-white/30 h-4 w-4" />
            </motion.div>
          </div>

          <div className="p-6 space-y-6">
            <AnimatePresence>
              {showContent && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-center space-y-2"
                >
                  <h2 className="text-2xl font-bold">Welcome to Loop!</h2>
                  <p className="text-muted-foreground">
                    Let&apos;s set up your profile to help you connect with the right community
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showContent && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex flex-col items-center gap-4"
                >
                  {/* Avatar */}
                  <div className="relative">
                    <VideoAvatar
                      src={avatarUrl || user?.avatar_url || getDiceBearUrl(user?.username)}
                      className="w-24 h-24"
                      fallback={user?.display_name?.charAt(0) || "U"}
                    />
                    <Button
                      size="icon"
                      className="absolute -bottom-1 -right-1 rounded-full w-8 h-8 shadow-lg"
                      variant="secondary"
                      onClick={() => document.getElementById("onboarding-avatar-upload")?.click()}
                    >
                      <Camera className="w-4 h-4" />
                    </Button>
                    <input
                      id="onboarding-avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                  </div>

                  {/* Name */}
                  <div>
                    <h3 className="text-xl font-semibold">{user?.display_name}</h3>
                    <p className="text-sm text-muted-foreground">@{user?.username}</p>
                  </div>

                  {/* Bio */}
                  <textarea
                    placeholder="Tell the world what inspires you..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full min-h-[80px] rounded-xl border border-input bg-muted/50 px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground -mt-2">{bio.length}/160</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showContent && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <Button
                    onClick={() => onComplete({ avatar_url: avatarUrl, bio })}
                    className="w-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold py-6 text-base tap-feedback"
                    size="lg"
                  >
                    Continue <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
