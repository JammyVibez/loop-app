"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { SearchResults } from "@/components/search/search-results"

interface SearchPageProps {
  params: {
    query: string
  }
}

export default function SearchPage({ params }: SearchPageProps) {
  const decodedQuery = decodeURIComponent(params.query)
  const [searchQuery, setSearchQuery] = useState(decodedQuery)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setSearchQuery(decodedQuery)
    performSearch(decodedQuery)
  }, [decodedQuery])

  const performSearch = async (searchTerm: string) => {
    setLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Filter results based on search term
    const filteredResults = {
      loops: mockSearchResults.loops.filter(
        (loop) =>
          loop.content.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          loop.author.display_name.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
      users: mockSearchResults.users.filter(
        (user) =>
          user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.bio.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
      hashtags: mockSearchResults.hashtags.filter((hashtag) =>
        hashtag.tag.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    }

    setResults(filteredResults)
    setLoading(false)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      window.history.pushState({}, "", `/search/${encodeURIComponent(searchQuery.trim())}`)
      performSearch(searchQuery.trim())
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "k"
    }
    return num.toString()
  }

  // Mock search results
  const mockSearchResults = {
    loops: [
      {
        id: "search-1",
        author: {
          id: "1",
          username: "storyteller",
          display_name: "Story Teller",
          avatar_url: "/placeholder.svg?height=40&width=40",
          is_verified: true,
          verification_level: "influencer" as const,
          is_premium: true,
        },
        content: {
          type: "text" as const,
          text: "Building a React component library with TypeScript. Here's my approach to creating reusable components... #react #typescript #webdev",
        },
        created_at: new Date("2024-01-15T10:30:00Z"),
        stats: { likes: 234, branches: 12, comments: 45, saves: 67 },
      },
    ],
    users: [
      {
        id: "1",
        username: "reactdev",
        display_name: "React Developer",
        avatar_url: "/placeholder.svg?height=40&width=40",
        bio: "Building amazing React applications",
        followers: 1234,
        is_verified: true,
        is_premium: false,
      },
      {
        id: "2",
        username: "typescriptpro",
        display_name: "TypeScript Pro",
        avatar_url: "/placeholder.svg?height=40&width=40",
        bio: "TypeScript enthusiast and educator",
        followers: 567,
        is_verified: false,
        is_premium: true,
      },
    ],
    hashtags: [
      { tag: "react", count: 15420 },
      { tag: "typescript", count: 8930 },
      { tag: "webdev", count: 12340 },
      { tag: "javascript", count: 20150 },
    ],
  }

  const [results, setResults] = useState(mockSearchResults)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Search Results</h1>
            <p className="text-gray-600 dark:text-gray-400">Results for "{decodedQuery}"</p>
          </div>

          <SearchResults query={decodedQuery} results={results} loading={loading} />
        </div>
      </main>
    </div>
  )
}
