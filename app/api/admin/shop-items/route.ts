import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getUserFromRequest } from "@/lib/server-auth";
import { sanitizeProfileCustomCss } from '@/lib/profile-custom-css'
import { safeThemeAssetUrl } from '@/lib/profile-theme'

/**
 * Profile-theme fields an admin can edit on an existing item. The CSS is
 * sanitised and the media URLs validated here, exactly as on create, so a
 * stale tab or a hand-written request cannot store a stylesheet that escapes
 * the profile or a background that is not a real asset.
 * `""` clears the field instead of saving an empty string.
 */
function sanitizeProfileThemeFields(itemData: unknown): { data?: Record<string, unknown>; error?: string } {
  if (!itemData || typeof itemData !== 'object' || Array.isArray(itemData)) return {}
  const data = { ...(itemData as Record<string, unknown>) }

  if (typeof data.profile_css === 'string' && data.profile_css.trim()) {
    try {
      data.profile_css = sanitizeProfileCustomCss(data.profile_css)
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Invalid profile CSS' }
    }
  } else {
    delete data.profile_css
  }

  for (const key of ['profile_background_url', 'profile_audio_url']) {
    if (!(key in data)) continue
    const raw = data[key]
    if (raw === null || raw === undefined || raw === '') {
      delete data[key]
      continue
    }
    const url = safeThemeAssetUrl(raw)
    if (!url) return { error: 'Use an https link or a Loop-hosted file for the theme media.' }
    data[key] = url
  }

  return { data }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Check admin permissions
    

    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const { data: items, error } = await supabase
      .from('shop_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, items })
  } catch (error) {
    console.error('Admin shop items error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const itemData = await request.json()
    const supabase = createServerClient()
    
    // Check admin permissions
    

    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    // Validate required fields
    if (!itemData.name || !itemData.category || !itemData.item_type) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Set default values. This schema has no `price`, `image_url` or
    // `animation_url` columns: the coin price is `price_coins`, and admin art
    // lives inside item_data, which is what the storefront reads.
    const baseItemData = itemData.item_data && typeof itemData.item_data === 'object' ? itemData.item_data : {}
    const sanitized = sanitizeProfileThemeFields(baseItemData)
    if (sanitized.error) {
      return NextResponse.json({ success: false, error: sanitized.error }, { status: 400 })
    }
    const safeItemData = sanitized.data ?? baseItemData
    const shopItem = {
      name: itemData.name,
      description: itemData.description || '',
      price_coins: itemData.price_coins || 0,
      price_usd: itemData.price_usd || null,
      category: itemData.category,
      item_type: itemData.item_type,
      rarity: itemData.rarity || 'common',
      premium_only: itemData.premium_only || false,
      item_data: {
        ...safeItemData,
        ...(itemData.image_url ? { image_url: itemData.image_url } : {}),
        ...(itemData.animation_url ? { animation_url: itemData.animation_url } : {}),
      },
      preview_data: itemData.preview_data || {},
      is_active: true
    }

    const { data: item, error } = await supabase
      .from('shop_items')
      .insert(shopItem)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, item })
  } catch (error) {
    console.error('Create shop item error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // `price`, `image_url` and `animation_url` are client-side form fields on
    // this schema: the coin price is price_coins and art is folded into
    // item_data before it reaches here, so they must not be written as columns.
    const { id, price: _price, image_url: _imageUrl, animation_url: _animationUrl, ...updateData } = await request.json()
    const supabase = createServerClient()

    // Check admin permissions
    

    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const sanitized = sanitizeProfileThemeFields(updateData.item_data)
    if (sanitized.error) {
      return NextResponse.json({ success: false, error: sanitized.error }, { status: 400 })
    }
    if (sanitized.data) updateData.item_data = sanitized.data

    const { data: item, error } = await supabase
      .from('shop_items')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, item })
  } catch (error) {
    console.error('Update shop item error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Item ID required' }, { status: 400 })
    }

    const supabase = createServerClient()
    
    // Check admin permissions
    

    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('shop_items')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete shop item error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
