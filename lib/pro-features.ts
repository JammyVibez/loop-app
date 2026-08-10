/** Loop Pro — launch pricing + feature catalog */

export const PRO_PRICING = {
  monthly: {
    id: "monthly" as const,
    name: "Monthly",
    priceUsd: 3.99,
    priceLabel: "$3.99",
    period: "/month",
    coins: 5000,
    days: 30,
    description: "Launch price — 5,000 Bonus Coins / mo!",
  },
  annual: {
    id: "annual" as const,
    name: "Annual",
    priceUsd: 29.99,
    priceLabel: "$29.99",
    period: "/year",
    coins: 60000,
    days: 365,
    description: "Best value — 60,000 Bonus Coins / yr!",
    popular: true,
    savings: "Save ~37%",
  },
} as const

export type ProPlanId = keyof typeof PRO_PRICING

export const PRO_FEATURES = [
  {
    id: "multi_upload",
    title: "Multi-Video & Image Carousel",
    description: "Post up to 10 HD images and video clips in a single loop",
    free: "1 file",
    pro: "Up to 10 videos/images",
    icon: "upload",
  },
  {
    id: "pro_coins",
    title: "Massive Bonus Coin Drops",
    description: "Earn 5,000 to 60,000 Loop Coins instantly with subscription",
    free: "40 daily coins",
    pro: "5,000 - 60,000 Coins",
    icon: "coins",
  },
  {
    id: "xp_boost",
    title: "3× XP & Coin Multiplier",
    description: "Level up 3x faster on posts, likes, gifts, and Co-Loops",
    free: "1× Standard XP",
    pro: "3× Multiplier",
    icon: "zap",
  },
  {
    id: "daily_bonus",
    title: "Bigger Daily Coin Claim",
    description: "Claim 500 extra Loop Coins every day you log in",
    free: "+40 coins",
    pro: "+500 coins daily",
    icon: "coins",
  },
  {
    id: "gif_avatar",
    title: "Animated GIF Avatar & Banner",
    description: "Stand out with dynamic animated profile pictures & covers",
    free: "Static images",
    pro: "Animated GIFs",
    icon: "sparkles",
  },
  {
    id: "co_loop_pro",
    title: "Co-Loop Unlimited Snapshots",
    description: "Store unlimited version history snapshots in Co-Loop Studio",
    free: "3 snapshots",
    pro: "Unlimited history",
    icon: "crown",
  },
  {
    id: "pro_badge",
    title: "Gold Pro Crown Badge",
    description: "Exclusive gold crown badge beside your username everywhere",
    free: "Standard badge",
    pro: "Gold Pro Crown",
    icon: "crown",
  },
  {
    id: "stream",
    title: "Instant 4K Live Streaming",
    description: "Host 4K livestreams without waiting for moderator approval",
    free: "Approval required",
    pro: "Instant 4K Live",
    icon: "video",
  },
  {
    id: "secret_community",
    title: "Secret Pro Lounge & VIP Circles",
    description: "Exclusive access to the secret #LoopPro Circle with founder Q&As and priority feature voting",
    free: "Public circles only",
    pro: "Secret Pro Circle Access",
    icon: "lock",
  },
  {
    id: "express_cashout",
    title: "0% Cashout Fee & 24h Express Payouts",
    description: "Withdraw Loop Coin earnings to your bank with zero platform commission and 24-hour express processing",
    free: "10% fee & standard queue",
    pro: "0% Fee & 24h Express Cashout",
    icon: "dollar",
  },
  {
    id: "neon_customizer",
    title: "Neon Glow & Custom Audio Profile",
    description: "Light up your profile with glowing neon borders, custom theme presets, and ambient audio intros",
    free: "Default theme",
    pro: "Neon Glow & Audio Customizer",
    icon: "sparkles",
  },
  {
    id: "secret_shop",
    title: "Secret Pro Shop & Free Monthly Drops",
    description: "Access rare stickers, exclusive animated avatar frames, and 1 free legendary cosmetic drop every month",
    free: "Standard shop items",
    pro: "Secret Shop + Free Drops",
    icon: "gift",
  },
  {
    id: "algo_boost",
    title: "50% Algorithmic Reach Boost",
    description: "All your public Loops & Reels get featured automatically with +50% extra reach in discovery feeds",
    free: "Standard reach",
    pro: "+50% Feed Reach Boost",
    icon: "trending",
  },
  {
    id: "vip_duels",
    title: "VIP Duels & Double Stake Staking",
    description: "Host high-stakes VIP Duels with featured leaderboard placement and zero host fees",
    free: "Standard Duels",
    pro: "VIP Duels & Leaderboard Spotlight",
    icon: "swords",
  },
  {
    id: "communities",
    title: "More Communities",
    description: "Create and run more Circles for your audiences",
    free: "Up to 2 communities",
    pro: "Up to 15 communities",
    icon: "users",
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
