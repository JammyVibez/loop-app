export function AppBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#030712]" aria-hidden>
      <div className="landing-grid-bg absolute inset-0 opacity-[0.38]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b1220] via-[#030712]/70 to-[#030712]" />
      {/* Subtle edge accents — barely visible, not floating blobs */}
      <div className="absolute -top-32 -left-32 h-64 w-64 rounded-full bg-violet-600/[0.06]" />
      <div className="absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-cyan-600/[0.05]" />
    </div>
  )
}
