"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Star, Download, Eye, ShoppingCart, Sparkles, Zap, Heart, Loader2, Check } from "lucide-react"
import { useTheme3D } from "@/providers/theme-3d-provider"
import { useRealtime } from "@/hooks/use-realtime"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

interface ThemeMarketplaceProps {
  userId?: string
}

interface MarketplaceTheme {
  id: string
  name: string
  description: string
  category: string
  price_coins: number
  price_usd?: number
  rating_average: number
  rating_count: number
  download_count: number
  preview_images: string[]
  rarity: string
  tags: string[]
  theme_data: any
  effects_3d: any
  is_active: boolean
  is_owned: boolean
  created_at: string
  updated_at: string
}

export function ThemeMarketplace({ userId }: ThemeMarketplaceProps) {
  const [themes, setThemes] = useState<MarketplaceTheme[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [sortBy, setSortBy] = useState("popular")
  const [previewTheme, setPreviewTheme] = useState<MarketplaceTheme | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)

  const { currentTheme, applyTheme, previewTheme: previewThemeAction, stopPreview, isPreviewMode } = useTheme3D()

  const { socket, isConnected } = useRealtime()
  const { user } = useAuth()
  const { toast } = useToast()

  const categories = [
    { id: "all", name: "All Themes", icon: Sparkles },
    { id: "anime", name: "Anime", icon: Heart },
    { id: "gaming", name: "Gaming", icon: Zap },
    { id: "nature", name: "Nature", icon: "🌿" },
    { id: "abstract", name: "Abstract", icon: "🎨" },
    { id: "minimal", name: "Minimal", icon: "⚪" },
  ]

  const rarityColors = {
    common: "bg-gray-500",
    rare: "bg-blue-500",
    epic: "bg-purple-500",
    legendary: "bg-yellow-500",
  }

  useEffect(() => {
    fetchThemes()
  }, [selectedCategory, searchQuery, sortBy, user?.id])

  useEffect(() => {
    if (socket && isConnected) {
      // Listen for real-time theme updates
      socket.on("theme_added", (newTheme: MarketplaceTheme) => {
        setThemes((prev) => [newTheme, ...prev])
        toast({
          title: "New Theme Available!",
          description: `${newTheme.name} has been added to the marketplace.`,
        })
      })

      socket.on("theme_updated", (updatedTheme: MarketplaceTheme) => {
        setThemes((prev) => prev.map((theme) => (theme.id === updatedTheme.id ? updatedTheme : theme)))
      })

      socket.on("theme_removed", (themeId: string) => {
        setThemes((prev) => prev.filter((theme) => theme.id !== themeId))
        toast({
          title: "Theme Removed",
          description: "A theme has been removed from the marketplace.",
          variant: "destructive",
        })
      })

      return () => {
        socket.off("theme_added")
        socket.off("theme_updated")
        socket.off("theme_removed")
      }
    }
  }, [socket, isConnected, toast])

  const fetchThemes = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        category: selectedCategory,
        search: searchQuery,
        sortBy: sortBy,
        ...(user?.id && { userId: user.id }),
      })

      const response = await fetch(`/api/themes?${params}`)
      const data = await response.json()

      if (data.themes) {
        setThemes(data.themes)
      }
    } catch (error) {
      console.error("Error fetching themes:", error)
      toast({
        title: "Error",
        description: "Failed to load themes",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = (theme: MarketplaceTheme) => {
    setPreviewTheme(theme)
    setIsPreviewOpen(true)

    // Convert theme data to Theme3DConfig format
    const themeConfig = {
      id: theme.id,
      name: theme.name,
      category: theme.category,
      colors: theme.theme_data?.colors || {},
      effects3D: theme.effects_3d || {},
      components: theme.theme_data?.components || {},
      animations: theme.theme_data?.animations || {},
      environment: theme.theme_data?.environment || { type: "gradient", config: {} },
    }

    previewThemeAction(themeConfig)
  }

  const handleStopPreview = () => {
    setIsPreviewOpen(false)
    setPreviewTheme(null)
    stopPreview()
  }

  const handlePurchase = async (theme: MarketplaceTheme) => {
    if (!user?.token) {
      toast({
        title: "Authentication Required",
        description: "Please log in to purchase themes.",
        variant: "destructive",
      })
      return
    }

    if (theme.is_owned) {
      toast({
        title: "Already Owned",
        description: "You already own this theme!",
        variant: "destructive",
      })
      return
    }

    if ((user.loop_coins || 0) < theme.price_coins) {
      toast({
        title: "Insufficient Coins",
        description: "You don't have enough Loop Coins for this theme.",
        variant: "destructive",
      })
      return
    }

    setPurchasing(theme.id)

    try {
      const response = await fetch("/api/themes/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ theme_id: theme.id }),
      })

      const data = await response.json()

      if (data.success) {
        // Update theme ownership locally
        setThemes((prev) =>
          prev.map((t) => (t.id === theme.id ? { ...t, is_owned: true, download_count: t.download_count + 1 } : t)),
        )

        toast({
          title: "Theme Purchased!",
          description: `You've successfully purchased ${theme.name}!`,
        })

        // Emit real-time update
        if (socket && isConnected) {
          socket.emit("theme_purchased", {
            user_id: user.id,
            theme_id: theme.id,
            theme_name: theme.name,
          })
        }
      } else {
        throw new Error(data.error || "Purchase failed")
      }
    } catch (error) {
      console.error("Purchase error:", error)
      toast({
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : "Failed to purchase theme",
        variant: "destructive",
      })
    } finally {
      setPurchasing(null)
    }
  }

  const handleApply = async (themeId: string) => {
    try {
      await applyTheme(themeId)
      handleStopPreview()
      toast({
        title: "Theme Applied!",
        description: "Your new theme has been activated.",
      })
    } catch (error) {
      console.error("Failed to apply theme:", error)
      toast({
        title: "Error",
        description: "Failed to apply theme",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading themes...</span>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-3d-glow">Theme Marketplace</h1>
        <p className="text-lg opacity-80">Transform your experience with stunning 3D themes</p>
        {isConnected && (
          <Badge variant="outline" className="bg-green-50 text-green-700">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
            Live Updates
          </Badge>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 opacity-50" />
          <Input
            placeholder="Search themes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 rounded-lg bg-white border border-gray-200"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Categories */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          {categories.map((category) => (
            <TabsTrigger key={category.id} value={category.id}>
              <span className="mr-2">
                {typeof category.icon === "string" ? category.icon : <category.icon className="h-4 w-4" />}
              </span>
              {category.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Preview Mode Banner */}
      {isPreviewMode && previewTheme && (
        <div className="p-4 border-2 border-purple-500 bg-purple-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-purple-600" />
              <span className="font-medium">Preview Mode: {previewTheme.name}</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleApply(previewTheme.id)}>Apply Theme</Button>
              <Button variant="outline" onClick={handleStopPreview}>
                Stop Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Theme Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {themes.map((theme) => (
          <Card key={theme.id} className="hover:shadow-lg transition-all duration-200 overflow-hidden">
            <div className="relative">
              {/* Theme Preview Image */}
              <div className="h-48 bg-gradient-to-br from-purple-100 to-blue-100 relative overflow-hidden">
                {theme.preview_images?.[0] ? (
                  <img
                    src={theme.preview_images[0] || "/placeholder.svg"}
                    alt={theme.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Sparkles className="h-12 w-12 opacity-50" />
                  </div>
                )}

                {/* Rarity Badge */}
                <Badge
                  className={`absolute top-2 right-2 ${rarityColors[theme.rarity as keyof typeof rarityColors]} text-white`}
                >
                  {theme.rarity}
                </Badge>

                {/* Owned Badge */}
                {theme.is_owned && (
                  <Badge className="absolute top-2 left-2 bg-green-500 text-white">
                    <Check className="w-3 h-3 mr-1" />
                    Owned
                  </Badge>
                )}
              </div>

              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold">{theme.name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{theme.description}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current text-yellow-500" />
                    <span>{theme.rating_average.toFixed(1)}</span>
                    <span>({theme.rating_count})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    <span>{theme.download_count.toLocaleString()}</span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {theme.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-lg font-bold text-purple-600">
                      {theme.price_coins.toLocaleString()} coins
                    </span>
                    {theme.price_usd && <span className="text-sm text-gray-500">or ${theme.price_usd}</span>}
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handlePreview(theme)}>
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>

                    {currentTheme?.id === theme.id ? (
                      <Badge variant="secondary" className="px-3 py-1">
                        Active
                      </Badge>
                    ) : theme.is_owned ? (
                      <Button
                        size="sm"
                        onClick={() => handleApply(theme.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Apply
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handlePurchase(theme)}
                        disabled={!user || purchasing === theme.id}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {purchasing === theme.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Buying...
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="h-4 w-4 mr-1" />
                            Buy
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {themes.length === 0 && (
        <div className="text-center py-12">
          <Sparkles className="h-12 w-12 mx-auto opacity-50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No themes found</h3>
          <p className="text-gray-600">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Theme Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">{previewTheme?.name} Preview</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-gray-600">{previewTheme?.description}</p>

            {/* Preview Controls */}
            <div className="flex gap-2">
              <Button onClick={() => previewTheme && handleApply(previewTheme.id)}>Apply Theme</Button>
              <Button variant="outline" onClick={handleStopPreview}>
                Stop Preview
              </Button>
              {previewTheme && !previewTheme.is_owned && (
                <Button variant="outline" onClick={() => handlePurchase(previewTheme)}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Purchase ({previewTheme.price_coins} coins)
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
