export function AppBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#030712]" aria-hidden>
      <div className="landing-grid-bg absolute inset-0 opacity-[0.38]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b1220] via-[#030712]/70 to-[#030712]" />
      <div className="landing-aurora-blob absolute -left-1/4 top-[-20%] h-[70vmin] w-[70vmin] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.42),transparent_65%)] blur-3xl" />
      <div className="landing-aurora-blob absolute -right-1/4 top-[10%] h-[60vmin] w-[60vmin] rounded-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.32),transparent_65%)] blur-3xl [animation-delay:-6s]" />
      <div className="absolute bottom-[-30%] left-1/2 h-[50vmin] w-[90vmin] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.22),transparent_70%)] blur-3xl" />
    </div>
  )
}
