use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row, postgres::PgRow};
use uuid::Uuid;

use crate::{auth::AuthenticatedUser, state::AppState};

#[derive(Serialize)]
struct ApiErrorBody {
    error: &'static str,
    message: String,
}

pub struct ApiError {
    status: StatusCode,
    body: ApiErrorBody,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(self.body)).into_response()
    }
}

fn api_error(status: StatusCode, error: &'static str, message: impl Into<String>) -> ApiError {
    ApiError {
        status,
        body: ApiErrorBody {
            error,
            message: message.into(),
        },
    }
}

#[derive(Deserialize)]
pub struct ListDropsQuery {
    limit: Option<i64>,
    kind: Option<String>,
    category: Option<String>,
}

#[derive(Serialize)]
pub struct DropItem {
    id: String,
    kind: &'static str,
    source: &'static str,
    title: String,
    description: String,
    category: String,
    starts_at: Option<DateTime<Utc>>,
    ends_at: Option<DateTime<Utc>>,
    status: &'static str,
    is_live: bool,
    image_url: Option<String>,
    participants_count: i64,
    reward_coins: i64,
    circle_id: Option<String>,
    circle_name: Option<String>,
    action_url: String,
    created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct DropsResponse {
    success: bool,
    items: Vec<DropItem>,
    total: usize,
    live_count: usize,
    challenge_count: usize,
    event_count: usize,
}

pub async fn list(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Query(query): Query<ListDropsQuery>,
) -> Result<Json<DropsResponse>, ApiError> {
    let limit = query.limit.unwrap_or(30).clamp(1, 75);
    let kind_filter = query
        .kind
        .as_deref()
        .filter(|value| !value.trim().is_empty());
    let category_filter = query
        .category
        .as_deref()
        .filter(|value| !value.trim().is_empty());

    let circle_ids = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT circle_id
        FROM circle_members
        WHERE user_id = $1
          AND status IN ('active', 'approved')
        "#,
    )
    .bind(user.id)
    .fetch_all(&state.database)
    .await
    .map_err(|error| {
        tracing::error!(%error, "failed to load joined Circles for Drops");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "drops_membership_failed",
            "Could not load your Circle activity.",
        )
    })?;

    let mut items = Vec::new();
    let per_source_limit = limit.clamp(1, 50);

    append_rows(
        &mut items,
        load_global_events(&state.database, per_source_limit).await?,
        "event",
        "official_event",
    )?;

    append_rows(
        &mut items,
        load_hosted_events(&state.database, user.id, per_source_limit).await?,
        "event",
        "hosted_event",
    )?;

    if !circle_ids.is_empty() {
        append_rows(
            &mut items,
            load_circle_events(&state.database, &circle_ids, per_source_limit).await?,
            "event",
            "circle_event",
        )?;

        append_rows(
            &mut items,
            load_circle_challenges(&state.database, &circle_ids, per_source_limit).await?,
            "challenge",
            "circle_challenge",
        )?;
    }

    if let Some(kind) = kind_filter {
        if !matches!(kind, "event" | "challenge") {
            return Err(api_error(
                StatusCode::BAD_REQUEST,
                "invalid_drop_kind",
                "Kind must be event or challenge.",
            ));
        }
        items.retain(|item| item.kind == kind);
    }

    if let Some(category) = category_filter {
        let normalized = category.trim().to_lowercase();
        if normalized != "all" {
            items.retain(|item| item.category.to_lowercase() == normalized);
        }
    }

    items.sort_by(|left, right| {
        let left_live = left.is_live;
        let right_live = right.is_live;
        right_live
            .cmp(&left_live)
            .then_with(|| left.starts_at.cmp(&right.starts_at))
            .then_with(|| right.created_at.cmp(&left.created_at))
    });
    items.truncate(limit as usize);

    let live_count = items.iter().filter(|item| item.is_live).count();
    let challenge_count = items.iter().filter(|item| item.kind == "challenge").count();
    let event_count = items.len().saturating_sub(challenge_count);

    Ok(Json(DropsResponse {
        success: true,
        total: items.len(),
        items,
        live_count,
        challenge_count,
        event_count,
    }))
}

async fn load_global_events(pool: &PgPool, limit: i64) -> Result<Vec<PgRow>, ApiError> {
    sqlx::query(
        r#"
        SELECT
            id::text AS id,
            title,
            COALESCE(description, '') AS description,
            COALESCE(category, 'Community') AS category,
            starts_at,
            ends_at,
            status,
            is_live,
            banner_url AS image_url,
            COALESCE(rsvp_count, 0)::bigint AS participants_count,
            COALESCE(reward_coins, 0)::bigint AS reward_coins,
            NULL::text AS circle_id,
            NULL::text AS circle_name,
            created_at
        FROM global_events
        WHERE is_active = true
          AND (is_live = true OR ends_at IS NULL OR ends_at >= NOW())
        ORDER BY is_live DESC, starts_at ASC
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|error| {
        tracing::error!(%error, "failed to load official Drops");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "drops_global_events_failed",
            "Could not load official events.",
        )
    })
}

async fn load_hosted_events(
    pool: &PgPool,
    user_id: Uuid,
    limit: i64,
) -> Result<Vec<PgRow>, ApiError> {
    sqlx::query(
        r#"
        SELECT
            event.id::text AS id,
            event.title,
            COALESCE(event.description, '') AS description,
            COALESCE(event.category, 'General') AS category,
            event.start_time AS starts_at,
            event.end_time AS ends_at,
            COALESCE(event.status, 'upcoming') AS status,
            COALESCE(event.is_live, false) AS is_live,
            event.cover_image AS image_url,
            COALESCE(event.participants_count, 0)::bigint AS participants_count,
            0::bigint AS reward_coins,
            event.circle_id::text AS circle_id,
            circle.name AS circle_name,
            event.created_at
        FROM events AS event
        LEFT JOIN circles AS circle ON circle.id = event.circle_id
        WHERE (event.circle_id IS NULL OR EXISTS (
            SELECT 1
            FROM circle_members AS member
            WHERE member.circle_id = event.circle_id
              AND member.user_id = $1
              AND member.status IN ('active', 'approved')
        ))
          AND (event.is_live = true OR event.end_time IS NULL OR event.end_time >= NOW())
        ORDER BY event.is_live DESC, event.start_time ASC
        LIMIT $2
        "#,
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|error| {
        tracing::error!(%error, "failed to load hosted Drops");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "drops_hosted_events_failed",
            "Could not load hosted events.",
        )
    })
}

async fn load_circle_events(
    pool: &PgPool,
    circle_ids: &[Uuid],
    limit: i64,
) -> Result<Vec<PgRow>, ApiError> {
    sqlx::query(
        r#"
        SELECT
            event.id::text AS id,
            event.title,
            COALESCE(event.description, '') AS description,
            COALESCE(event.event_type, 'Circle event') AS category,
            event.starts_at,
            event.ends_at,
            CASE
                WHEN event.starts_at <= NOW()
                 AND (event.ends_at IS NULL OR event.ends_at >= NOW()) THEN 'live'
                ELSE 'upcoming'
            END AS status,
            (
                event.starts_at <= NOW()
                AND (event.ends_at IS NULL OR event.ends_at >= NOW())
            ) AS is_live,
            NULL::text AS image_url,
            COALESCE(event.participant_count, 0)::bigint AS participants_count,
            0::bigint AS reward_coins,
            event.circle_id::text AS circle_id,
            circle.name AS circle_name,
            event.created_at
        FROM circle_events AS event
        JOIN circles AS circle ON circle.id = event.circle_id
        WHERE event.circle_id = ANY($1)
          AND (event.ends_at IS NULL OR event.ends_at >= NOW())
        ORDER BY is_live DESC, event.starts_at ASC
        LIMIT $2
        "#,
    )
    .bind(circle_ids)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|error| {
        tracing::error!(%error, "failed to load Circle event Drops");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "drops_circle_events_failed",
            "Could not load Circle events.",
        )
    })
}

async fn load_circle_challenges(
    pool: &PgPool,
    circle_ids: &[Uuid],
    limit: i64,
) -> Result<Vec<PgRow>, ApiError> {
    sqlx::query(
        r#"
        SELECT
            challenge.id::text AS id,
            challenge.title,
            COALESCE(challenge.description, '') AS description,
            COALESCE(challenge.challenge_type, 'Creative') AS category,
            challenge.starts_at,
            challenge.ends_at,
            challenge.status,
            false AS is_live,
            NULL::text AS image_url,
            (
                SELECT COUNT(*)::bigint
                FROM community_challenge_entries AS entry
                WHERE entry.challenge_id = challenge.id
            ) AS participants_count,
            COALESCE(challenge.reward_coins, 0)::bigint AS reward_coins,
            challenge.circle_id::text AS circle_id,
            circle.name AS circle_name,
            challenge.created_at
        FROM circle_challenges AS challenge
        JOIN circles AS circle ON circle.id = challenge.circle_id
        WHERE challenge.circle_id = ANY($1)
          AND challenge.status = 'active'
          AND (challenge.ends_at IS NULL OR challenge.ends_at >= NOW())
        ORDER BY challenge.starts_at ASC, challenge.created_at DESC
        LIMIT $2
        "#,
    )
    .bind(circle_ids)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|error| {
        tracing::error!(%error, "failed to load Circle challenge Drops");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "drops_circle_challenges_failed",
            "Could not load Circle challenges.",
        )
    })
}

fn append_rows(
    items: &mut Vec<DropItem>,
    rows: Vec<PgRow>,
    kind: &'static str,
    source: &'static str,
) -> Result<(), ApiError> {
    for row in rows {
        let id: String = row.try_get("id").map_err(db_error)?;
        let circle_id: Option<String> = row.try_get("circle_id").map_err(db_error)?;
        let starts_at: Option<DateTime<Utc>> = row.try_get("starts_at").map_err(db_error)?;
        let ends_at: Option<DateTime<Utc>> = row.try_get("ends_at").map_err(db_error)?;
        let is_live: bool = row.try_get("is_live").map_err(db_error)?;
        let status: String = row.try_get("status").map_err(db_error)?;
        let action_url = match (source, circle_id.as_deref()) {
            ("circle_challenge", Some(circle_id)) => {
                format!("/communities/{circle_id}?tab=challenges")
            }
            ("circle_event", Some(circle_id)) => format!("/communities/{circle_id}?tab=events"),
            ("hosted_event", Some(circle_id)) => format!("/communities/{circle_id}?tab=events"),
            _ => "/events".to_owned(),
        };

        let normalized_status = if is_live {
            "live"
        } else if status == "ended" {
            "ended"
        } else {
            "upcoming"
        };

        items.push(DropItem {
            id,
            kind,
            source,
            title: row.try_get("title").map_err(db_error)?,
            description: row.try_get("description").map_err(db_error)?,
            category: row.try_get("category").map_err(db_error)?,
            starts_at,
            ends_at,
            status: normalized_status,
            is_live,
            image_url: row.try_get("image_url").map_err(db_error)?,
            participants_count: row.try_get("participants_count").map_err(db_error)?,
            reward_coins: row.try_get("reward_coins").map_err(db_error)?,
            circle_name: row.try_get("circle_name").map_err(db_error)?,
            circle_id,
            action_url,
            created_at: row.try_get("created_at").map_err(db_error)?,
        });
    }

    Ok(())
}

fn db_error(error: sqlx::Error) -> ApiError {
    tracing::error!(%error, "Drops database operation failed");
    api_error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "drops_database_error",
        "Could not load activity.",
    )
}

#[cfg(test)]
mod tests {
    #[test]
    fn drop_kinds_are_limited_to_events_and_challenges() {
        assert!(matches!("event", "event" | "challenge"));
        assert!(matches!("challenge", "event" | "challenge"));
        assert!(!matches!("quest", "event" | "challenge"));
    }
}
