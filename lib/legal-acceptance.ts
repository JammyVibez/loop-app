import "server-only"

import { authDbPool } from "@/lib/auth"
import { getLegalPublicationInfo } from "@/lib/legal-operator"

/**
 * Bump alongside the published documents in app/terms and app/privacy. These
 * mirror the constants in backend/src/routes/legal.rs so both runtimes record
 * the same versions.
 */
export const TERMS_VERSION = "1.2"
export const PRIVACY_VERSION = "1.2"

export type LegalAcceptanceStatus = {
  terms_version: string
  privacy_version: string
  terms_accepted: boolean
  privacy_acknowledged: boolean
  complete: boolean
  publication_ready: boolean
  missing_publication_fields: string[]
}

export async function readLegalAcceptance(authUserId: string): Promise<LegalAcceptanceStatus> {
  const { rows } = await authDbPool.query<{ document_key: string }>(
    `SELECT document_key
       FROM public.user_legal_acceptances
      WHERE auth_user_id = $1
        AND (
          (document_key = 'terms' AND document_version = $2)
          OR (document_key = 'privacy' AND document_version = $3)
        )`,
    [authUserId, TERMS_VERSION, PRIVACY_VERSION],
  )

  const publication = getLegalPublicationInfo()
  const termsAccepted = rows.some((row) => row.document_key === "terms")
  const privacyAcknowledged = rows.some((row) => row.document_key === "privacy")

  return {
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
    terms_accepted: termsAccepted,
    privacy_acknowledged: privacyAcknowledged,
    complete: termsAccepted && privacyAcknowledged,
    publication_ready: publication.publicationReady,
    missing_publication_fields: publication.missingFields.map(({ key }) => key),
  }
}

export async function recordLegalAcceptance(authUserId: string): Promise<void> {
  // Versions are assigned here, never chosen by the client, and the ledger is
  // append-only per (user, document, version).
  await authDbPool.query(
    `INSERT INTO public.user_legal_acceptances
       (auth_user_id, document_key, document_version, acceptance_source)
     VALUES ($1, 'terms', $2, 'web'), ($1, 'privacy', $3, 'web')
     ON CONFLICT (auth_user_id, document_key, document_version) DO NOTHING`,
    [authUserId, TERMS_VERSION, PRIVACY_VERSION],
  )
}
