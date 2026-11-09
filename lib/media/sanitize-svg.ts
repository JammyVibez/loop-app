/**
 * SVG sanitiser for admin-uploaded vectors.
 *
 * An SVG is a document, not just an image: `<script>`, event handlers and
 * `javascript:` URLs all execute in the page origin when the file is opened
 * directly, which is why uploaded SVGs must never be served as authored. This
 * removes anything executable while keeping shapes, gradients, masks, text and
 * embedded raster images so logos, badges and frames still render identically.
 *
 * Deliberately allow-list based: unknown elements are dropped rather than
 * trusted, so new SVG features can't become a bypass.
 */

const ALLOWED_ELEMENTS = new Set([
  "svg", "g", "defs", "symbol", "use", "title", "desc", "metadata",
  "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "textPath", "image",
  "linearGradient", "radialGradient", "stop", "pattern", "clipPath", "mask", "filter",
  "feGaussianBlur", "feOffset", "feBlend", "feColorMatrix", "feComposite", "feFlood",
  "feMerge", "feMergeNode", "feTurbulence", "feDisplacementMap", "feMorphology",
  "feDropShadow", "feComponentTransfer", "feFuncR", "feFuncG", "feFuncB", "feFuncA",
  "marker", "style", "animate", "animateTransform", "set",
])

/** Attributes that can execute or navigate. */
const BLOCKED_ATTRIBUTE = /^(on[a-z]+|href|xlink:href|src|action|formaction|style)$/i

const ALLOWED_PROTOCOLS = /^(#|data:image\/(png|jpe?g|gif|webp);base64,|\/|\.\/)/i

function sanitizeStyleValue(value: string): string {
  return value
    .replace(/@import[^;]+;?/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/url\s*\(\s*(['"]?)\s*javascript:[^)]*\)/gi, "none")
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

const ENTITY_WITH_SCRIPT = /<!ENTITY/i

export function sanitizeSvg(input: string): { svg: string; removed: string[] } {
  const removed: string[] = []
  if (ENTITY_WITH_SCRIPT.test(input)) {
    // XML entities can expand into executable markup (billion-laughs style
    // attacks and XXE); refuse rather than try to untangle them.
    throw new Error("That SVG contains XML entities and cannot be sanitised.")
  }

  let svg = input
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_m, content: string) => content.replace(/</g, "&lt;"))

  // Drop disallowed elements entirely, including their content.
  svg = svg.replace(/<\s*([a-zA-Z0-9:_-]+)([^>]*)>([\s\S]*?)<\s*\/\s*\1\s*>/g, (match, tagName: string) => {
    if (ALLOWED_ELEMENTS.has(tagName)) return match
    removed.push(tagName)
    return ""
  })

  // Drop self-closing elements that aren't allowed.
  svg = svg.replace(/<\s*([a-zA-Z0-9:_-]+)([^>]*)\/>/g, (match, tagName: string) => {
    if (ALLOWED_ELEMENTS.has(tagName) && tagName !== "script") return match
    removed.push(tagName)
    return ""
  })

  const openTag = /<\s*([a-zA-Z0-9:_-]+)\b([^>]*)>/g
  svg = svg.replace(openTag, (match, tagName: string, attrs: string) => {
    if (!ALLOWED_ELEMENTS.has(tagName)) return ""
    const cleaned = attrs.replace(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g, (
      _full,
      name: string,
      _raw: string,
      doubleQuoted?: string,
      singleQuoted?: string,
      bare?: string,
    ) => {
      const value = doubleQuoted ?? singleQuoted ?? bare ?? ""
      const lower = name.toLowerCase()
      if (BLOCKED_ATTRIBUTE.test(lower)) {
        if (lower === "href" || lower === "xlink:href") {
          if (!ALLOWED_PROTOCOLS.test(value.trim())) {
            removed.push(`${tagName}@${name}`)
            return ""
          }
        } else if (lower === "style") {
          return `style="${escapeAttribute(sanitizeStyleValue(value))}"`
        } else {
          removed.push(`${tagName}@${name}`)
          return ""
        }
      }
      const safe = ALLOWED_PROTOCOLS.test(value.trim()) || !/(javascript|vbscript):/i.test(value)
        ? value
        : ""
      return `${name}="${escapeAttribute(safe)}"`
    })
    return `<${tagName}${cleaned}>`
  })

  // Any <style> block can carry @import / expression() payloads.
  svg = svg.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (_m, attrs: string, css: string) => {
    return `<style${attrs}>${sanitizeStyleValue(css)}</style>`
  })

  // Inline event handlers introduced through CDATA or odd casing.
  svg = svg.replace(/\son[a-z]+\s*=\s*("([^"]*)"|'([^']*)')/gi, () => {
    removed.push("inline event handler")
    return ""
  })

  if (!/<svg[\s>]/i.test(svg)) throw new Error("That file is not a valid SVG.")
  if (!/xmlns=/i.test(svg)) {
    svg = svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
  }

  return { svg: svg.trim(), removed: Array.from(new Set(removed)) }
}
