import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const language = searchParams.get('language')
    const framework = searchParams.get('framework')
    const sortBy = searchParams.get('sortBy') || 'recent'
    
    let query = supabase
      .from('developer_projects')
      .select(`
        *,
        author:profiles!developer_projects_author_id_fkey(
          id,
          username,
          display_name,
          avatar_url,
          is_verified,
          verification_level
        )
      `)

    // Apply filters
    if (language && language !== 'All') {
      query = query.eq('language', language)
    }
    if (framework && framework !== 'All') {
      query = query.eq('framework', framework)
    }

    // Apply sorting
    switch (sortBy) {
      case 'popular':
        query = query.order('stars', { ascending: false })
        break
      case 'most_forked':
        query = query.order('forks', { ascending: false })
        break
      case 'recent':
      default:
        query = query.order('created_at', { ascending: false })
        break
    }

    const { data: projects, error } = await query.limit(20)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Error fetching developer projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { 
      title, 
      description, 
      language, 
      framework, 
      tags, 
      codeSnippet,
      repositoryUrl,
      demoUrl 
    } = await request.json()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create developer project
    const { data: project, error } = await supabase
      .from('developer_projects')
      .insert({
        author_id: user.id,
        title: title,
        description: description,
        language: language,
        framework: framework || 'None',
        tags: tags || [],
        code_snippet: codeSnippet,
        repository_url: repositoryUrl,
        demo_url: demoUrl,
        stars: 0,
        forks: 0,
        views: 0,
        branches: 0
      })
      .select(`
        *,
        author:profiles!developer_projects_author_id_fkey(
          id,
          username,
          display_name,
          avatar_url,
          is_verified,
          verification_level
        )
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Project created successfully',
      project 
    })
  } catch (error) {
    console.error('Error creating developer project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
