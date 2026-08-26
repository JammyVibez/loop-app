/**
 * Generate a DiceBear Adventurer avatar URL from a seed (username or user ID).
 * Each unique seed produces a different cartoon character.
 * 
 * @see https://www.dicebear.com/styles/adventurer/
 */
export function getDiceBearUrl(seed: string | null | undefined, size?: number): string {
  const s = seed || "default"
  const params = new URLSearchParams({ seed: s })
  if (size) params.set("size", String(size))
  // Use PNG format — more reliably rendered across browsers than SVG
  return `https://api.dicebear.com/9.x/adventurer/png?${params.toString()}`
}

/**
 * Animated DiceBear avatar — wraps the SVG in a container with
 * subtle CSS breathing / float animation so default avatars feel alive.
 */
export const DICEBEAR_ANIMATION_CLASSES =
  "animate-[dicebear-breathe_3s_ease-in-out_infinite]"
