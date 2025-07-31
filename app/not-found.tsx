import Link from "next/link"
import { Button } from "@/components/ui/button"
import { TreePine, Home, Search } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-blue-900/20">
      <div className="text-center space-y-6 p-8">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            <TreePine className="text-white w-8 h-8" />
          </div>
        </div>

        {/* 404 Message */}
        <div className="space-y-2">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            404
          </h1>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Page Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-md">
            Looks like this loop got lost in the tree. The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            asChild
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/explore">
              <Search className="w-4 h-4 mr-2" />
              Explore Loops
            </Link>
          </Button>
        </div>

        {/* Helpful Links */}
        <div className="pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Looking for something specific?</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/trending" className="text-purple-600 hover:text-purple-500 dark:text-purple-400">
              Trending
            </Link>
            <Link href="/circles" className="text-purple-600 hover:text-purple-500 dark:text-purple-400">
              Circles
            </Link>
            <Link href="/developers" className="text-purple-600 hover:text-purple-500 dark:text-purple-400">
              Developers
            </Link>
            <Link href="/help" className="text-purple-600 hover:text-purple-500 dark:text-purple-400">
              Help Center
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
