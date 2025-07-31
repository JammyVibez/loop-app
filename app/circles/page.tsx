import { Header } from "@/components/header"
import { CirclesList } from "@/components/circles/circles-list"
import { CreateCircleButton } from "@/components/circles/create-circle-button"

export default function CirclesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Loop Circles
            </h1>
            <p className="text-gray-600 text-lg">Join communities and collaborate on amazing loop projects</p>
          </div>

          <CreateCircleButton />
          <CirclesList />
        </div>
      </main>
    </div>
  )
}
