"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Filter,
  X,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  Zap,
  Clock,
} from "@/components/icons/lucide-compat"
import { cn } from "@/lib/utils"

interface Transaction {
  id: string
  amount_usd?: number
  coins_amount: number
  type: string
  description: string
  status: string
  created_at: string
}

interface TransactionFilterProps {
  transactions: Transaction[]
  onFiltered: (filtered: Transaction[]) => void
}

type FilterType = "all" | "received" | "sent" | "earned" | "spent" | "purchase"
type DateRange = "all" | "today" | "week" | "month" | "quarter"

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "received", label: "Received" },
  { value: "sent", label: "Sent" },
  { value: "earned", label: "Earned" },
  { value: "spent", label: "Spent" },
  { value: "purchase", label: "Purchases" },
]

const DATE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
]

const TYPE_KEYWORDS: Record<FilterType, string[]> = {
  all: [],
  received: ["gift", "received", "tip", "donation"],
  sent: ["sent", "gift sent"],
  earned: ["earned", "bonus", "reward", "streak", "creator fund", "live"],
  spent: ["spent", "boost", "shop", "cosmetic", "theme"],
  purchase: ["purchase", "bought", "top up", "deposit"],
}

function matchesType(tx: Transaction, type: FilterType): boolean {
  if (type === "all") return true
  const desc = (tx.description || "").toLowerCase() + " " + (tx.type || "").toLowerCase()
  return TYPE_KEYWORDS[type].some((kw) => desc.includes(kw))
}

function matchesDateRange(tx: Transaction, range: DateRange): boolean {
  if (range === "all") return true
  const date = new Date(tx.created_at)
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (range) {
    case "today":
      return date >= startOfDay
    case "week": {
      const weekAgo = new Date(startOfDay)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return date >= weekAgo
    }
    case "month": {
      const monthAgo = new Date(startOfDay)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return date >= monthAgo
    }
    case "quarter": {
      const quarterAgo = new Date(startOfDay)
      quarterAgo.setMonth(quarterAgo.getMonth() - 3)
      return date >= quarterAgo
    }
    default:
      return true
  }
}

export function TransactionFilter({ transactions, onFiltered }: TransactionFilterProps) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<FilterType>("all")
  const [dateRange, setDateRange] = useState<DateRange>("all")
  const [showFilters, setShowFilters] = useState(false)

  const hasActiveFilters = typeFilter !== "all" || dateRange !== "all" || search.length > 0

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Search
      if (search) {
        const q = search.toLowerCase()
        if (
          !tx.description?.toLowerCase().includes(q) &&
          !tx.type?.toLowerCase().includes(q) &&
          !String(tx.coins_amount).includes(q)
        ) {
          return false
        }
      }

      // Type
      if (!matchesType(tx, typeFilter)) return false

      // Date
      if (!matchesDateRange(tx, dateRange)) return false

      return true
    })
  }, [transactions, search, typeFilter, dateRange])

  // Notify parent when filters change
  useMemo(() => {
    onFiltered(filteredTransactions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTransactions])

  const clearFilters = () => {
    setSearch("")
    setTypeFilter("all")
    setDateRange("all")
  }

  return (
    <div className="space-y-2">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "shrink-0",
            showFilters && "bg-primary/10 text-primary border-primary/30"
          )}
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Filter Row */}
      {showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as FilterType)}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              {DATE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 text-xs gap-1 text-muted-foreground"
            >
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Active Filter Badges */}
      {hasActiveFilters && !showFilters && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {typeFilter !== "all" && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              {TYPE_OPTIONS.find((o) => o.value === typeFilter)?.label}
              <button onClick={() => setTypeFilter("all")}>
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          )}
          {dateRange !== "all" && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              {DATE_OPTIONS.find((o) => o.value === dateRange)?.label}
              <button onClick={() => setDateRange("all")}>
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          )}
          {search && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              &quot;{search}&quot;
              <button onClick={() => setSearch("")}>
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
