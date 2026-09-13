/**
 * Contextual error messages — replace generic "Error" / "Something went wrong" toasts
 * with messages that tell the user what actually happened and what to do next.
 *
 * Usage:
 *   import { getErrorMessage } from "@/lib/error-messages"
 *   toast({ title: "Couldn't save", description: getErrorMessage(err, "save your post"), variant: "destructive" })
 */

type ErrorContext =
  | "save your post"
  | "load your feed"
  | "send your message"
  | "upload your file"
  | "vote on this poll"
  | "join this community"
  | "follow this user"
  | "delete this item"
  | "share this post"
  | "load comments"
  | "post a comment"
  | "toggle notifications"
  | "switch accounts"
  | "load profile"
  | "save settings"
  | "verify your identity"
  | "load messages"
  | string

/**
 * Returns a human-readable error message based on the context.
 * Falls back to the original error message if it's useful, or a generic message if not.
 */
export function getErrorMessage(error: unknown, context: ErrorContext): string {
  const msg = error instanceof Error ? error.message : String(error);

  // Network errors
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("ERR_NETWORK")) {
    return `Check your connection and try again.`
  }

  // Auth errors
  if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("not authenticated")) {
    return `You need to sign in again to ${context}.`
  }

  // Permission errors
  if (msg.includes("403") || msg.includes("Forbidden") || msg.includes("permission")) {
    return `You don't have permission to ${context}.`
  }

  // Not found
  if (msg.includes("404") || msg.includes("Not Found")) {
    return `This content may have been removed.`
  }

  // Rate limiting
  if (msg.includes("429") || msg.includes("rate limit") || msg.includes("Too Many")) {
    return `You're doing that too often. Wait a moment and try again.`
  }

  // Server errors
  if (msg.includes("500") || msg.includes("502") || msg.includes("503")) {
    return `Something went wrong on our end. Try again in a moment.`
  }

  // Timeout
  if (msg.includes("timeout") || msg.includes("Timeout")) {
    return `The request took too long. Try again.`
  }

  // If the original message is short and readable, use it
  if (msg.length < 80 && !msg.includes("[object")) {
    return msg
  }

  // Fallback
  return `Couldn't ${context}. Try again.`
}
