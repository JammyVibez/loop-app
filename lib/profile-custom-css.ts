import postcss, { type AtRule, type Node, type Root, type Rule } from "postcss"
import { MAX_PROFILE_CUSTOM_CSS_BYTES, profileCustomCssByteLength } from "@/lib/profile-custom-css-limits"

const PROFILE_SCOPE_CLASS = "loop-profile-custom-css"
const ALLOWED_AT_RULES = new Set([
  "media",
  "supports",
  "container",
  "layer",
  "keyframes",
  "-webkit-keyframes",
])
const BLOCKED_SOURCE = /\b(?:url|expression)\s*\(|javascript\s*:|vbscript\s*:|<\/style|<!--|-->|@import\b/i

function decodeCssEscapes(value: string): string {
  const withoutLineContinuations = value.replace(/\\(?:\r\n|[\r\n\f])/g, "")
  return withoutLineContinuations
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(
      /\\([0-9a-f]{1,6})\s?|\\([^\r\n0-9a-f])/gi,
      (_match, hex: string | undefined, escaped: string | undefined) => {
        if (!hex) return escaped || ""
        const codePoint = Number.parseInt(hex, 16)
        return codePoint === 0 || codePoint > 0x10ffff
          ? "\ufffd"
          : String.fromCodePoint(codePoint)
      },
    )
}

function hashCss(css: string): string {
  let hash = 2166136261
  for (let index = 0; index < css.length; index += 1) {
    hash ^= css.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function splitSelectorList(selector: string): string[] {
  const selectors: string[] = []
  let start = 0
  let parentheses = 0
  let brackets = 0
  let quote = ""
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index]
    if (character === "\\") {
      index += 1
      continue
    }
    if (quote) {
      if (character === quote) quote = ""
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (character === "(") parentheses += 1
    else if (character === ")") parentheses -= 1
    else if (character === "[") brackets += 1
    else if (character === "]") brackets -= 1
    else if (character === "," && parentheses === 0 && brackets === 0) {
      selectors.push(selector.slice(start, index).trim())
      start = index + 1
    }
    if (parentheses < 0 || brackets < 0) {
      throw new Error("Invalid CSS selector list.")
    }
  }
  if (quote || parentheses !== 0 || brackets !== 0) {
    throw new Error("Invalid CSS selector list.")
  }
  selectors.push(selector.slice(start).trim())
  if (selectors.some((item) => !item || item.includes("&"))) {
    throw new Error("Use complete CSS selectors; nested '&' selectors are not supported.")
  }
  return selectors
}

function scopeSelector(selector: string): string {
  const scope = "." + PROFILE_SCOPE_CLASS
  const rootMatch = /^(?::root|html|body)/i.exec(selector)
  if (rootMatch) {
    const next = selector[rootMatch[0].length]
    if (next === undefined || /\s/.test(next) || [">", "+", "~", ".", "#", ":", "["].includes(next)) {
      return scope + selector.slice(rootMatch[0].length)
    }
  }
  return scope + " " + selector
}

function isInsideKeyframes(node: Node): boolean {
  let parent = node.parent
  while (parent) {
    if (parent.type === "atrule" && /^(?:-webkit-)?keyframes$/i.test((parent as AtRule).name)) {
      return true
    }
    parent = parent.parent
  }
  return false
}

/**
 * Validate user CSS, prevent browser-side resource loads, namespace animation
 * names and scope every ordinary selector to the owner's profile root.
 */
export function sanitizeProfileCustomCss(input: string): string {
  if (typeof input !== "string") {
    throw new Error("Custom profile CSS must be a string.")
  }
  const byteLength = profileCustomCssByteLength(input)
  if (byteLength > MAX_PROFILE_CUSTOM_CSS_BYTES) {
    throw new Error("Custom profile CSS is limited to " + MAX_PROFILE_CUSTOM_CSS_BYTES.toLocaleString() + " bytes.")
  }
  const source = input.trim()
  if (!source) return ""
  if (BLOCKED_SOURCE.test(decodeCssEscapes(source))) {
    throw new Error("CSS imports, external URLs and executable values are not allowed.")
  }

  let root: Root
  try {
    root = postcss.parse(source)
  } catch {
    throw new Error("The CSS has a syntax error. Check the braces, selectors and declarations.")
  }

  const keyframePrefix = "loop_profile_" + hashCss(source)
  const keyframeNames = new Map<string, string>()

  root.walkAtRules((atRule: AtRule) => {
    const name = atRule.name.toLowerCase()
    if (name === "keyframes" || name === "-webkit-keyframes") {
      const match = /^([-_a-zA-Z][\w-]*)([\s\S]*)$/.exec(atRule.params.trim())
      if (!match) throw new Error("Each @keyframes rule needs a simple animation name.")
      const alreadyScoped = /^loop_profile_[a-z0-9]+_/i.test(match[1])
      const scopedName = alreadyScoped ? match[1] : keyframePrefix + "_" + match[1]
      keyframeNames.set(match[1], scopedName)
      atRule.params = scopedName + match[2]
      return
    }
    if (!ALLOWED_AT_RULES.has(name)) {
      throw new Error("The @" + atRule.name + " rule is not supported in profile CSS.")
    }
  })

  root.walkDecls((declaration) => {
    const property = declaration.prop.toLowerCase()
    if (property === "behavior" || property === "-moz-binding") {
      throw new Error("This CSS property is not allowed in profile styles.")
    }
    if (keyframeNames.size && (property === "animation" || property === "animation-name")) {
      let value = declaration.value
      for (const [originalName, scopedName] of keyframeNames) {
        const matcher = new RegExp("(^|[^\\w-])" + originalName + "(?=$|[^\\w-])", "g")
        value = value.replace(matcher, "$1" + scopedName)
      }
      declaration.value = value
    }
  })

  root.walkRules((rule: Rule) => {
    if (isInsideKeyframes(rule)) return
    rule.selector = splitSelectorList(rule.selector).map(scopeSelector).join(", ")
  })

  return root.toString()
}
