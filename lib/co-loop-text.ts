/**
 * Character-level text operations for the Co-Loop Studio's live co-editing.
 *
 * ## Why this exists
 * The studio used to broadcast the *entire* value of a field on every
 * keystroke. That is last-writer-wins at field granularity, so as soon as two
 * creators typed in the same field the caret jumped to wherever the remote
 * value happened to end and one of the two contributions silently vanished.
 *
 * Instead we broadcast the *difference* between the text we last published and
 * the text we now have. An op list is therefore tiny (a delete + an insert at a
 * single point, at most two ops — see `diffToOps`), which keeps messages small
 * and, more importantly, lets a receiver apply a remote edit *in place*: text
 * around the caret is untouched, so the caret only moves by the net length of
 * the ops that land before it (`caretAfterOps`).
 *
 * ## Convergence guarantee
 * Ops carry no global ordering, so two creators who type at the *same* offset
 * inside the same flush window are ordered deterministically by sender id
 * (`transformAgainst`'s `opsWin` argument). That resolves the common case, and
 * the studio additionally runs a leader reconciliation pass (the lowest user id
 * periodically publishes an authoritative snapshot) which guarantees the room
 * converges even if two peers briefly disagree.
 */

/** A single edit against a known text: insert `t` at `p`, or delete `n` chars at `p`. */
export type TextOp =
  | { o: "i"; p: number; t: string }
  | { o: "d"; p: number; n: number }

/**
 * Diff two strings into at most two ops (one delete + one insert) by trimming
 * the shared prefix and suffix. Returns `[]` when the strings are equal.
 */
export function diffToOps(base: string, next: string): TextOp[] {
  if (base === next) return []

  let prefix = 0
  const maxPrefix = Math.min(base.length, next.length)
  while (prefix < maxPrefix && base[prefix] === next[prefix]) prefix++

  let suffix = 0
  const maxSuffix = Math.min(base.length, next.length) - prefix
  while (
    suffix < maxSuffix &&
    base[base.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix++
  }

  const removed = base.slice(prefix, base.length - suffix)
  const inserted = next.slice(prefix, next.length - suffix)

  const ops: TextOp[] = []
  if (removed.length > 0) ops.push({ o: "d", p: prefix, n: removed.length })
  if (inserted.length > 0) ops.push({ o: "i", p: prefix, t: inserted })
  return ops
}

/** Apply an op list to `text`. Ops are applied in order; positions are in the text's own coordinate space as it evolves. */
export function applyOps(text: string, ops: TextOp[]): string {
  let out = text
  for (const op of ops) {
    if (op.o === "i") {
      out = out.slice(0, op.p) + op.t + out.slice(op.p)
    } else {
      out = out.slice(0, op.p) + out.slice(op.p + op.n)
    }
  }
  return out
}

/**
 * How far a character originally sitting at `pos` moves after `applied` runs.
 * Insertions strictly before `pos` always push it right; an insertion at
 * exactly `pos` pushes it right only when `appliedTakesPrecedence` says the
 * applied edit occupies the earlier slot in the same-position tie-break.
 */
function shiftFor(pos: number, applied: TextOp[], appliedTakesPrecedence: boolean): number {
  let delta = 0
  for (const op of applied) {
    if (op.o === "i") {
      if (op.p < pos || (op.p === pos && appliedTakesPrecedence)) delta += op.t.length
    } else if (op.p + op.n <= pos) {
      delta -= op.n
    } else if (op.p < pos) {
      delta -= pos - op.p
    }
  }
  return delta
}

/** Number of characters in `[pos, pos+count)` that `applied` already deleted. */
function overlappedDelete(pos: number, count: number, applied: TextOp[]): number {
  let removed = 0
  for (const op of applied) {
    if (op.o !== "d") continue
    const start = Math.max(pos, op.p)
    const end = Math.min(pos + count, op.p + op.n)
    if (end > start) removed += end - start
  }
  return removed
}

/**
 * Rebase `ops` so they can be applied to text that already contains `applied`.
 *
 * `appliedTakesPrecedence` breaks same-position insert ties: when true the
 * `applied` edit owns the earlier slot, so `ops` shifts past it. Two peers
 * transforming the same pair of concurrent op lists must pass opposite values
 * (derived from a stable comparison such as `myUserId < remoteUserId`) — one
 * side shifts, the other does not, and both land on the same string.
 */
export function transformAgainst(
  ops: TextOp[],
  applied: TextOp[],
  appliedTakesPrecedence: boolean
): TextOp[] {
  if (ops.length === 0 || applied.length === 0) return ops

  const out: TextOp[] = []
  for (const op of ops) {
    const pos = Math.max(0, op.p + shiftFor(op.p, applied, appliedTakesPrecedence))
    if (op.o === "i") {
      out.push({ o: "i", p: pos, t: op.t })
      continue
    }
    const count = op.n - overlappedDelete(op.p, op.n, applied)
    if (count > 0) out.push({ o: "d", p: pos, n: count })
  }
  return out
}

/**
 * Where a caret that was at `caret` ends up after `ops` are applied to the
 * text. Positions are clamped to the resulting length so a stale selection can
 * never throw on the <textarea>.
 */
export function caretAfterOps(caret: number, ops: TextOp[], resultLength: number): number {
  let next = caret
  for (const op of ops) {
    if (op.o === "i") {
      if (op.p < caret || (op.p === caret && op.t.length > 0)) next += op.t.length
    } else if (op.p + op.n <= caret) {
      next -= op.n
    } else if (op.p < caret) {
      next -= caret - op.p
    }
  }
  return Math.max(0, Math.min(next, resultLength))
}

/** Cheap content hash used to detect peers that have drifted apart. */
export function hashText(value: string): number {
  let hash = 5381
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0
  }
  return hash >>> 0
}

/** Validate an untrusted op array coming off the realtime wire. */
export function isTextOpList(value: unknown): value is TextOp[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 8) return false
  return value.every((op: any) => {
    if (!op || typeof op !== "object") return false
    if (typeof op.p !== "number" || !Number.isFinite(op.p) || op.p < 0) return false
    if (op.o === "i") return typeof op.t === "string" && op.t.length > 0 && op.t.length <= 20_000
    if (op.o === "d") return typeof op.n === "number" && Number.isFinite(op.n) && op.n > 0
    return false
  })
}

/** Realtime edit message exchanged between studio participants. */
export interface CoEditMessage {
  field: string
  ops: TextOp[]
  from: string
  rev: number
  /** Highest op revision this sender has applied from each participant. */
  seen?: Record<string, number>
}

export interface CoEditBroadcast extends CoEditMessage {
  seen: Record<string, number>
}

interface FieldState {
  text: string
  /** The text we believe the room currently agrees on (local edits already flushed). */
  published: string
  /** Op lists we published, kept so we can rebase peers that haven't seen them yet. */
  history: { rev: number; ops: TextOp[] }[]
  rev: number
  /** Wall-clock time of the last local edit, used to protect active typing. */
  lastEditAt: number
}

const HISTORY_LIMIT = 400

/**
 * Per-field convergence bookkeeping for the live editor.
 *
 * Each field keeps two strings: `text` (what this participant is looking at)
 * and `published` (what the room has agreed on, from this participant's point
 * of view). The difference between them is the pending local edit; the whole
 * class is pure so it can be unit-tested without a browser or a socket.
 */
export class CoEditSession {
  private fields = new Map<string, FieldState>()
  private seenByMe: Record<string, number> = {}

  constructor(private readonly selfId: string) {}

  private field(name: string): FieldState {
    let state = this.fields.get(name)
    if (!state) {
      state = { text: "", published: "", history: [], rev: 0, lastEditAt: 0 }
      this.fields.set(name, state)
    }
    return state
  }

  getText(field: string): string {
    return this.field(field).text
  }

  /** True when a local edit has been recorded but not yet published. */
  hasPending(field: string): boolean {
    const state = this.field(field)
    return state.text !== state.published
  }

  /** Seed a field (first load, or an authoritative snapshot we accept). */
  reset(field: string, text: string): void {
    const state = this.field(field)
    state.text = text
    state.published = text
    state.history = []
    state.rev = 0
    state.lastEditAt = 0
  }

  /**
   * Record local typing without publishing it yet. The difference against the
   * last published text is flushed later by `localEdit`, which lets callers
   * coalesce a burst of keystrokes into a single tiny op list.
   */
  setLocalText(field: string, text: string): void {
    const state = this.field(field)
    state.text = text
    state.lastEditAt = Date.now()
  }

  /**
   * Publish (and return) the message for everything typed since the last
   * publish, or `null` when there is nothing new to send.
   */
  localEdit(field: string, text: string = this.field(field).text): CoEditBroadcast | null {
    const state = this.field(field)
    state.text = text
    state.lastEditAt = Date.now()
    const ops = diffToOps(state.published, text)
    if (ops.length === 0) return null

    state.published = text
    state.rev += 1
    state.history.push({ rev: state.rev, ops })
    if (state.history.length > HISTORY_LIMIT) {
      state.history.splice(0, state.history.length - HISTORY_LIMIT)
    }
    return { field, ops, from: this.selfId, rev: state.rev, seen: { ...this.seenByMe } }
  }

  /**
   * Apply a peer's edit. Returns the resulting text plus the ops that were
   * applied locally (used to move the caret by exactly the right amount), or
   * `null` when the message is stale, self-authored, or malformed.
   */
  receive(msg: CoEditMessage): { field: string; text: string; appliedOps: TextOp[] } | null {
    if (!msg || msg.from === this.selfId) return null
    if (typeof msg.field !== "string" || msg.field.length === 0) return null
    if (typeof msg.rev !== "number" || msg.rev <= (this.seenByMe[msg.from] ?? 0)) return null
    if (!isTextOpList(msg.ops)) return null

    const state = this.field(msg.field)
    const senderHadApplied = Number(msg.seen?.[this.selfId] ?? 0) || 0
    const myWin = this.selfId < msg.from
    const before = state.text
    const pending = diffToOps(state.published, state.text)

    // Rebase the incoming edit past our own publishes the sender had not seen.
    let incoming = msg.ops
    for (const entry of state.history) {
      if (entry.rev <= senderHadApplied) continue
      incoming = transformAgainst(incoming, entry.ops, myWin)
    }

    let nextText: string
    if (myWin) {
      const rebased = transformAgainst(incoming, pending, true)
      nextText = applyOps(applyOps(state.published, pending), rebased)
    } else {
      const rebasedPending = transformAgainst(pending, incoming, true)
      nextText = applyOps(applyOps(state.published, incoming), rebasedPending)
    }

    state.published = applyOps(state.published, incoming)
    state.text = nextText
    this.seenByMe[msg.from] = msg.rev

    return {
      field: msg.field,
      text: nextText,
      appliedOps: before === nextText ? [] : diffToOps(before, nextText),
    }
  }

  /**
   * Adopt an authoritative snapshot from the session leader.
   *
   * Returns `true` when the snapshot was adopted. It returns `false` when this
   * participant typed within `protectMs` (or has an unflushed edit) — the
   * caller must then re-publish its own text so the reconciliation pass merges
   * the two instead of discarding live typing.
   */
  applyAuthoritative(field: string, text: string, protectMs = 1500): boolean {
    const state = this.field(field)
    const typingNow = state.lastEditAt > 0 && Date.now() - state.lastEditAt < protectMs
    if (!this.hasPending(field) && !typingNow) {
      this.reset(field, text)
      return true
    }
    // Re-base our edits onto the leader's snapshot so the next publish carries
    // only the difference we still own.
    state.published = text
    return false
  }

  seenSnapshot(): Record<string, number> {
    return { ...this.seenByMe }
  }
}
