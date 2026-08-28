"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

interface ActivityHeatmapProps {
  userId: string
}

interface DayActivity {
  date: string
  count: number
  level: number // 0-4
}

export function ActivityHeatmap({ userId }: ActivityHeatmapProps) {
  const { getAuthHeader } = useAuth()
  const [data, setData] = useState<DayActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredDay, setHoveredDay] = useState<DayActivity | null>(null)

  useEffect(() => {
    fetchActivity()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const fetchActivity = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${userId}/activity-heatmap`, {
        headers: getAuthHeader(),
      })
      if (res.ok) {
        const result = await res.json()
        setData(result.days || [])
      }
    } catch {
      // Generate empty heatmap on error
      const days: DayActivity[] = []
      const now = new Date()
      for (let i = 364; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        days.push({
          date: date.toISOString().split("T")[0],
          count: 0,
          level: 0,
        })
      }
      setData(days)
    } finally {
      setLoading(false)
    }
  }

  // Group by weeks for the grid
  const weeks = useMemo(() => {
    if (!data.length) return []

    const result: DayActivity[][] = []
    let currentWeek: DayActivity[] = []

    // Pad start to align with weekday grid
    const firstDay = new Date(data[0].date)
    const startPad = firstDay.getDay() // 0=Sun, 6=Sat
    for (let i = 0; i < startPad; i++) {
      currentWeek.push({ date: "", count: 0, level: -1 })
    }

    for (const day of data) {
      currentWeek.push(day)
      if (currentWeek.length === 7) {
        result.push(currentWeek)
        currentWeek = []
      }
    }

    // Pad end
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: "", count: 0, level: -1 })
      }
      result.push(currentWeek)
    }

    return result
  }, [data])

  // Month labels
  const monthLabels = useMemo(() => {
    if (!data.length) return []
    const labels: Array<{ label: string; weekIndex: number }> = []
    let lastMonth = -1

    weeks.forEach((week, i) => {
      const firstValid = week.find((d) => d.date)
      if (firstValid) {
        const month = new Date(firstValid.date).getMonth()
        if (month !== lastMonth) {
          labels.push({
            label: new Date(firstValid.date).toLocaleDateString("en-US", { month: "short" }),
            weekIndex: i,
          })
          lastMonth = month
        }
      }
    })

    return labels
  }, [weeks, data])

  const totalPosts = data.reduce((sum, d) => sum + d.count, 0)
  const maxDay = data.reduce((max, d) => (d.count > max.count ? d : max), { count: 0, date: "" })
  const activeDays = data.filter((d) => d.count > 0).length

  const levels = [
    "bg-muted/30",
    "bg-emerald-500/20",
    "bg-emerald-500/40",
    "bg-emerald-500/60",
    "bg-emerald-500/90",
  ]

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="h-4 w-32 bg-muted/50 rounded animate-pulse mb-3" />
          <div className="h-24 bg-muted/30 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Activity</h3>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>{totalPosts.toLocaleString()} posts</span>
            <span>{activeDays} active days</span>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto pb-1 -mx-1 px-1">
          {/* Month labels */}
          <div className="flex gap-0.5 mb-1 ml-5">
            {weeks.map((_, weekIdx) => {
              const label = monthLabels.find((m) => m.weekIndex === weekIdx)
              return (
                <div key={weekIdx} className="w-[11px] text-[8px] text-muted-foreground">
                  {label?.label || ""}
                </div>
              )
            })}
          </div>

          <div className="flex gap-0">
            {/* Day labels */}
            <div className="flex flex-col gap-0.5 mr-1">
              {["", "Mon", "", "Wed", "", "Fri", ""].map((day, i) => (
                <div key={i} className="h-[11px] flex items-center text-[8px] text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex gap-0.5">
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col gap-0.5">
                  {week.map((day, dayIdx) => (
                    <div
                      key={dayIdx}
                      className={cn(
                        "h-[11px] w-[11px] rounded-[2px] transition-colors",
                        day.level === -1 ? "bg-transparent" : levels[day.level] || levels[0],
                        day.date && "cursor-pointer hover:ring-1 hover:ring-foreground/30"
                      )}
                      onMouseEnter={() => day.date && setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {hoveredDay && hoveredDay.date && (
          <div className="mt-2 text-xs text-muted-foreground">
            <span className="font-semibold">{hoveredDay.count}</span> post{hoveredDay.count !== 1 ? "s" : ""} on{" "}
            {new Date(hoveredDay.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-2 justify-end">
          <span className="text-[9px] text-muted-foreground">Less</span>
          {levels.map((level, i) => (
            <div
              key={i}
              className={cn("h-[10px] w-[10px] rounded-[2px]", level)}
            />
          ))}
          <span className="text-[9px] text-muted-foreground">More</span>
        </div>

        {/* Streak */}
        {totalPosts > 0 && (
          <div className="mt-2 text-center">
            <p className="text-[10px] text-muted-foreground">
              {maxDay.date && (
                <>
                  Most active day:{" "}
                  <span className="font-semibold text-foreground">
                    {new Date(maxDay.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>{" "}
                  ({maxDay.count} posts)
                </>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
