import "server-only"

import { authDbPool } from "@/lib/auth"
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/ai/keys"
import { PROVIDERS, type ProviderId, isProviderId, providerLabel } from "@/lib/ai/providers"

export type ProviderRow = {
  provider: ProviderId
  label: string
  model: string
  api_key_cipher: string
  is_enabled: boolean
  last_checked_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export type SafeProvider = {
  provider: ProviderId
  label: string
  model: string
  enabled: boolean
  key_hint: string
  last_checked_at: string | null
  last_error: string | null
  updated_at: string
}

export async function readProviderRows(): Promise<ProviderRow[]> {
  try {
    const { rows } = await authDbPool.query<ProviderRow>(
      `SELECT provider, label, model, api_key_cipher, is_enabled, last_checked_at, last_error, created_at, updated_at
         FROM public.ai_providers
        ORDER BY created_at ASC`,
    )
    return rows.filter((row) => isProviderId(row.provider))
  } catch (error: any) {
    // Before the migration runs the table is absent; the panel shows "not
    // configured" rather than an error.
    if (error?.code === "42P01") return []
    throw error
  }
}

function toSafe(row: ProviderRow): SafeProvider {
  let hint = "••••"
  try {
    hint = maskSecret(decryptSecret(row.api_key_cipher))
  } catch {
    hint = "unreadable"
  }
  return {
    provider: row.provider,
    label: row.label || providerLabel(row.provider),
    model: row.model,
    enabled: row.is_enabled,
    key_hint: hint,
    last_checked_at: row.last_checked_at,
    last_error: row.last_error,
    updated_at: row.updated_at,
  }
}

export async function listSafeProviders(): Promise<SafeProvider[]> {
  return (await readProviderRows()).map(toSafe)
}

export async function saveProvider(input: {
  provider: ProviderId
  model: string
  apiKey?: string
  enabled?: boolean
}): Promise<void> {
  const label = providerLabel(input.provider)
  const model = input.model.trim() || PROVIDERS.find((p) => p.id === input.provider)!.defaultModel

  if (input.apiKey && input.apiKey.trim()) {
    await authDbPool.query(
      `INSERT INTO public.ai_providers (provider, label, model, api_key_cipher, is_enabled, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (provider) DO UPDATE
         SET label = EXCLUDED.label,
             model = EXCLUDED.model,
             api_key_cipher = EXCLUDED.api_key_cipher,
             is_enabled = EXCLUDED.is_enabled,
             last_error = NULL,
             updated_at = now()`,
      [input.provider, label, model, encryptSecret(input.apiKey.trim()), input.enabled ?? true],
    )
    return
  }

  // Model/toggle change without re-entering the key.
  await authDbPool.query(
    `UPDATE public.ai_providers
        SET label = $2, model = $3, is_enabled = COALESCE($4, is_enabled), updated_at = now()
      WHERE provider = $1`,
    [input.provider, label, model, input.enabled ?? null],
  )
}

export async function removeProvider(provider: ProviderId): Promise<void> {
  await authDbPool.query("DELETE FROM public.ai_providers WHERE provider = $1", [provider])
}

export async function recordProviderCheck(provider: ProviderId, error: string | null): Promise<void> {
  await authDbPool.query(
    `UPDATE public.ai_providers
        SET last_checked_at = now(), last_error = $2, updated_at = now()
      WHERE provider = $1`,
    [provider, error],
  )
}

export async function getActiveProvider(): Promise<{ provider: ProviderId; model: string; apiKey: string } | null> {
  const rows = await readProviderRows()
  const row = rows.find((candidate) => candidate.is_enabled)
  if (!row) return null
  return { provider: row.provider, model: row.model, apiKey: decryptSecret(row.api_key_cipher) }
}
