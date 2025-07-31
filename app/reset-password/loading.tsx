import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function ResetPasswordLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-48 mx-auto"></div>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-muted rounded-full mx-auto mb-4"></div>
            <div className="h-6 bg-muted rounded w-64 mx-auto mb-2"></div>
            <div className="h-4 bg-muted rounded w-48 mx-auto"></div>
          </div>
          <div className="space-y-4">
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
