"use client"

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Check,
  Swords,
  Coins,
  Trophy,
  Play,
  Smartphone,
  ArrowUpRight,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { AppLogo } from "@/components/brand/app-logo"
import { useTheme3D } from "@/providers/theme-3d-provider"
import { useTheme } from "next-themes"

/* PLACEHOLDER_START - will be replaced via shell if needed */
