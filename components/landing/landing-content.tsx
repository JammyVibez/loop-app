"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, ArrowUpRight, Check, Coins, Play, Smartphone, Swords, Trophy } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AppLogo } from "@/components/brand/app-logo"
import { cn } from "@/lib/utils"

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} className={cn("transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]", visible ? "translate-y-0 opacity-100 blur-0" : "translate-y-12 opacity-0 blur-[2px]", className)} style={{ transitionDelay: `${delay}ms` }}>{children}</div>
}

function Magnetic({ children, strength = 0.35 }: { children: React.ReactNode; strength?: number }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setOffset({ x: (event.clientX - (rect.left + rect.width / 2)) * strength, y: (event.clientY - (rect.top + rect.height / 2)) * strength })
  }
  return <div className="inline-block will-change-transform" onMouseMove={onMove} onMouseLeave={() => setOffset({ x: 0, y: 0 })} style={{ transform: `translate(${offset.x}px, ${offset.y}px)`, transition: "transform .25s cubic-bezier(.22,1,.36,1)" }}>{children}</div>
}

function LivingBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouse = useRef({ x: -9999, y: -9999 })
  const frame = useRef(0)
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return
    let width = 0
    let height = 0
    let particles: Array<{ x: number; y: number; vx: number; vy: number; radius: number; alpha: number }> = []
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * pixelRatio
      canvas.height = height * pixelRatio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      particles = Array.from({ length: Math.min(48, Math.floor((width * height) / 28000)) }, () => ({ x: Math.random() * width, y: Math.random() * height, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, radius: 0.6 + Math.random() * 1.4, alpha: 0.08 + Math.random() * 0.18 }))
    }
    const move = (event: MouseEvent) => { mouse.current = { x: event.clientX, y: event.clientY } }
    const leave = () => { mouse.current = { x: -9999, y: -9999 } }
    const tick = () => {
      context.clearRect(0, 0, width, height)
      const { x: mouseX, y: mouseY } = mouse.current
      if (mouseX > -100) {
        const glow = context.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 380)
        glow.addColorStop(0, "rgba(91,141,239,.11)")
        glow.addColorStop(.45, "rgba(91,141,239,.03)")
        glow.addColorStop(1, "transparent")
        context.fillStyle = glow
        context.fillRect(0, 0, width, height)
      }
      particles.forEach((particle) => {
        if (mouseX > -100) {
          const dx = mouseX - particle.x
          const dy = mouseY - particle.y
          const distance = Math.sqrt(dx * dx + dy * dy) || 1
          if (distance < 280) { particle.vx += (dx / distance) * .008; particle.vy += (dy / distance) * .008 }
        }
        particle.vx *= .99
        particle.vy *= .99
        particle.x += particle.vx
        particle.y += particle.vy
        if (particle.x < -10) particle.x = width + 10
        if (particle.x > width + 10) particle.x = -10
        if (particle.y < -10) particle.y = height + 10
        if (particle.y > height + 10) particle.y = -10
        context.beginPath()
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        context.fillStyle = `rgba(200,210,255,${particle.alpha})`
        context.fill()
      })
      if (mouseX > -100) particles.forEach((a, i) => particles.slice(i + 1).forEach((b) => { const distance = Math.hypot(a.x - b.x, a.y - b.y); if (distance < 90 && Math.hypot((a.x + b.x) / 2 - mouseX, (a.y + b.y) / 2 - mouseY) < 200) { context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.strokeStyle = `rgba(140,170,255,${.06 * (1 - distance / 90)})`; context.stroke() } }))
      frame.current = requestAnimationFrame(tick)
    }
    resize()
    window.addEventListener("resize", resize)
    window.addEventListener("mousemove", move)
    window.addEventListener("mouseleave", leave)
    frame.current = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame.current); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", move); window.removeEventListener("mouseleave", leave) }
  }, [])
  return <div className="pointer-events-none fixed inset-0 z-0" aria-hidden><div className="absolute inset-0 bg-[#060607]" /><div className="absolute -left-24 top-0 h-[55vh] w-[50vw] opacity-40 blur-[110px]" style={{ background: "radial-gradient(circle, rgba(91,141,239,.4), transparent 70%)" }} /><div className="absolute -right-16 top-[30%] h-[45vh] w-[40vw] opacity-25 blur-[130px]" style={{ background: "radial-gradient(circle, rgba(139,120,255,.35), transparent 70%)" }} /><canvas ref={canvasRef} className="absolute inset-0" /></div>
}

function InteractiveMock() {
  const [tab, setTab] = useState<"coloop" | "duel" | "circle">("coloop")
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const tabs = useMemo(() => [{ id: "coloop" as const, label: "Co-Loop" }, { id: "duel" as const, label: "Duel" }, { id: "circle" as const, label: "Circle" }], [])
  const move = useCallback((event: React.MouseEvent) => { const rect = cardRef.current?.getBoundingClientRect(); if (!rect) return; setTilt({ x: (((event.clientY - rect.top) / rect.height) - .5) * -10, y: (((event.clientX - rect.left) / rect.width) - .5) * 12 }) }, [])
  return <div ref={cardRef} onMouseMove={move} onMouseLeave={() => setTilt({ x: 0, y: 0 })} className="relative will-change-transform" style={{ transform: `perspective(1100px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition: "transform .15s ease-out" }}><div className="pointer-events-none absolute -bottom-12 left-1/2 h-28 w-[90%] -translate-x-1/2 rounded-full bg-[#5b8def]/30 blur-3xl" /><div className="relative overflow-hidden rounded-[22px] border border-white/[.1] bg-[#0a0a0d] shadow-[0_50px_120px_-40px_rgba(0,0,0,.95)]"><div className="flex items-center gap-3 border-b border-white/[.06] px-4 py-3"><div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-white/[.12]" /><span className="h-2.5 w-2.5 rounded-full bg-white/[.12]" /><span className="h-2.5 w-2.5 rounded-full bg-white/[.12]" /></div><div className="mx-auto flex gap-1 rounded-lg bg-white/[.04] p-0.5">{tabs.map((item) => <button type="button" key={item.id} onClick={() => setTab(item.id)} className={cn("rounded-md px-3 py-1 text-[11px]", tab === item.id ? "bg-white/[.1] text-white" : "text-white/35")}>{item.label}</button>)}</div></div><div className="min-h-[280px] p-4 sm:p-5">{tab === "coloop" && <div className="space-y-3"><div className="rounded-xl border border-white/[.07] bg-[#111114] p-4"><div className="mb-3 flex justify-between"><span className="text-[12px] text-white/50">4 writing</span><span className="text-[11px] text-emerald-400">● Live</span></div><p className="font-mono text-[12px] leading-relaxed text-white/55"><span className="text-sky-400">@kai</span> badge unlock after 3 wins, not 10<br /><span className="text-pink-400">@mira</span> + show streak on profile</p><div className="mt-4 h-1 rounded-full bg-white/[.06]"><div className="h-full w-[72%] rounded-full bg-white/40" /></div></div><p className="text-center text-[11px] text-white/25">Real cursors · shared publish · attribution for everyone</p></div>}{tab === "duel" && <div className="space-y-3"><div className="rounded-xl border border-white/[.07] bg-[#111114] p-4"><div className="flex items-center gap-2"><Swords className="h-4 w-4 text-rose-400" /><p className="text-[13px]">Is mobile-first killing longform?</p></div><p className="mt-2 text-[11px] text-white/35">214 votes · ends in 2h</p><div className="mt-4 space-y-2"><div className="h-2 w-[58%] rounded-full bg-sky-400/70" /><div className="h-2 w-[42%] rounded-full bg-rose-400/70" /></div></div><p className="text-center text-[11px] text-white/25">Stake coins · make the case · crowd decides</p></div>}{tab === "circle" && <div className="space-y-3"><div className="rounded-xl border border-white/[.07] bg-[#111114] p-4"><p className="text-[13px]">#builders</p><p className="text-[11px] text-white/35">1,204 members · 47 online</p><div className="mt-4 space-y-2 text-[12px] text-white/50"><p>Nova · shipped the invite flow</p><p>Rex · co-loop on the docs?</p><p>Ash · tabs vs spaces 👀</p></div></div><p className="text-center text-[11px] text-white/25">Roles · events · moderation that scales</p></div>}</div></div></div>
}

export function LandingContent() {
  const [heroIn, setHeroIn] = useState(false)
  const [stats, setStats] = useState<{ total_users: number; total_loops: number; total_circles: number; total_duels: number } | null>(null)
  useEffect(() => { const id = requestAnimationFrame(() => setHeroIn(true)); return () => cancelAnimationFrame(id) }, [])
  useEffect(() => { fetch("/api/stats").then((response) => response.json()).then((data) => { if (data?.success !== false) setStats({ total_users: Number(data.total_users || 0), total_loops: Number(data.total_loops || 0), total_circles: Number(data.total_circles || 0), total_duels: Number(data.total_duels || 0) }) }).catch(() => {}) }, [])
  const features = [{ tag: "Co-Loop", title: "Write with people in the room", body: "Up to four of you, same draft, live cursors. Publish once — everyone gets credit." }, { tag: "Duels", title: "Argue. Stake. Get judged.", body: "Put coins on the line, make the case, let the crowd decide. No vague quote-tweets." }, { tag: "Circles", title: "Rooms that actually run", body: "Chat, roles, events, moderation. Built for communities that outgrow group chats." }, { tag: "Coins", title: "Earn without the middleman tax", body: "Gifts, boosts, cash-outs via Stripe. Your work, your money — from day one." }]
  const extras = [{ icon: Trophy, label: "Quests & rewards" }, { icon: Play, label: "Reels & Trees" }, { icon: Coins, label: "Boosts" }]
  return <div className="relative min-h-screen overflow-x-hidden bg-[#060607] text-white"><LivingBackground /><header className="relative z-40 border-b border-white/[.05] bg-[#060607]/70 backdrop-blur-xl"><div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8"><Link href="/" className="flex items-center gap-2.5"><AppLogo className="h-7 w-7 rounded-lg" /><span className="text-[14px] font-semibold">loopapp.me</span></Link><nav className="hidden items-center gap-8 text-[13px] text-white/40 md:flex"><a href="#features">Product</a><a href="#money">Creators</a><a href="#moment">Why Loop</a><Link href="/download">App</Link></nav><div className="flex items-center gap-1.5"><Link href="/login"><Button variant="ghost" size="sm" className="h-8 text-white/50">Log in</Button></Link><Magnetic strength={.45}><Link href="/signup"><Button size="sm" className="h-8 rounded-full bg-white px-3.5 text-black">Sign up</Button></Link></Magnetic></div></div></header><main className="relative z-10"><section className="mx-auto max-w-6xl px-5 pb-20 pt-20 sm:px-8 sm:pt-28 lg:pb-28 lg:pt-32"><div className="grid items-center gap-16 lg:grid-cols-[1.1fr_.9fr]"><div><p className={cn("mb-6 text-[13px] text-white/40 transition-all duration-1000", heroIn ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>Social for people who make things</p><h1 className={cn("max-w-[12ch] text-[clamp(2.75rem,7vw,4.25rem)] font-semibold leading-[.98] tracking-[-.045em] transition-all duration-1000", heroIn ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0")}>Stop posting into silence.</h1><p className="mt-7 max-w-md text-[17px] leading-relaxed text-white/45">Co-write live. Settle debates in public. Build circles that work. Creation was never meant to be a solo act.</p><div className="mt-10 flex flex-wrap gap-3"><Magnetic strength={.4}><Link href="/signup"><Button size="lg" className="h-12 rounded-full bg-white px-7 text-black">Get started free <ArrowRight className="ml-1.5 h-4 w-4" /></Button></Link></Magnetic><Link href="/download"><Button size="lg" variant="ghost" className="h-12 rounded-full text-white/55"><Smartphone className="mr-1.5 h-4 w-4" />Get the app</Button></Link></div><p className="mt-6 text-[12px] text-white/30"><Check className="mr-1 inline h-3 w-3" />No waitlist <Check className="ml-3 mr-1 inline h-3 w-3" />Free to start <Check className="ml-3 mr-1 inline h-3 w-3" />You keep your content</p></div><div className="hidden lg:block"><InteractiveMock /></div></div></section>{stats && Object.values(stats).some((value) => value > 0) && <Reveal><section className="border-y border-white/[.05]"><div className="mx-auto grid max-w-6xl grid-cols-2 sm:grid-cols-4">{[[stats.total_loops, "Loops"], [stats.total_users, "People"], [stats.total_circles, "Circles"], [stats.total_duels, "Duels"]].filter(([value]) => Number(value) > 0).map(([value, label]) => <div key={String(label)} className="py-9 text-center"><strong className="block text-2xl tabular-nums sm:text-3xl">{Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(1)}k` : Number(value).toLocaleString()}</strong><span className="text-[12px] text-white/35">{label}</span></div>)}</div></section></Reveal>}<section id="features" className="scroll-mt-20 py-24 sm:py-32"><div className="mx-auto max-w-6xl px-5 sm:px-8"><Reveal><p className="text-[13px] text-white/35">What you get</p><h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Not another infinite feed.</h2></Reveal><div className="mt-16 divide-y divide-white/[.06] border-y border-white/[.06]">{features.map((feature, index) => <Reveal key={feature.tag} delay={index * 60}><div className="grid gap-4 py-10 sm:grid-cols-[160px_1fr_1.2fr] sm:gap-10 sm:items-baseline"><span className="text-[13px] uppercase tracking-wider text-white/30">{feature.tag}</span><h3 className="text-xl font-semibold sm:text-2xl">{feature.title}</h3><p className="text-[15px] leading-relaxed text-white/40">{feature.body}</p></div></Reveal>)}</div><div className="mt-10 flex flex-wrap gap-2">{extras.map(({ icon: Icon, label }) => <span key={label} className="rounded-full border border-white/[.07] px-3.5 py-1.5 text-[13px] text-white/45"><Icon className="mr-2 inline h-3.5 w-3.5" />{label}</span>)}</div></div></section><section id="money" className="border-y border-white/[.05] bg-white/[.015] py-24 sm:py-32"><div className="mx-auto max-w-6xl px-5 sm:px-8"><Reveal><p className="text-[13px] text-white/35">Creator Studio</p><h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Get paid for the work.</h2><p className="mt-5 max-w-md text-[16px] leading-relaxed text-white/40">Fans gift with real money. You boost the posts that matter. Cash out when you want — Stripe handles the rest.</p><ul className="mt-8 space-y-3 text-[14px] text-white/55">{["Stripe payouts, not IOUs", "Boost into discovery without ads", "Gift economy that rewards craft", "You own everything you post"].map((item) => <li key={item}><Check className="mr-2 inline h-4 w-4 text-white/30" />{item}</li>)}</ul><Link href="/signup" className="mt-9 inline-flex text-white/80">Open Creator Studio <ArrowUpRight className="ml-1.5 h-4 w-4" /></Link></Reveal></div></section><section id="moment" className="mx-auto max-w-6xl px-5 py-28 text-center sm:px-8 sm:py-36"><Reveal><div className="rounded-[28px] border border-white/[.1] bg-[#08080a] px-6 py-20 sm:px-12 sm:py-28"><p className="text-[13px] text-white/40">The whole idea</p><h2 className="mt-5 text-[clamp(2rem,5.5vw,3.75rem)] font-semibold leading-tight">Creation was never<br />meant to be lonely.</h2><p className="mx-auto mt-6 max-w-md text-[16px] leading-relaxed text-white/45">Co-write. Duel. Build rooms. Get paid.<br />Loop is social software for people who make things.</p><div className="mt-10"><Magnetic strength={.4}><Link href="/signup"><Button size="lg" className="h-12 rounded-full bg-white px-8 text-black">Start free <ArrowRight className="ml-1.5 h-4 w-4" /></Button></Link></Magnetic></div></div></Reveal></section></main><footer className="relative z-10 border-t border-white/[.05] py-10"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 sm:px-8"><div className="flex items-center gap-2"><AppLogo className="h-5 w-5 rounded-md opacity-70" /><span className="text-[13px] text-white/30">loopapp.me</span></div><div className="flex gap-6 text-[13px] text-white/30"><a href="#features">Product</a><a href="#money">Creators</a><Link href="/download">Download</Link></div></div></footer></div>
}
