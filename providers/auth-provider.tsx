"use client"

import { AuthProvider as AuthProviderFromHook, useAuth as useAuthFromHook } from "@/hooks/use-auth"

export const AuthProvider = AuthProviderFromHook
export const useAuth = useAuthFromHook
