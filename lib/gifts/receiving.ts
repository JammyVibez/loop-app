/**
 * Normalisation for the receiving-gift queue.
 *
 * Gift broadcasts, pending-gift fetches and notification payloads all describe
 * the same gift with slightly different field names. Keeping the mapping pure
 * means duplicates, anonymous senders and reconnect fetches cannot produce
 * competing overlays or leak a sender who chose to stay anonymous.
 */

export type ReceivingGiftSender = {
  id: string
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
}

export type ReceivingGift = {
  id: string
  name: string
  type: string
  rarity: string
  art?: string | null
  palette?: { primary: string; secondary: string; accent?: string } | null
  effects?: Record<string, any> | null
  message?: string | null
  anonymous: boolean
  sender: ReceivingGiftSender | null
  createdAt: string
  cost?: number | null
  durationMs?: number | null
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/**
 * Read a gift from a broadcast, a `/api/gifts/manage` row, or a notification
 * payload. Returns null when there is no stable gift id/name to render.
 */
export function normalizeReceivingGift(
  input: unknown,
  viewerId?: string | null,
): ReceivingGift | null {
  const raw = asRecord(input)
  const nestedGift = asRecord(raw.gift)
  const value = asRecord(raw.gift_value)
  const valueEffects = asRecord(value.effects)
  const rawEffects = asRecord(raw.effects)
  const effects = Object.keys(rawEffects).length ? rawEffects : valueEffects

  const id = stringOrNull(raw.id) || stringOrNull(raw.gift_id) || stringOrNull(nestedGift.id)
  const name =
    stringOrNull(raw.gift_name) ||
    stringOrNull(raw.name) ||
    stringOrNull(nestedGift.name)
  if (!id || !name) return null

  const rawSender = asRecord(raw.sender)
  const senderId =
    stringOrNull(rawSender.id) ||
    stringOrNull(raw.sender_id) ||
    stringOrNull(value.sender_id)
  if (viewerId && senderId === viewerId) return null

  const anonymous =
    raw.is_anonymous === true ||
    value.is_anonymous === true ||
    nestedGift.is_anonymous === true ||
    !senderId

  const sender: ReceivingGiftSender | null = anonymous || !senderId
    ? null
    : {
        id: senderId,
        username:
          stringOrNull(rawSender.username) ||
          stringOrNull(raw.sender_username),
        display_name:
          stringOrNull(rawSender.display_name) ||
          stringOrNull(raw.sender_name),
        avatar_url: stringOrNull(rawSender.avatar_url),
      }

  const paletteCandidate = asRecord(raw.palette)
  const valuePalette = asRecord(value.palette)
  const effectsPalette = asRecord(effects.palette)
  const paletteSource = Object.keys(paletteCandidate).length
    ? paletteCandidate
    : Object.keys(valuePalette).length
      ? valuePalette
      : effectsPalette

  const palette =
    typeof paletteSource.primary === "string" && typeof paletteSource.secondary === "string"
      ? {
          primary: paletteSource.primary,
          secondary: paletteSource.secondary,
          ...(typeof paletteSource.accent === "string"
            ? { accent: paletteSource.accent }
            : {}),
        }
      : null

  const createdAt =
    stringOrNull(raw.created_at) ||
    stringOrNull(raw.createdAt) ||
    stringOrNull(raw.timestamp) ||
    new Date().toISOString()

  return {
    id,
    name,
    type:
      stringOrNull(raw.gift_type) ||
      stringOrNull(raw.type) ||
      stringOrNull(nestedGift.type) ||
      stringOrNull(value.item_type) ||
      "badge",
    rarity:
      stringOrNull(raw.rarity) ||
      stringOrNull(raw.gift_rarity) ||
      stringOrNull(nestedGift.rarity) ||
      stringOrNull(value.rarity) ||
      "common",
    art:
      stringOrNull(raw.art) ||
      stringOrNull(raw.gift_art) ||
      stringOrNull(nestedGift.art) ||
      stringOrNull(value.art) ||
      stringOrNull(effects.art),
    palette,
    effects,
    message: stringOrNull(raw.message) || stringOrNull(value.message),
    anonymous,
    sender,
    createdAt,
    cost: Number.isFinite(Number(raw.cost)) ? Number(raw.cost) : null,
    durationMs:
      Number.isFinite(Number(raw.duration_ms))
        ? Number(raw.duration_ms)
        : Number.isFinite(Number(value.duration_ms))
          ? Number(value.duration_ms)
          : null,
  }
}

/**
 * Merge a fetched or broadcast gift into the visible queue. Existing order is
 * preserved, duplicate ids are ignored, and new gifts are appended oldest
 * first so multiple people gifting at once keep a predictable sequence.
 */
export function mergeReceivingGifts(
  queue: ReceivingGift[],
  incoming: Array<ReceivingGift | null | undefined>,
  ignoredIds?: ReadonlySet<string>,
): ReceivingGift[] {
  const known = new Set(queue.map((gift) => gift.id))
  const additions: ReceivingGift[] = []

  for (const gift of incoming) {
    if (!gift || known.has(gift.id) || ignoredIds?.has(gift.id)) continue
    known.add(gift.id)
    additions.push(gift)
  }

  if (!additions.length) return queue
  additions.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  return [...queue, ...additions]
}

export function giftSenderLabel(gift: ReceivingGift): string {
  if (gift.anonymous || !gift.sender) return "A secret admirer"
  return gift.sender.display_name || gift.sender.username || "Someone"
}
