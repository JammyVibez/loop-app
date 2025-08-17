interface GiftAsset {
  id: string
  name: string
  category: 'dragon' | 'forest' | 'special' | 'premium'
  type: 'static' | 'animated' | 'interactive'
  url: string
  thumbnail_url?: string
  size: number
  format: 'png' | 'gif' | 'webp' | 'svg' | 'lottie'
  dimensions: {
    width: number
    height: number
  }
  metadata: {
    created_at: string
    updated_at: string
    tags: string[]
    rarity: 'common' | 'rare' | 'epic' | 'legendary'
    premium_only: boolean
  }
}

class GiftAssetsManager {
  private baseUrl: string
  private cache: Map<string, GiftAsset> = new Map()
  private preloadedAssets: Set<string> = new Set()

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_CDN_URL || '/assets/gifts'
  }

  // Dragon Theme Assets
  private dragonAssets: GiftAsset[] = [
    {
      id: 'baby_dragon',
      name: 'Baby Dragon',
      category: 'dragon',
      type: 'animated',
      url: `${this.baseUrl}/dragons/baby-dragon.gif`,
      thumbnail_url: `${this.baseUrl}/dragons/baby-dragon-thumb.webp`,
      size: 245760, // 240KB
      format: 'gif',
      dimensions: { width: 128, height: 128 },
      metadata: {
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['dragon', 'cute', 'companion', 'animated'],
        rarity: 'rare',
        premium_only: false,
      },
    },
    {
      id: 'dragon_egg',
      name: 'Dragon Egg',
      category: 'dragon',
      type: 'interactive',
      url: `${this.baseUrl}/dragons/dragon-egg.gif`,
      thumbnail_url: `${this.baseUrl}/dragons/dragon-egg-thumb.webp`,
      size: 180224, // 176KB
      format: 'gif',
      dimensions: { width: 96, height: 96 },
      metadata: {
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['dragon', 'egg', 'mystery', 'hatching'],
        rarity: 'common',
        premium_only: false,
      },
    },
    {
      id: 'fire_breath',
      name: 'Fire Breath',
      category: 'dragon',
      type: 'animated',
      url: `${this.baseUrl}/dragons/fire-breath.gif`,
      thumbnail_url: `${this.baseUrl}/dragons/fire-breath-thumb.webp`,
      size: 512000, // 500KB
      format: 'gif',
      dimensions: { width: 256, height: 128 },
      metadata: {
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['dragon', 'fire', 'breath', 'effect'],
        rarity: 'epic',
        premium_only: true,
      },
    },
    {
      id: 'dragon_wings',
      name: 'Dragon Wings',
      category: 'dragon',
      type: 'animated',
      url: `${this.baseUrl}/dragons/dragon-wings.gif`,
      thumbnail_url: `${this.baseUrl}/dragons/dragon-wings-thumb.webp`,
      size: 409600, // 400KB
      format: 'gif',
      dimensions: { width: 192, height: 192 },
      metadata: {
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['dragon', 'wings', 'avatar', 'majestic'],
        rarity: 'epic',
        premium_only: true,
      },
    },
    {
      id: 'ancient_dragon',
      name: 'Ancient Dragon',
      category: 'dragon',
      type: 'interactive',
      url: `${this.baseUrl}/dragons/ancient-dragon.gif`,
      thumbnail_url: `${this.baseUrl}/dragons/ancient-dragon-thumb.webp`,
      size: 1048576, // 1MB
      format: 'gif',
      dimensions: { width: 512, height: 512 },
      metadata: {
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['dragon', 'ancient', 'legendary', 'guardian'],
        rarity: 'legendary',
        premium_only: true,
      },
    },
  ]

  // Forest Theme Assets
  private forestAssets: GiftAsset[] = [
    {
      id: 'growing_tree',
      name: 'Growing Tree',
      category: 'forest',
      type: 'animated',
      url: `${this.baseUrl}/forest/growing-tree.gif`,
      thumbnail_url: `${this.baseUrl}/forest/growing-tree-thumb.webp`,
      size: 327680, // 320KB
      format: 'gif',
      dimensions: { width: 128, height: 192 },
      metadata: {
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['tree', 'growth', 'nature', 'animated'],
        rarity: 'rare',
        premium_only: false,
      },
    },
    {
      id: 'forest_sprite',
      name: 'Forest Sprite',
      category: 'forest',
      type: 'animated',
      url: `${this.baseUrl}/forest/forest-sprite.gif`,
      thumbnail_url: `${this.baseUrl}/forest/forest-sprite-thumb.webp`,
      size: 204800, // 200KB
      format: 'gif',
      dimensions: { width: 96, height: 96 },
      metadata: {
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['sprite', 'fairy', 'forest', 'magical'],
        rarity: 'rare',
        premium_only: false,
      },
    },
    {
      id: 'flower_bloom',
      name: 'Flower Bloom',
      category: 'forest',
      type: 'animated',
      url: `${this.baseUrl}/forest/flower-bloom.gif`,
      thumbnail_url: `${this.baseUrl}/forest/flower-bloom-thumb.webp`,
      size: 153600, // 150KB
      format: 'gif',
      dimensions: { width: 128, height: 128 },
      metadata: {
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['flower', 'bloom', 'spring', 'beautiful'],
        rarity: 'common',
        premium_only: false,
      },
    },
    {
      id: 'ancient_oak',
      name: 'Ancient Oak',
      category: 'forest',
      type: 'interactive',
      url: `${this.baseUrl}/forest/ancient-oak.gif`,
      thumbnail_url: `${this.baseUrl}/forest/ancient-oak-thumb.webp`,
      size: 716800, // 700KB
      format: 'gif',
      dimensions: { width: 256, height: 384 },
      metadata: {
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['oak', 'ancient', 'wisdom', 'majestic'],
        rarity: 'epic',
        premium_only: true,
      },
    },
    {
      id: 'nature_crown',
      name: 'Nature Crown',
      category: 'forest',
      type: 'animated',
      url: `${this.baseUrl}/forest/nature-crown.gif`,
      thumbnail_url: `${this.baseUrl}/forest/nature-crown-thumb.webp`,
      size: 307200, // 300KB
      format: 'gif',
      dimensions: { width: 128, height: 64 },
      metadata: {
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['crown', 'leaves', 'flowers', 'royal'],
        rarity: 'epic',
        premium_only: true,
      },
    },
    {
      id: 'world_tree',
      name: 'World Tree',
      category: 'forest',
      type: 'interactive',
      url: `${this.baseUrl}/forest/world-tree.gif`,
      thumbnail_url: `${this.baseUrl}/forest/world-tree-thumb.webp`,
      size: 1228800, // 1.2MB
      format: 'gif',
      dimensions: { width: 512, height: 768 },
      metadata: {
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['world', 'tree', 'cosmic', 'legendary'],
        rarity: 'legendary',
        premium_only: true,
      },
    },
  ]

  // Special Assets
  private specialAssets: GiftAsset[] = [
    {
      id: 'birthday_cake',
      name: 'Birthday Cake',
      category: 'special',
      type: 'animated',
      url: `${this.baseUrl}/special/birthday-cake.gif`,
      thumbnail_url: `${this.baseUrl}/special/birthday-cake-thumb.webp`,
      size: 256000, // 250KB
      format: 'gif',
      dimensions: { width: 128, height: 128 },
      metadata: {
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['birthday', 'cake', 'celebration', 'party'],
        rarity: 'common',
        premium_only: false,
      },
    },
    {
      id: 'diamond_ring',
      name: 'Diamond Ring',
      category: 'special',
      type: 'animated',
      url: `${this.baseUrl}/special/diamond-ring.gif`,
      thumbnail_url: `${this.baseUrl}/special/diamond-ring-thumb.webp`,
      size: 409600, // 400KB
      format: 'gif',
      dimensions: { width: 96, height: 96 },
      metadata: {
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['diamond', 'ring', 'luxury', 'sparkle'],
        rarity: 'legendary',
        premium_only: true,
      },
    },
    {
      id: 'floating_heart',
      name: 'Floating Heart',
      category: 'special',
      type: 'animated',
      url: `${this.baseUrl}/special/floating-heart.gif`,
      thumbnail_url: `${this.baseUrl}/special/floating-heart-thumb.webp`,
      size: 102400, // 100KB
      format: 'gif',
      dimensions: { width: 64, height: 64 },
      metadata: {
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['heart', 'love', 'floating', 'romantic'],
        rarity: 'common',
        premium_only: false,
      },
    },
  ]

  // Premium Assets
  private premiumAssets: GiftAsset[] = [
    {
      id: 'premium_crown',
      name: 'Premium Crown',
      category: 'premium',
      type: 'animated',
      url: `${this.baseUrl}/premium/premium-crown.gif`,
      thumbnail_url: `${this.baseUrl}/premium/premium-crown-thumb.webp`,
      size: 512000, // 500KB
      format: 'gif',
      dimensions: { width: 128, height: 96 },
      metadata: {
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['premium', 'crown', 'royal', 'exclusive'],
        rarity: 'legendary',
        premium_only: true,
      },
    },
    {
      id: 'golden_aura',
      name: 'Golden Aura',
      category: 'premium',
      type: 'animated',
      url: `${this.baseUrl}/premium/golden-aura.gif`,
      thumbnail_url: `${this.baseUrl}/premium/golden-aura-thumb.webp`,
      size: 614400, // 600KB
      format: 'gif',
      dimensions: { width: 192, height: 192 },
      metadata: {
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['golden', 'aura', 'premium', 'glow'],
        rarity: 'epic',
        premium_only: true,
      },
    },
  ]

  // Initialize all assets
  private allAssets: GiftAsset[] = [
    ...this.dragonAssets,
    ...this.forestAssets,
    ...this.specialAssets,
    ...this.premiumAssets,
  ]

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_CDN_URL || '/assets/gifts'
    this.initializeCache()
  }

  private initializeCache() {
    this.allAssets.forEach(asset => {
      this.cache.set(asset.id, asset)
    })
  }

  // Get asset by ID
  getAsset(id: string): GiftAsset | null {
    return this.cache.get(id) || null
  }

  // Get assets by category
  getAssetsByCategory(category: string): GiftAsset[] {
    return this.allAssets.filter(asset => asset.category === category)
  }

  // Get assets by rarity
  getAssetsByRarity(rarity: string): GiftAsset[] {
    return this.allAssets.filter(asset => asset.metadata.rarity === rarity)
  }

  // Get premium assets
  getPremiumAssets(): GiftAsset[] {
    return this.allAssets.filter(asset => asset.metadata.premium_only)
  }

  // Search assets
  searchAssets(query: string): GiftAsset[] {
    const lowercaseQuery = query.toLowerCase()
    return this.allAssets.filter(asset => 
      asset.name.toLowerCase().includes(lowercaseQuery) ||
      asset.metadata.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    )
  }

  // Preload asset
  async preloadAsset(id: string): Promise<boolean> {
    const asset = this.getAsset(id)
    if (!asset || this.preloadedAssets.has(id)) {
      return false
    }

    try {
      const response = await fetch(asset.url)
      if (response.ok) {
        this.preloadedAssets.add(id)
        return true
      }
      return false
    } catch (error) {
      console.error(`Failed to preload asset ${id}:`, error)
      return false
    }
  }

  // Preload multiple assets
  async preloadAssets(ids: string[]): Promise<boolean[]> {
    return Promise.all(ids.map(id => this.preloadAsset(id)))
  }

  // Get optimized URL based on device capabilities
  getOptimizedUrl(id: string, options?: {
    width?: number
    height?: number
    format?: 'webp' | 'png' | 'gif'
    quality?: number
  }): string | null {
    const asset = this.getAsset(id)
    if (!asset) return null

    let url = asset.url

    // If options are provided, construct optimized URL
    if (options) {
      const params = new URLSearchParams()
      
      if (options.width) params.append('w', options.width.toString())
      if (options.height) params.append('h', options.height.toString())
      if (options.format) params.append('f', options.format)
      if (options.quality) params.append('q', options.quality.toString())

      if (params.toString()) {
        url += `?${params.toString()}`
      }
    }

    return url
  }

  // Get thumbnail URL
  getThumbnailUrl(id: string): string | null {
    const asset = this.getAsset(id)
    return asset?.thumbnail_url || null
  }

  // Check if asset is preloaded
  isPreloaded(id: string): boolean {
    return this.preloadedAssets.has(id)
  }

  // Get asset metadata
  getAssetMetadata(id: string): GiftAsset['metadata'] | null {
    const asset = this.getAsset(id)
    return asset?.metadata || null
  }

  // Get all assets
  getAllAssets(): GiftAsset[] {
    return [...this.allAssets]
  }

  // Get assets count by category
  getAssetCountByCategory(): Record<string, number> {
    const counts: Record<string, number> = {}
    this.allAssets.forEach(asset => {
      counts[asset.category] = (counts[asset.category] || 0) + 1
    })
    return counts
  }

  // Get total assets size
  getTotalAssetsSize(): number {
    return this.allAssets.reduce((total, asset) => total + asset.size, 0)
  }

  // Validate asset URL
  async validateAssetUrl(id: string): Promise<boolean> {
    const asset = this.getAsset(id)
    if (!asset) return false

    try {
      const response = await fetch(asset.url, { method: 'HEAD' })
      return response.ok
    } catch (error) {
      console.error(`Failed to validate asset ${id}:`, error)
      return false
    }
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear()
    this.preloadedAssets.clear()
    this.initializeCache()
  }

  // Add custom asset (for admin use)
  addCustomAsset(asset: GiftAsset): void {
    this.allAssets.push(asset)
    this.cache.set(asset.id, asset)
  }

  // Remove asset (for admin use)
  removeAsset(id: string): boolean {
    const index = this.allAssets.findIndex(asset => asset.id === id)
    if (index !== -1) {
      this.allAssets.splice(index, 1)
      this.cache.delete(id)
      this.preloadedAssets.delete(id)
      return true
    }
    return false
  }
}

// Export singleton instance
export const giftAssetsManager = new GiftAssetsManager()
export type { GiftAsset }
