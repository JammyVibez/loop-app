"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Crown, Palette } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

interface ProfileThemeCustomizerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentTheme: any
  onThemeUpdate: (theme: any) => void
}

const colorPresets = [
  { name: "Purple Gradient", primary: "#8B5CF6", secondary: "#3B82F6" },
  { name: "Ocean Blue", primary: "#0EA5E9", secondary: "#06B6D4" },
  { name: "Sunset Orange", primary: "#F97316", secondary: "#EF4444" },
  { name: "Forest Green", primary: "#10B981", secondary: "#059669" },
  { name: "Rose Gold", primary: "#EC4899", secondary: "#F59E0B" },
  { name: "Midnight", primary: "#1F2937", secondary: "#374151" },
]

const animations = [
  { id: "none", name: "None", icon: "⚪", premium: false },
  { id: "pulse-glow", name: "Pulse Glow", icon: "✨", premium: false },
  { id: "float", name: "Float", icon: "🎈", premium: true },
  { id: "rainbow", name: "Rainbow", icon: "🌈", premium: true },
  { id: "sparkle", name: "Sparkle", icon: "⭐", premium: true },
]

export function ProfileThemeCustomizer({
  open,
  onOpenChange,
  currentTheme,
  onThemeUpdate,
}: ProfileThemeCustomizerProps) {
  const [theme, setTheme] = useState(currentTheme || {})
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const { toast } = useToast()
  const { user } = useAuth()

  const handleColorSelect = (preset: (typeof colorPresets)[0]) => {
    setTheme({
      ...theme,
      primary_color: preset.primary,
      secondary_color: preset.secondary,
    })
  }

  const handleAnimationSelect = (animation: (typeof animations)[0]) => {
    if (animation.premium && !user?.is_premium) {
      toast({
        title: "Premium Feature",
        description: "Upgrade to Premium to unlock advanced animations",
        variant: "destructive",
      })
      return
    }

    setTheme({
      ...theme,
      animation: animation.id,
    })
  }

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!user?.is_premium && (file.type.includes("gif") || file.type.includes("video"))) {
      toast({
        title: "Premium Feature",
        description: "Upgrade to Premium to upload animated avatars",
        variant: "destructive",
      })
      return
    }

    // Check file size (10MB for premium, 2MB for free)
    const maxSize = user?.is_premium ? 10 * 1024 * 1024 : 2 * 1024 * 1024
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `File size must be less than ${user?.is_premium ? "10MB" : "2MB"}`,
        variant: "destructive",
      })
      return
    }

    setSelectedFile(file)
  }

  const handleSave = () => {
    onThemeUpdate(theme)
    toast({
      title: "Theme updated!",
      description: "Your profile theme has been saved successfully.",
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Palette className="w-5 h-5 text-purple-600" />
            <span>Customize Profile</span>
            {user?.is_premium && (
              <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                <Crown className="w-3 h-3 mr-1" />
                Premium
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Avatar Upload */}
          <div>
            <Label className="text-sm font-medium">Profile Avatar</Label>
            <div className="mt-2">
              <Input
                type="file"
                accept={user?.is_premium ? "image/*,video/*" : "image/*"}
                onChange={handleAvatarUpload}
                className="mb-2"
              />
              <p className="text-xs text-gray-500">
                {user?.is_premium
                  ? "Upload images, GIFs, or videos up to 10s (10MB max)"
                  : "Upload images only (2MB max). Upgrade to Premium for animated avatars"}
              </p>
            </div>
          </div>

          {/* Color Themes */}
          <div>
            <Label className="text-sm font-medium">Color Theme</Label>
            <div className="grid grid-cols-3 gap-3 mt-2">
              {colorPresets.map((preset) => (
                <Card
                  key={preset.name}
                  className={`cursor-pointer transition-all hover:scale-105 ${
                    theme.primary_color === preset.primary ? "ring-2 ring-purple-500" : ""
                  }`}
                  onClick={() => handleColorSelect(preset)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.primary }} />
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.secondary }} />
                    </div>
                    <p className="text-xs font-medium">{preset.name}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Custom Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="primary-color">Primary Color</Label>
              <Input
                id="primary-color"
                type="color"
                value={theme.primary_color || "#8B5CF6"}
                onChange={(e) => setTheme({ ...theme, primary_color: e.target.value })}
                className="mt-2 h-10"
              />
            </div>
            <div>
              <Label htmlFor="secondary-color">Secondary Color</Label>
              <Input
                id="secondary-color"
                type="color"
                value={theme.secondary_color || "#3B82F6"}
                onChange={(e) => setTheme({ ...theme, secondary_color: e.target.value })}
                className="mt-2 h-10"
              />
            </div>
          </div>

          {/* Animations */}
          <div>
            <Label className="text-sm font-medium">Profile Animation</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {animations.map((animation) => (
                <Card
                  key={animation.id}
                  className={`cursor-pointer transition-all hover:scale-105 ${
                    theme.animation === animation.id ? "ring-2 ring-purple-500" : ""
                  } ${animation.premium && !user?.is_premium ? "opacity-50" : ""}`}
                  onClick={() => handleAnimationSelect(animation)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{animation.icon}</span>
                        <span className="text-sm font-medium">{animation.name}</span>
                      </div>
                      {animation.premium && (
                        <Badge variant="secondary" className="text-xs">
                          <Crown className="w-3 h-3 mr-1" />
                          Premium
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <Label className="text-sm font-medium">Preview</Label>
            <Card className="mt-2 p-4">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-16 h-16 rounded-full border-4 border-white ${
                    theme.animation === "pulse-glow"
                      ? "animate-pulse-glow"
                      : theme.animation === "float"
                        ? "animate-float"
                        : ""
                  }`}
                  style={{
                    background: `linear-gradient(45deg, ${theme.primary_color || "#8B5CF6"}, ${theme.secondary_color || "#3B82F6"})`,
                  }}
                />
                <div>
                  <p className="font-semibold">Your Profile</p>
                  <p className="text-sm text-gray-600">Preview of your customized theme</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500">
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
