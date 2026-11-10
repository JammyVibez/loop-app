"use client"

/**
 * Backwards-compatible entry point. Receiving gifts is now a persisted,
 * one-at-a-time action queue rather than a transient toast stack.
 */
export { GiftReceivingSystem, GiftReceivingSystem as GiftNotificationSystem } from "./gift-receiving"
