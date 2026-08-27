import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const language = searchParams.get('language')
    const framework = searchParams.get('framework')
    const sortBy = searchParams.get('sortBy') || 'recent'
    const limit = Math.min(Number.parseInt(searchParams.get('limit') || '20', 10) || 20, 50)
    
    let query = supabase
      .from('developer_projects')
      .select(`
        *,
        author:profiles!developer_projects_author_id_fkey(
          id,
          username,
          display_name,
          avatar_url, video_avatar_url,
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

    // mine=true returns only the signed-in user's projects (used by the
    // Dev Quest submission picker).
    if (searchParams.get('mine') === 'true') {
      const user = await getUserFromRequest(request)
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      query = query.eq('author_id', user.id)
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

    const { data: projects, error } = await query.limit(limit)

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


    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      title,
      description,
      language,
      framework,
      tags,
      codeSnippet,
      repositoryUrl,
      demoUrl,
      files,
      fileTree,
      repoZipUrl,
    } = await request.json()

    const safeFiles = Array.isArray(files)
      ? files
          .filter((f: any) => f && typeof f.url === "string" && typeof f.name === "string")
          .slice(0, 5)
          .map((f: any) => ({
            name: String(f.name).slice(0, 200),
            url: f.url,
            size: Number(f.size) || undefined,
            format: f.format || undefined,
          }))
      : []

    // GitHub-style repo file tree extracted from a ZIP (see lib/dev-project-zip.ts).
    const safeFileTree = Array.isArray(fileTree)
      ? fileTree
          .filter((f: any) => f && typeof f.url === "string" && typeof f.name === "string")
          .slice(0, 300)
          .map((f: any) => ({
            path: String(f.path || f.name).slice(0, 500),
            name: String(f.name).slice(0, 200),
            url: String(f.url),
            size: Number(f.size) || 0,
            language: String(f.language || "Text").slice(0, 50),
          }))
      : []

    const safeRepoZipUrl =
      typeof repoZipUrl === "string" && repoZipUrl.trim() ? repoZipUrl.trim().slice(0, 2000) : null

    // Code is optional as long as at least one file is attached — someone
    // sharing a design asset, dataset, or doc shouldn't have to paste fake
    // code just to satisfy a form field.
    if (!title?.trim() || !description?.trim() || !language?.trim()) {
      return NextResponse.json(
        { error: 'title, description, and language are required' },
        { status: 400 },
      )
    }
    if (!codeSnippet?.trim() && safeFiles.length === 0 && safeFileTree.length === 0) {
      return NextResponse.json(
        { error: 'Add a code snippet, attach a file, or upload a project ZIP' },
        { status: 400 },
      )
    }

    // Create developer project
    let { data: project, error } = await supabase
      .from('developer_projects')
      .insert({
        author_id: user.id,
        title: title,
        description: description,
        language: language,
        framework: framework || 'None',
        tags: tags || [],
        code_snippet: codeSnippet?.trim() || "",
        files: safeFiles,
        file_tree: safeFileTree,
        repo_zip_url: safeRepoZipUrl,
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
          avatar_url, video_avatar_url,
          is_verified,
          verification_level
        )
      `)
      .single()

    // Retry without `files` if an older schema cache doesn't have the column yet.
    if (error?.code === "PGRST204" && /files/i.test(error.message || "")) {
      ;({ data: project, error } = await supabase
        .from('developer_projects')
        .insert({
          author_id: user.id,
          title,
          description,
          language,
          framework: framework || 'None',
          tags: tags || [],
          code_snippet: codeSnippet?.trim() || "",
          repository_url: repositoryUrl,
          demo_url: demoUrl,
          stars: 0,
          forks: 0,
          views: 0,
          branches: 0,
        })
        .select(`
          *,
          author:profiles!developer_projects_author_id_fkey(
            id,
            username,
            display_name,
            avatar_url, video_avatar_url,
            is_verified,
            verification_level
          )
        `)
        .single())
    }

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
