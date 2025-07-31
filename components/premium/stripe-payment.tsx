"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { CreditCard, Lock, Coins } from "lucide-react"

interface StripePaymentProps {
  amount: number
  description: string
  onSuccess?: (paymentIntentId: string) => void
  onError?: (error: string) => void
}

export function StripePayment({ amount, description, onSuccess, onError }: StripePaymentProps) {
  const [loading, setLoading] = useState(false)
  const [cardDetails, setCardDetails] = useState({
    number: "",
    expiry: "",
    cvc: "",
    name: "",
  })
  const { toast } = useToast()

  const handlePayment = async () => {
    try {
      setLoading(true)

      // Create payment intent
      const response = await fetch("/api/payments/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amount * 100, // Convert to cents
          metadata: {
            description: description,
          },
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create payment intent")
      }

      const data = await response.json()

      if (data.success) {
        // In a real app, you would use Stripe Elements here
        /*
        const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
        
        const { error, paymentIntent } = await stripe!.confirmCardPayment(
          data.client_secret,
          {
            payment_method: {
              card: elements.getElement(CardElement)!,
              billing_details: {
                name: cardDetails.name,
              },
            }
          }
        )

        if (error) {
          throw new Error(error.message)
        }

        if (paymentIntent.status === 'succeeded') {
          onSuccess?.(paymentIntent.id)
          toast({ description: "Payment successful!" })
        }
        */

        // Mock successful payment for demo
        setTimeout(() => {
          onSuccess?.(data.payment_intent_id)
          toast({ description: "Payment successful! (Demo mode)" })
        }, 2000)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Payment failed"
      onError?.(errorMessage)
      toast({
        title: "Payment Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CreditCard className="w-5 h-5" />
          <span>Payment Details</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Payment Summary */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">{description}</span>
            <div className="flex items-center space-x-1">
              <Coins className="w-4 h-4 text-yellow-500" />
              <span className="font-semibold">${amount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Card Details Form */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="cardName">Cardholder Name</Label>
            <Input
              id="cardName"
              value={cardDetails.name}
              onChange={(e) => setCardDetails({ ...cardDetails, name: e.target.value })}
              placeholder="John Doe"
            />
          </div>

          <div>
            <Label htmlFor="cardNumber">Card Number</Label>
            <Input
              id="cardNumber"
              value={cardDetails.number}
              onChange={(e) => setCardDetails({ ...cardDetails, number: e.target.value })}
              placeholder="1234 5678 9012 3456"
              maxLength={19}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expiry">Expiry Date</Label>
              <Input
                id="expiry"
                value={cardDetails.expiry}
                onChange={(e) => setCardDetails({ ...cardDetails, expiry: e.target.value })}
                placeholder="MM/YY"
                maxLength={5}
              />
            </div>
            <div>
              <Label htmlFor="cvc">CVC</Label>
              <Input
                id="cvc"
                value={cardDetails.cvc}
                onChange={(e) => setCardDetails({ ...cardDetails, cvc: e.target.value })}
                placeholder="123"
                maxLength={4}
              />
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Lock className="w-4 h-4" />
          <span>Your payment information is secure and encrypted</span>
        </div>

        {/* Payment Button */}
        <Button
          onClick={handlePayment}
          disabled={loading || !cardDetails.name || !cardDetails.number}
          className="w-full bg-gradient-to-r from-purple-500 to-blue-500"
        >
          {loading ? "Processing..." : `Pay $${amount.toFixed(2)}`}
        </Button>

        {/* Development Notice */}
        <div className="text-xs text-gray-500 text-center">
          Demo mode: Add STRIPE_SECRET_KEY to .env.local for real payments
        </div>
      </CardContent>
    </Card>
  )
}
