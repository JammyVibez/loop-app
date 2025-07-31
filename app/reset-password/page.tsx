"use client"

import type React from "react"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle, XCircle, Lock, ArrowLeft, Eye, EyeOff } from "lucide-react"
import Link from "next/link"

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [step, setStep] = useState<"request" | "reset" | "success" | "error">(!token ? "request" : "reset")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const validatePassword = (password: string) => {
    const errors: string[] = []
    if (password.length < 8) errors.push("At least 8 characters")
    if (!/[A-Z]/.test(password)) errors.push("One uppercase letter")
    if (!/[a-z]/.test(password)) errors.push("One lowercase letter")
    if (!/\d/.test(password)) errors.push("One number")
    if (!/[!@#$%^&*]/.test(password)) errors.push("One special character")
    return errors
  }

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    try {
      // Mock API call to request password reset
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Simulate success
      setStep("success")
    } catch (error) {
      setErrors({ email: "Failed to send reset email. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    // Validate passwords
    const passwordErrors = validatePassword(password)
    if (passwordErrors.length > 0) {
      setErrors({ password: passwordErrors.join(", ") })
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" })
      setLoading(false)
      return
    }

    try {
      // Mock API call to reset password
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Simulate different outcomes based on token
      if (token === "expired") {
        setStep("error")
        setErrors({ general: "Reset link has expired. Please request a new one." })
      } else if (token === "invalid") {
        setStep("error")
        setErrors({ general: "Invalid reset link. Please request a new one." })
      } else {
        setStep("success")
      }
    } catch (error) {
      setErrors({ general: "Failed to reset password. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  const renderContent = () => {
    switch (step) {
      case "request":
        return (
          <div>
            <div className="text-center mb-6">
              <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Reset Your Password</h2>
              <p className="text-muted-foreground">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  className={errors.email ? "border-red-500" : ""}
                />
                {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm text-primary hover:underline">
                Remember your password? Sign in
              </Link>
            </div>
          </div>
        )

      case "reset":
        return (
          <div>
            <div className="text-center mb-6">
              <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Create New Password</h2>
              <p className="text-muted-foreground">Enter your new password below.</p>
            </div>

            {errors.general && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{errors.general}</p>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    className={errors.password ? "border-red-500" : ""}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password}</p>}

                {/* Password Requirements */}
                <div className="mt-2 text-xs text-muted-foreground">
                  <p>Password must contain:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li className={password.length >= 8 ? "text-green-600" : ""}>At least 8 characters</li>
                    <li className={/[A-Z]/.test(password) ? "text-green-600" : ""}>One uppercase letter</li>
                    <li className={/[a-z]/.test(password) ? "text-green-600" : ""}>One lowercase letter</li>
                    <li className={/\d/.test(password) ? "text-green-600" : ""}>One number</li>
                    <li className={/[!@#$%^&*]/.test(password) ? "text-green-600" : ""}>
                      One special character (!@#$%^&*)
                    </li>
                  </ul>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    className={errors.confirmPassword ? "border-red-500" : ""}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.confirmPassword && <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Resetting Password..." : "Reset Password"}
              </Button>
            </form>
          </div>
        )

      case "success":
        return (
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2 text-green-700">
              {step === "success" && !token ? "Reset Link Sent!" : "Password Reset Successfully!"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {step === "success" && !token
                ? `We've sent a password reset link to ${email}. Please check your email and follow the instructions.`
                : "Your password has been reset successfully. You can now sign in with your new password."}
            </p>
            <div className="space-y-3">
              <Link href="/login">
                <Button className="w-full">Continue to Sign In</Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="w-full">
                  Go to Homepage
                </Button>
              </Link>
            </div>
          </div>
        )

      case "error":
        return (
          <div className="text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2 text-red-700">Reset Link Invalid</h2>
            <p className="text-muted-foreground mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <div className="space-y-3">
              <Button onClick={() => setStep("request")} className="w-full">
                Request New Reset Link
              </Button>
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
            <CardTitle className="text-center">Password Reset</CardTitle>
          </CardHeader>
          <CardContent>{renderContent()}</CardContent>
        </Card>

        {/* Additional Help */}
        {(step === "request" || step === "success") && (
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Need help?</p>
            <Link href="/help" className="text-sm text-primary hover:underline">
              Contact our support team
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
