"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Crown, Sparkles, Video, Palette, Zap } from "lucide-react"
import { PaymentModal } from "./payment-modal"
import { useAuth } from "@/hooks/use-auth"

const premiumFeatures = [
  {
    icon: Video,
    title: "Extended Video Uploads",
    description: "Upload videos up to 3 hours long",
    current: "5 minutes",
    premium: "3 hours",
  },
  {
    icon: Palette,
    title: "Animated Profile Themes",
    description: "Customize your profile with animated backgrounds",
    current: "Static themes",
    premium: "Animated themes",
  },
  {
    icon: Sparkles,
    title: "Premium Badges & Effects",
    description: "Exclusive badges and post effects",
    current: "Basic badges",
    premium: "Premium effects",
  },
  {
    icon: Zap,
    title: "Priority Support",
    description: "Get faster response times for support",
    current: "Standard support",
    premium: "Priority support",
  },
]

const plans = [
  {
    name: "Monthly",
    price: "$9.99",
    period: "/month",
    description: "Perfect for trying premium features",
    popular: false,
  },
  {
    name: "Annual",
    price: "$99.99",
    period: "/year",
    description: "Save 17% with annual billing",
    popular: true,
    savings: "Save $20",
  },
]

export function PremiumUpgrade() {
  const [selectedPlan, setSelectedPlan] = useState("annual")
  const [showPayment, setShowPayment] = useState(false)
  const { user } = useAuth()

  if (user?.is_premium) {
    return (
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <div className="p-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg text-white">
          <Crown className="w-12 h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">You're Already Premium!</h1>
          <p>Enjoy all the exclusive features and benefits.</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Your Premium Features</h3>
            <div className="grid gap-3">
              {premiumFeatures.map((feature, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-green-500" />
                  <span>{feature.title}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full">
            <Crown className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          Upgrade to Premium
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          Unlock exclusive features and take your Loop experience to the next level
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`relative cursor-pointer transition-all ${
              selectedPlan === plan.name.toLowerCase() ? "ring-2 ring-purple-500 shadow-lg" : "hover:shadow-md"
            } ${plan.popular ? "border-purple-500" : ""}`}
            onClick={() => setSelectedPlan(plan.name.toLowerCase())}
          >
            {plan.popular && (
              <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-blue-500">
                Most Popular
              </Badge>
            )}
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <div className="space-y-2">
                <div className="text-3xl font-bold">
                  {plan.price}
                  <span className="text-lg font-normal text-gray-500">{plan.period}</span>
                </div>
                {plan.savings && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    {plan.savings}
                  </Badge>
                )}
                <p className="text-gray-600 dark:text-gray-400">{plan.description}</p>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5" />
            <span>Premium Features</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {premiumFeatures.map((feature, index) => (
              <div key={index} className="flex space-x-4">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <feature.icon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{feature.description}</p>
                  <div className="flex items-center space-x-4 text-xs">
                    <span className="text-gray-500">Free: {feature.current}</span>
                    <span className="text-purple-600 font-semibold">Premium: {feature.premium}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button
          onClick={() => setShowPayment(true)}
          size="lg"
          className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-8 py-3"
        >
          Request Premium Upgrade
        </Button>
        <p className="text-sm text-gray-500 mt-2">Admin approval required • 30-day money-back guarantee</p>
      </div>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        plan={selectedPlan}
        price={selectedPlan === "annual" ? "$99.99" : "$9.99"}
      />
    </div>
  )
}
