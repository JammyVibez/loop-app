import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const category = searchParams.get('category') || 'trending'
    const hashtag = searchParams.get('hashtag')
    const user_id = searchParams.get('user_id')
    const offset = (page - 1) * limit

    let query = supabase
      .from('reels')
      .select(`
        *,
        author:profiles!author_id (
          id,
          username,
          display_name,
          avatar_url,
          is_verified,
          is_premium
        ),
        interactions:reel_interactions (
          interaction_type,
          user_id
        )
      `)
      .eq('visibility', 'public')
      .range(offset, offset + limit - 1)

    // Apply filters based on category
    switch (category) {
      case 'trending':
        query = query.order('view_count', { ascending: false })
        break
      case 'recent':
        query = query.order('created_at', { ascending: false })
        break
      case 'following':
        // This would require a more complex query with joins
        // For now, just return recent
        query = query.order('created_at', { ascending: false })
        break
      default:
        query = query.order('created_at', { ascending: false })
    }

    if (hashtag) {
      query = query.contains('hashtags', [hashtag])
    }

    if (user_id) {
      query = query.eq('author_id', user_id)
    }

    const { data: reels, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Process reels to include interaction counts and user interactions
    const processedReels = reels?.map(reel => ({
      ...reel,
      is_liked: reel.interactions?.some((i: any) => i.interaction_type === 'like' && i.user_id === user_id) || false,
      is_saved: reel.interactions?.some((i: any) => i.interaction_type === 'save' && i.user_id === user_id) || false,
      interactions: undefined // Remove raw interactions from response
    }))

    return NextResponse.json({
      success: true,
      data: {
        reels: processedReels,
        page,
        limit,
        has_more: reels?.length === limit
      }
    })

  } catch (error) {
    console.error("Get reels error:", error)
    return NextResponse.json({ error: "Failed to fetch reels" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    const body = await request.json()
    const { 
      title, 
      description, 
      content_type, 
      content_url, 
      thumbnail_url,
      duration,
      hashtags, 
      music_id,
      effects,
      visibility,
      allows_comments,
      allows_duets,
      allows_downloads
    } = body

    if (!title?.trim() || !content_type || !content_url) {
      return NextResponse.json({ 
        error: "Title, content_type, and content_url are required" 
      }, { status: 400 })
    }

    // Validate content type
    const validTypes = ['video', 'image', 'audio', 'text']
    if (!validTypes.includes(content_type)) {
      return NextResponse.json({ 
        error: "Invalid content type" 
      }, { status: 400 })
    }

    const { data: reel, error } = await supabase
      .from('reels')
      .insert({
        author_id: user.id,
        title: title.trim(),
        description: description?.trim(),
        content_type,
        content_url,
        thumbnail_url,
        duration: duration || null,
        hashtags: hashtags || [],
        music_id: music_id || null,
        effects: effects || null,
        visibility: visibility || 'public',
        allows_comments: allows_comments !== false,
        allows_duets: allows_duets !== false,
        allows_downloads: allows_downloads !== false
      })
      .select(`
        *,
        author:profiles!author_id (
          id,
          username,
          display_name,
          avatar_url,
          is_verified
        )
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { reel }
    })

  } catch (error) {
    console.error("Create reel error:", error)
    return NextResponse.json({ error: "Failed to create reel" }, { status: 500 })
  }
}
