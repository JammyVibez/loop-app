/** Loop Pro — launch pricing + feature catalog */

export const PRO_PRICING = {
  monthly: {
    id: "monthly" as const,
    name: "Monthly",
    priceUsd: 3.99,
    priceLabel: "$3.99",
    period: "/month",
    coins: 400,
    days: 30,
    description: "Launch price — cancel anytime",
  },
  annual: {
    id: "annual" as const,
    name: "Annual",
    priceUsd: 29.99,
    priceLabel: "$29.99",
    period: "/year",
    coins: 2500,
    days: 365,
    description: "Best value while we're new",
    popular: true,
    savings: "Save ~37%",
  },
} as const

export type ProPlanId = keyof typeof PRO_PRICING

export const PRO_FEATURES = [
  {
    id: "multi_upload",
    title: "Multi-file posts",
    description: "Attach up to 4 images or clips in one loop",
    free: "1 file",
    pro: "4 files",
    icon: "upload",
  },
  {
    id: "xp_boost",
    title: "2× XP boost",
    description: "Level up twice as fast on likes, posts, and gifts",
    free: "Standard XP",
    pro: "Double XP",
    icon: "zap",
  },
  {
    id: "daily_bonus",
    title: "Bigger daily claim",
    description: "Extra Loop Coins every day you check in",
    free: "+40 coins",
    pro: "+60 coins",
    icon: "coins",
  },
  {
    id: "gif_avatar",
    title: "GIF avatar & cover",
    description: "Animated profile photo and banner that stand out",
    free: "Static images",
    pro: "Animated GIFs",
    icon: "sparkles",
  },
  {
    id: "pro_shop",
    title: "Pro-only shop drops",
    description: "Exclusive themes, badges, and effects",
    free: "Standard catalog",
    pro: "Pro vault unlocked",
    icon: "crown",
  },
  {
    id: "code_pro",
    title: "Code Loop spotlight",
    description: "Highlighted code posts + fork analytics on your profile",
    free: "Basic code posts",
    pro: "Spotlight + stats",
    icon: "code",
  },
  {
    id: "stream",
    title: "Go live anytime",
    description: "Create livestreams without waiting for approval",
    free: "Invite-only",
    pro: "Instant live",
    icon: "video",
  },
  {
    id: "priority",
    title: "Priority discovery",
    description: "Stronger boost in For You and suggestions",
    free: "Standard rank",
    pro: "Priority boost",
    icon: "trending",
  },
] as const

export const CODE_LANGUAGES = [
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "tsx", label: "React / TSX" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "sql", label: "SQL" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "java", label: "Java" },
  { id: "kotlin", label: "Kotlin" },
  { id: "swift", label: "Swift" },
  { id: "php", label: "PHP" },
  { id: "ruby", label: "Ruby" },
  { id: "shell", label: "Shell" },
  { id: "json", label: "JSON" },
  { id: "markdown", label: "Markdown" },
  { id: "other", label: "Other" },
] as const

export function isCodeLoop(loop: {
  content_type?: string
  media_type?: string
  category?: string
  content_metadata?: any
}) {
  const meta = loop.content_metadata || {}
  return (
    loop.content_type === "code" ||
    loop.media_type === "code" ||
    loop.category === "code" ||
    Boolean(meta.is_code)
  )
}
