"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { CreditCard, Lock, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  plan: string
  price: string
}

export function PaymentModal({ isOpen, onClose, plan, price }: PaymentModalProps) {
  const [paymentData, setPaymentData] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    name: "",
    email: "",
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const { toast } = useToast()
  const { user, updateUser } = useAuth()

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)

    // Simulate Stripe payment processing
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // Mock successful payment
    setPaymentSuccess(true)

    // Update user to premium status
    if (updateUser) {
      updateUser({
        ...user!,
        is_premium: true,
        premium_expires_at: new Date(Date.now() + (plan === "annual" ? 365 : 30) * 24 * 60 * 60 * 1000),
      })
    }

    toast({
      title: "Payment Successful!",
      description: "Welcome to Loop Premium! Your account has been upgraded.",
    })

    setTimeout(() => {
      setIsProcessing(false)
      setPaymentSuccess(false)
      onClose()
    }, 2000)
  }

  if (paymentSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="text-center space-y-4 py-6">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Payment Successful!</h2>
            <p className="text-gray-600">Welcome to Loop Premium! Your account has been upgraded.</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5" />
            <span>Complete Your Purchase</span>
          </DialogTitle>
        </DialogHeader>

        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold capitalize">{plan} Plan</h3>
                <p className="text-sm text-gray-500">Loop Premium</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{price}</div>
                <div className="text-sm text-gray-500">{plan === "annual" ? "/year" : "/month"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handlePayment} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={paymentData.email}
              onChange={(e) => setPaymentData((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Cardholder Name</Label>
            <Input
              id="name"
              value={paymentData.name}
              onChange={(e) => setPaymentData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="John Doe"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardNumber">Card Number</Label>
            <Input
              id="cardNumber"
              value={paymentData.cardNumber}
              onChange={(e) => setPaymentData((prev) => ({ ...prev, cardNumber: e.target.value }))}
              placeholder="1234 5678 9012 3456"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input
                id="expiryDate"
                value={paymentData.expiryDate}
                onChange={(e) => setPaymentData((prev) => ({ ...prev, expiryDate: e.target.value }))}
                placeholder="MM/YY"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cvv">CVV</Label>
              <Input
                id="cvv"
                value={paymentData.cvv}
                onChange={(e) => setPaymentData((prev) => ({ ...prev, cvv: e.target.value }))}
                placeholder="123"
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Lock className="w-4 h-4" />
            <span>Your payment information is secure and encrypted</span>
          </div>

          <Button type="submit" disabled={isProcessing} className="w-full bg-gradient-to-r from-purple-500 to-blue-500">
            {isProcessing ? "Processing..." : `Pay ${price}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
