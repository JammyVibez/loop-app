"use client"

import type React from "react"
import { useAuthHook, AuthContext } from "../hooks/use-auth"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthHook()

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

// Re-export useAuth from hooks for convenience
export { useAuth } from "../hooks/use-auth"
