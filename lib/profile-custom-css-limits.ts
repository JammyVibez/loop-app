export const MAX_PROFILE_CUSTOM_CSS_BYTES = 21_000

export function profileCustomCssByteLength(css: string): number {
  return new TextEncoder().encode(css).byteLength
}
