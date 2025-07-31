"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle, XCircle, Mail, RefreshCw, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function EmailVerificationPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const email = searchParams.get("email")

  const [verificationStatus, setVerificationStatus] = useState<"pending" | "success" | "error" | "expired">("pending")
  const [resendEmail, setResendEmail] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)

  useEffect(() => {
    if (token) {
      // Simulate email verification API call
      const verifyEmail = async () => {
        try {
          // Mock API call
          await new Promise((resolve) => setTimeout(resolve, 2000))

          // Simulate different outcomes based on token
          if (token === "expired") {
            setVerificationStatus("expired")
          } else if (token === "invalid") {
            setVerificationStatus("error")
          } else {
            setVerificationStatus("success")
          }
        } catch (error) {
          setVerificationStatus("error")
        }
      }

      verifyEmail()
    }
  }, [token])

  const handleResendVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    setResendLoading(true)

    try {
      // Mock API call to resend verification email
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setResendSuccess(true)
    } catch (error) {
      console.error("Failed to resend verification email")
    } finally {
      setResendLoading(false)
    }
  }

  const renderVerificationContent = () => {
    switch (verificationStatus) {
      case "pending":
        return (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">Verifying your email...</h2>
            <p className="text-muted-foreground">Please wait while we verify your email address.</p>
          </div>
        )

      case "success":
        return (
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2 text-green-700">Email Verified Successfully!</h2>
            <p className="text-muted-foreground mb-6">
              Your email address has been verified. You can now access all Loop features.
            </p>
            <div className="space-y-3">
              <Link href="/login">
                <Button className="w-full">Continue to Login</Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="w-full">
                  Go to Homepage
                </Button>
              </Link>
            </div>
          </div>
        )

      case "expired":
        return (
          <div className="text-center">
            <XCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2 text-orange-700">Verification Link Expired</h2>
            <p className="text-muted-foreground mb-6">
              This verification link has expired. Please request a new verification email.
            </p>
            <form onSubmit={handleResendVerification} className="space-y-4">
              <Input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="Enter your email address"
                required
              />
              <Button type="submit" className="w-full" disabled={resendLoading}>
                {resendLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send New Verification Email"
                )}
              </Button>
            </form>
          </div>
        )

      case "error":
        return (
          <div className="text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2 text-red-700">Verification Failed</h2>
            <p className="text-muted-foreground mb-6">
              We couldn't verify your email address. The link may be invalid or expired.
            </p>
            <div className="space-y-3">
              <form onSubmit={handleResendVerification} className="space-y-4">
                <Input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                />
                <Button type="submit" className="w-full" disabled={resendLoading}>
                  {resendLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send New Verification Email"
                  )}
                </Button>
              </form>
              <Link href="/help">
                <Button variant="outline" className="w-full">
                  Contact Support
                </Button>
              </Link>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Loop
                </Button>
              </Link>
            </div>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              <Mail className="h-6 w-6" />
              Email Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderVerificationContent()}

            {resendSuccess && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700 text-center">
                  ✅ Verification email sent! Please check your inbox.
                </p>
              </div>
            )}

            {email && (
              <div className="mt-6 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground text-center">
                  Verification email sent to: <strong>{email}</strong>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Additional Help */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">Didn't receive the email?</p>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">• Check your spam/junk folder</p>
            <p className="text-xs text-muted-foreground">• Make sure the email address is correct</p>
            <p className="text-xs text-muted-foreground">• Wait a few minutes and try again</p>
          </div>
          <Link href="/help" className="text-sm text-primary hover:underline mt-4 inline-block">
            Still need help? Contact support
          </Link>
        </div>
      </div>
    </div>
  )
}
