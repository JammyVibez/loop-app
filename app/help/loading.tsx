import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function HelpLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="text-center mb-8">
          <div className="h-8 bg-muted rounded w-64 mx-auto mb-4 animate-pulse"></div>
          <div className="h-4 bg-muted rounded w-96 mx-auto animate-pulse"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 text-center">
                <div className="w-8 h-8 bg-muted rounded mx-auto mb-3"></div>
                <div className="h-4 bg-muted rounded w-24 mx-auto mb-2"></div>
                <div className="h-3 bg-muted rounded w-32 mx-auto"></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-48"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
