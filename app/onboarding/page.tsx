"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TreePine, Camera, Palette, Users, Sparkles, ArrowRight, Check } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

const INTERESTS = [
  "Art & Design",
  "Technology",
  "Writing",
  "Music",
  "Photography",
  "Gaming",
  "Science",
  "Business",
  "Education",
  "Health",
  "Travel",
  "Food",
  "Fashion",
  "Sports",
  "Movies",
  "Books",
  "Nature",
  "DIY",
]

const THEMES = [
  {
    name: "Purple Dream",
    primary: "#8B5CF6",
    secondary: "#06B6D4",
    preview: "bg-gradient-to-r from-purple-500 to-blue-500",
  },
  {
    name: "Ocean Breeze",
    primary: "#0EA5E9",
    secondary: "#10B981",
    preview: "bg-gradient-to-r from-blue-500 to-emerald-500",
  },
  {
    name: "Sunset Glow",
    primary: "#F59E0B",
    secondary: "#EF4444",
    preview: "bg-gradient-to-r from-amber-500 to-red-500",
  },
  {
    name: "Forest Green",
    primary: "#10B981",
    secondary: "#059669",
    preview: "bg-gradient-to-r from-emerald-500 to-green-600",
  },
  {
    name: "Rose Gold",
    primary: "#EC4899",
    secondary: "#F97316",
    preview: "bg-gradient-to-r from-pink-500 to-orange-500",
  },
  {
    name: "Midnight",
    primary: "#6366F1",
    secondary: "#8B5CF6",
    preview: "bg-gradient-to-r from-indigo-500 to-purple-500",
  },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [profileData, setProfileData] = useState({
    bio: "",
    interests: [] as string[],
    theme: THEMES[0],
    avatar_url: "",
  })
  const { user, updateProfile } = useAuth()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleInterestToggle = (interest: string) => {
    setProfileData((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }))
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'image')
      formData.append('folder', 'avatars')

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token || user?.access_token}`
        },
        body: formData
      })

      const result = await response.json()
      if (result.success) {
        setProfileData(prev => ({ ...prev, avatar_url: result.url }))
      }
    } catch (error) {
      console.error("Avatar upload failed:", error)
    }
  }

  const handleComplete = async () => {
  setSaving(true)
  setErrors({})
  
  try {
    // Validation
    if (!profileData.bio.trim()) {
      setErrors({ bio: "Bio is required" })
      setSaving(false)
      return
    }

    if (!profileData.avatar_url) {
      setErrors({ avatar_url: "Please upload an avatar" })
      setSaving(false)
      return
    }

    // Send to backend API
    const response = await fetch("/api/users/update-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user?.token}`,
      },
      body: JSON.stringify({
        bio: profileData.bio,
        interests: profileData.interests,
        avatar_url: profileData.avatar_url,
        profile_theme: {
          primary_color: profileData.theme.primary,
          secondary_color: profileData.theme.secondary,
          animation: "pulse-glow",
        },
        onboarding_completed: true,
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to save profile")
    }

    // (Optional) award coins
    await fetch('/api/users/coins/weekly', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user?.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        type: 'onboarding_bonus',
        amount: 100 
      })
    })

    // Redirect to their profile page
    router.push(`/`)
  } catch (error) {
    console.error("Failed to complete onboarding:", error)
    setErrors({ general: "Failed to complete onboarding. Please try again." })
  } finally {
    setSaving(false)
  }
}


  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <TreePine className="text-white w-8 h-8" />
              </div>
              <CardTitle className="text-3xl">Welcome to Loop!</CardTitle>
              <CardDescription className="text-lg">
                Let's set up your profile to help you connect with the right community
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <div className="relative inline-block">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={profileData.avatar_url || user?.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback className="text-2xl">{user?.display_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <Button 
                    size="icon" 
                    className="absolute -bottom-2 -right-2 rounded-full w-8 h-8" 
                    variant="secondary"
                    onClick={() => document.getElementById('onboarding-avatar-upload')?.click()}
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
                <h3 className="text-xl font-semibold mt-4">{user?.display_name}</h3>
                <p className="text-gray-600 dark:text-gray-400">@{user?.username}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Tell us about yourself</Label>
                <Textarea
                  id="bio"
                  placeholder="Share what inspires you, your creative interests, or what you hope to discover on Loop..."
                  value={profileData.bio}
                  onChange={(e) => setProfileData((prev) => ({ ...prev, bio: e.target.value }))}
                  className="min-h-[100px]"
                />
              </div>

              <Button onClick={() => setStep(2)} className="w-full" size="lg">
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )

      case 2:
        return (
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <Users className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <CardTitle className="text-2xl">What interests you?</CardTitle>
              <CardDescription>
                Select topics you're passionate about to discover relevant loops and communities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {INTERESTS.map((interest) => (
                  <Badge
                    key={interest}
                    variant={profileData.interests.includes(interest) ? "default" : "outline"}
                    className={`cursor-pointer p-3 text-center justify-center transition-all ${
                      profileData.interests.includes(interest)
                        ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                    onClick={() => handleInterestToggle(interest)}
                  >
                    {profileData.interests.includes(interest) && <Check className="w-3 h-3 mr-1" />}
                    {interest}
                  </Badge>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button onClick={() => setStep(3)} className="flex-1" disabled={profileData.interests.length === 0}>
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 3:
        return (
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <Palette className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <CardTitle className="text-2xl">Choose your theme</CardTitle>
              <CardDescription>Personalize your profile with a color theme that represents you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {THEMES.map((theme) => (
                  <div
                    key={theme.name}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                      profileData.theme.name === theme.name
                        ? "border-purple-500 ring-2 ring-purple-200 dark:ring-purple-800"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    onClick={() => setProfileData((prev) => ({ ...prev, theme }))}
                  >
                    <div className={`w-full h-16 rounded-md ${theme.preview} mb-3`} />
                    <p className="font-medium text-center">{theme.name}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  Back
                </Button>
                <Button onClick={() => setStep(4)} className="flex-1">
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 4:
        return (
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <Sparkles className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <CardTitle className="text-2xl">You're all set!</CardTitle>
              <CardDescription>Welcome to the Loop community. Start creating and connecting!</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6">
                <h3 className="font-semibold mb-4">What's next?</h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Create your first loop and start a creative tree
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Join circles based on your interests
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Connect with other creators and collaborate
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Explore trending loops and discover new ideas
                  </li>
                </ul>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  You've earned <span className="font-semibold text-purple-600">100 Loop Coins</span> for completing
                  your profile!
                </p>
              </div>

              <Button onClick={handleComplete} className="w-full" size="lg">
                Enter Loop <Sparkles className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-blue-900/20 p-4">
      <div className="w-full flex flex-col items-center">
        {/* Progress indicator */}
        <div className="flex items-center space-x-2 mb-8">
          {[1, 2, 3, 4].map((stepNumber) => (
            <div key={stepNumber} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= stepNumber
                    ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                {step > stepNumber ? <Check className="w-4 h-4" /> : stepNumber}
              </div>
              {stepNumber < 4 && (
                <div
                  className={`w-12 h-0.5 ${
                    step > stepNumber ? "bg-gradient-to-r from-purple-600 to-blue-600" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {renderStep()}
      </div>
    </div>
  )
}
