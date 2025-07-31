"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Star, GitBranch, Eye, Download, Copy, Code } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CodeLoopCardProps {
  project: {
    id: string
    title: string
    description: string
    author: any
    language: string
    framework: string
    tags: string[]
    stats: {
      stars: number
      forks: number
      views: number
      branches: number
    }
    code_snippet: string
    created_at: Date
  }
}

export function CodeLoopCard({ project }: CodeLoopCardProps) {
  const [isStarred, setIsStarred] = useState(false)
  const [showFullCode, setShowFullCode] = useState(false)
  const { toast } = useToast()

  const handleStar = () => {
    setIsStarred(!isStarred)
    toast({
      description: isStarred ? "Removed from stars" : "Added to stars",
    })
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(project.code_snippet)
    toast({
      description: "Code copied to clipboard!",
    })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return num.toString()
  }

  const getLanguageColor = (language: string) => {
    const colors: { [key: string]: string } = {
      JavaScript: "bg-yellow-100 text-yellow-700",
      TypeScript: "bg-blue-100 text-blue-700",
      Python: "bg-green-100 text-green-700",
      Go: "bg-cyan-100 text-cyan-700",
      Rust: "bg-orange-100 text-orange-700",
      Java: "bg-red-100 text-red-700",
    }
    return colors[language] || "bg-gray-100 text-gray-700"
  }

  const getVerificationBadge = () => {
    if (!project.author.is_verified) return null
    return (
      <Badge
        variant="secondary"
        className={`ml-2 ${
          project.author.verification_level === "root"
            ? "bg-green-100 text-green-700 border-green-200"
            : "bg-blue-100 text-blue-700 border-blue-200"
        }`}
      >
        {project.author.verification_level === "root" ? "🌱" : "⭐"}
      </Badge>
    )
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={project.author.avatar_url || "/placeholder.svg"} />
              <AvatarFallback>{project.author.display_name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex items-center">
              <div>
                <p className="font-semibold text-sm">{project.author.display_name}</p>
                <p className="text-gray-500 text-xs">@{project.author.username}</p>
              </div>
              {getVerificationBadge()}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={getLanguageColor(project.language)}>{project.language}</Badge>
            {project.framework !== "None" && <Badge variant="outline">{project.framework}</Badge>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <h3 className="font-bold text-lg mb-2">{project.title}</h3>
          <p className="text-gray-600 text-sm">{project.description}</p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {project.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              #{tag}
            </Badge>
          ))}
        </div>

        {/* Code Preview */}
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between bg-gray-800 px-4 py-2">
            <div className="flex items-center space-x-2">
              <Code className="w-4 h-4 text-gray-400" />
              <span className="text-gray-300 text-sm">Code Preview</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCopyCode} className="text-gray-300 hover:text-white">
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-4">
            <pre className="text-sm text-gray-300 overflow-x-auto">
              <code>
                {showFullCode
                  ? project.code_snippet
                  : project.code_snippet.split("\n").slice(0, 8).join("\n") +
                    (project.code_snippet.split("\n").length > 8 ? "\n..." : "")}
              </code>
            </pre>
            {project.code_snippet.split("\n").length > 8 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullCode(!showFullCode)}
                className="text-blue-400 hover:text-blue-300 mt-2"
              >
                {showFullCode ? "Show Less" : "Show More"}
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center space-x-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStar}
              className={`flex items-center space-x-2 ${isStarred ? "text-yellow-500" : "text-gray-500"}`}
            >
              <Star className={`w-4 h-4 ${isStarred ? "fill-current" : ""}`} />
              <span>{formatNumber(project.stats.stars + (isStarred ? 1 : 0))}</span>
            </Button>

            <div className="flex items-center space-x-2 text-gray-500">
              <GitBranch className="w-4 h-4" />
              <span>{formatNumber(project.stats.forks)}</span>
            </div>

            <div className="flex items-center space-x-2 text-gray-500">
              <Eye className="w-4 h-4" />
              <span>{formatNumber(project.stats.views)}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <GitBranch className="w-4 h-4 mr-2" />
              Fork
            </Button>
            <Button size="sm" className="bg-gradient-to-r from-purple-500 to-blue-500">
              <Download className="w-4 h-4 mr-2" />
              Clone
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
