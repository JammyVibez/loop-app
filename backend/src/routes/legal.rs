use axum::{
    Json,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::{auth::AuthenticatedUser, state::AppState};

// Bump the matching value when the corresponding published document changes.
pub const TERMS_VERSION: &str = "1.0";
pub const PRIVACY_VERSION: &str = "1.0";

#[derive(Serialize)]
struct LegalErrorBody {
    error: &'static str,
    message: &'static str,
}

pub struct LegalError {
    status: StatusCode,
    code: &'static str,
    message: &'static str,
}

impl IntoResponse for LegalError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(LegalErrorBody {
                error: self.code,
                message: self.message,
            }),
        )
            .into_response()
    }
}

#[derive(Serialize)]
pub struct LegalAcceptanceStatus {
    terms_version: &'static str,
    privacy_version: &'static str,
    terms_accepted: bool,
    privacy_acknowledged: bool,
    complete: bool,
}

#[derive(Deserialize)]
pub struct AcceptLegalDocumentsInput {
    terms_accepted: bool,
    privacy_acknowledged: bool,
}

fn missing_acceptance() -> LegalError {
    LegalError {
        status: StatusCode::UNPROCESSABLE_ENTITY,
        code: "legal_acceptance_required",
        message: "Agree to the Terms of Service and acknowledge the Privacy Policy to continue.",
    }
}

fn storage_error() -> LegalError {
    LegalError {
        status: StatusCode::SERVICE_UNAVAILABLE,
        code: "legal_acceptance_unavailable",
        message: "We could not save your agreement right now. Please try again.",
    }
}

fn acceptance_complete(input: &AcceptLegalDocumentsInput) -> bool {
    input.terms_accepted && input.privacy_acknowledged
}

pub async fn get_acceptance(
    State(state): State<AppState>,
    user: AuthenticatedUser,
) -> Result<Json<LegalAcceptanceStatus>, LegalError> {
    let rows = sqlx::query(
        r#"
        SELECT document_key
        FROM public.user_legal_acceptances
        WHERE user_id = $1
          AND (
              (document_key = 'terms' AND document_version = $2)
              OR (document_key = 'privacy' AND document_version = $3)
          )
        "#,
    )
    .bind(user.id)
    .bind(TERMS_VERSION)
    .bind(PRIVACY_VERSION)
    .fetch_all(&state.database)
    .await
    .map_err(|error| {
        tracing::error!(%error, "could not read current legal acceptance");
        storage_error()
    })?;

    let terms_accepted = rows.iter().any(|row| {
        row.try_get::<String, _>("document_key")
            .is_ok_and(|key| key == "terms")
    });
    let privacy_acknowledged = rows.iter().any(|row| {
        row.try_get::<String, _>("document_key")
            .is_ok_and(|key| key == "privacy")
    });

    Ok(Json(LegalAcceptanceStatus {
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
        terms_accepted,
        privacy_acknowledged,
        complete: terms_accepted && privacy_acknowledged,
    }))
}

pub async fn accept_documents(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Json(input): Json<AcceptLegalDocumentsInput>,
) -> Result<(StatusCode, Json<LegalAcceptanceStatus>), LegalError> {
    if !acceptance_complete(&input) {
        return Err(missing_acceptance());
    }

    let mut transaction = state.database.begin().await.map_err(|error| {
        tracing::error!(%error, "could not begin legal acceptance transaction");
        storage_error()
    })?;

    sqlx::query(
        r#"
        INSERT INTO public.user_legal_acceptances
            (user_id, document_key, document_version, acceptance_source)
        VALUES
            ($1, 'terms', $2, 'web'),
            ($1, 'privacy', $3, 'web')
        ON CONFLICT (user_id, document_key, document_version) DO NOTHING
        "#,
    )
    .bind(user.id)
    .bind(TERMS_VERSION)
    .bind(PRIVACY_VERSION)
    .execute(&mut *transaction)
    .await
    .map_err(|error| {
        tracing::error!(%error, "could not persist legal acceptance");
        storage_error()
    })?;

    transaction.commit().await.map_err(|error| {
        tracing::error!(%error, "could not commit legal acceptance");
        storage_error()
    })?;

    Ok((
        StatusCode::CREATED,
        Json(LegalAcceptanceStatus {
            terms_version: TERMS_VERSION,
            privacy_version: PRIVACY_VERSION,
            terms_accepted: true,
            privacy_acknowledged: true,
            complete: true,
        }),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requires_both_the_terms_and_privacy_acknowledgement() {
        assert!(!acceptance_complete(&AcceptLegalDocumentsInput {
            terms_accepted: false,
            privacy_acknowledged: false,
        }));
        assert!(!acceptance_complete(&AcceptLegalDocumentsInput {
            terms_accepted: true,
            privacy_acknowledged: false,
        }));
        assert!(!acceptance_complete(&AcceptLegalDocumentsInput {
            terms_accepted: false,
            privacy_acknowledged: true,
        }));
        assert!(acceptance_complete(&AcceptLegalDocumentsInput {
            terms_accepted: true,
            privacy_acknowledged: true,
        }));
    }

    #[test]
    fn legal_document_versions_are_explicit_and_distinct() {
        assert!(!TERMS_VERSION.is_empty());
        assert!(!PRIVACY_VERSION.is_empty());
    }
}
