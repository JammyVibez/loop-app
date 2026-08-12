import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const targetUrl = searchParams.get("url")

  if (!targetUrl) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 })
  }

  let parsedUrl: URL
  try {
    let cleanUrl = targetUrl
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = `https://${cleanUrl}`
    }
    parsedUrl = new URL(cleanUrl)
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  const domain = parsedUrl.hostname.replace(/^www\./, "")
  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

  // Default fallback metadata
  const metadata = {
    url: parsedUrl.href,
    domain,
    title: domain,
    description: `Visit ${domain}`,
    image: null as string | null,
    icon: favicon,
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3500)

    const res = await fetch(parsedUrl.href, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LoopBot/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    })
    clearTimeout(timeout)

    if (res.ok) {
      const html = await res.text()

      // Simple regex extraction for OG tags & HTML title/description
      const titleMatch =
        html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i) ||
        html.match(/<title[^>]*>([^<]+)<\/title>/i)

      const descMatch =
        html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["']/i)

      const imageMatch =
        html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)

      if (titleMatch?.[1]) {
        metadata.title = titleMatch[1].trim()
      }
      if (descMatch?.[1]) {
        metadata.description = descMatch[1].trim()
      }
      if (imageMatch?.[1]) {
        let img = imageMatch[1].trim()
        if (img.startsWith("//")) img = `https:${img}`
        else if (img.startsWith("/")) img = `${parsedUrl.origin}${img}`
        metadata.image = img
      }
    }
  } catch (err) {
    // Graceful fallback to domain metadata
  }

  return NextResponse.json({ success: true, metadata })
}
