"use client"

import Link from "next/link"
import { ArrowRight, Zap, Users, Palette, Code, Music, Camera } from "lucide-react"
import { Button } from "../ui/button"
import { Card, CardContent } from "../ui/card"

export function LandingContent() {
  const features = [
    {
      icon: <Zap className="h-8 w-8 text-yellow-500" />,
      title: "Create & Branch",
      description: "Start loops and let others branch your content to create amazing collaborative stories.",
    },
    {
      icon: <Users className="h-8 w-8 text-blue-500" />,
      title: "Join Circles",
      description: "Connect with like-minded creators in Discord-style communities focused on your interests.",
    },
    {
      icon: <Palette className="h-8 w-8 text-purple-500" />,
      title: "Customize Everything",
      description: "Personalize your profile with themes, colors, and 3D effects that reflect your style.",
    },
    {
      icon: <Code className="h-8 w-8 text-green-500" />,
      title: "Developer Friendly",
      description: "Upload code, share projects, and collaborate on development loops with built-in tools.",
    },
    {
      icon: <Music className="h-8 w-8 text-red-500" />,
      title: "Multi-Media Support",
      description: "Share videos, audio, images, and text. Create rich multimedia experiences.",
    },
    {
      icon: <Camera className="h-8 w-8 text-indigo-500" />,
      title: "Reels & Stories",
      description: "Create engaging reels that others can branch and remix in creative ways.",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-gray-900/95 dark:supports-[backdrop-filter]:bg-gray-900/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Loop
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/signup">
              <Button>Sign Up</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">
            Social Media
            <br />
            Reimagined
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
            Create, collaborate, and connect in the Loop ecosystem. Where every post can branch into infinite
            possibilities.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-3 text-lg"
              >
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="px-8 py-3 text-lg bg-transparent">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to create</h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Loop provides all the tools and features you need to express your creativity and connect with others.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-6 text-center">
                <div className="mb-4 flex justify-center">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-12 text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to join the Loop?</h2>
          <p className="text-xl mb-8 opacity-90">
            Start creating, collaborating, and connecting with creators worldwide.
          </p>
          <Link href="/signup">
            <Button size="lg" variant="secondary" className="px-8 py-3 text-lg">
              Sign Up Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-6 h-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xs">L</span>
                </div>
                <span className="font-bold text-lg bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Loop
                </span>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Social media reimagined for creators and collaborators.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li>
                  <Link href="/features" className="hover:text-purple-600">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-purple-600">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/premium" className="hover:text-purple-600">
                    Premium
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li>
                  <Link href="/about" className="hover:text-purple-600">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/careers" className="hover:text-purple-600">
                    Careers
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-purple-600">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li>
                  <Link href="/help" className="hover:text-purple-600">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-purple-600">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-purple-600">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t mt-8 pt-8 text-center text-gray-600 dark:text-gray-300">
            <p>&copy; 2024 Loop. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
