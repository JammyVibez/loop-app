import Link from "next/link"
import { MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { type ProfileNote, noteExpiryLabel } from "@/lib/profile-note"

interface NoteBubbleProps {
  note: ProfileNote
  /**
   * `card` sits inline in a post header (one line, no timer); `profile` gets
   * the bigger treatment under the name, where the 24h timer is worth showing.
   */
  variant?: "card" | "profile"
  className?: string
}

/**
 * The note itself — a short line in a soft pill. Deliberately quieter than a
 * post: it is a status, not content, and it must not out-shout the card it
 * sits on.
 */
export function NoteBubble({ note, variant = "card", className }: NoteBubbleProps) {
  const content = note.content
  if (!content) return null

  if (variant === "profile") {
    return (
      <div
        className={cn(
          "flex items-start gap-2 rounded-2xl rounded-tl-sm border border-indigo-500/25 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 px-3 py-2",
          className,
        )}
        title={`Note · expires in ${noteExpiryLabel(note)}`}
      >
        <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500/80" />
        <div className="min-w-0">
          <p className="text-sm leading-snug text-foreground/90">{content}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Note · expires in {noteExpiryLabel(note)}</p>
        </div>
      </div>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border border-indigo-500/25 bg-indigo-500/[0.07] px-2 py-0.5",
        className,
      )}
      title={`Note: ${content}`}
    >
      <MessageCircle className="h-3 w-3 shrink-0 text-indigo-500/70" />
      <span className="truncate text-[11px] leading-tight text-foreground/80">{content}</span>
    </span>
  )
}

interface NoteLinkProps {
  note: ProfileNote
  username?: string | null
  variant?: "card" | "profile"
  className?: string
}

/** On someone else's card the note links to their profile, where it lives. */
export function NoteLink({ note, username, variant = "card", className }: NoteLinkProps) {
  if (!username) return <NoteBubble note={note} variant={variant} className={className} />
  return (
    <Link
      href={`/profile/${encodeURIComponent(username)}`}
      className={cn("hover:opacity-80", className)}
      aria-label={`${username}'s note`}
    >
      <NoteBubble note={note} variant={variant} />
    </Link>
  )
}
