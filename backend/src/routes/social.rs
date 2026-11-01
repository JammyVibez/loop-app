use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
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
pub struct FollowActionInput {
    action: String,
}

#[derive(Serialize)]
pub struct FollowStateResponse {
    is_following: bool,
    has_pending_follow_request: bool,
    is_private: bool,
    followers_count: i64,
    following_count: i64,
}

#[derive(Serialize)]
pub struct FollowActionResponse {
    success: bool,
    is_following: bool,
    requires_approval: bool,
    has_pending_follow_request: bool,
    followers_count: i64,
    following_count: i64,
}

pub async fn follow_state(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(target_id): Path<Uuid>,
) -> Result<Json<FollowStateResponse>, ApiError> {
    let row = sqlx::query(
        r#"
        SELECT
            profile.privacy_settings,
            profile.followers_count,
            profile.following_count,
            EXISTS (
                SELECT 1 FROM follows
                WHERE follower_id = $1 AND following_id = profile.id
            ) AS is_following,
            EXISTS (
                SELECT 1 FROM follow_requests
                WHERE requester_id = $1
                  AND target_id = profile.id
                  AND status = 'pending'
            ) AS has_pending_follow_request
        FROM profiles AS profile
        WHERE profile.id = $2
        "#,
    )
    .bind(user.id)
    .bind(target_id)
    .fetch_optional(&state.database)
    .await
    .map_err(|error| {
        tracing::error!(%error, "failed to load follow state");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "follow_state_failed",
            "Could not load follow state.",
        )
    })?;

    let Some(row) = row else {
        return Err(api_error(
            StatusCode::NOT_FOUND,
            "user_not_found",
            "This profile is unavailable.",
        ));
    };

    let privacy: Option<serde_json::Value> = row.try_get("privacy_settings").map_err(db_error)?;
    let visibility = privacy
        .as_ref()
        .and_then(|value| value.get("profile_visibility"))
        .and_then(serde_json::Value::as_str)
        .unwrap_or("public");

    Ok(Json(FollowStateResponse {
        is_following: row.try_get("is_following").map_err(db_error)?,
        has_pending_follow_request: row
            .try_get("has_pending_follow_request")
            .map_err(db_error)?,
        is_private: matches!(visibility, "private" | "followers"),
        followers_count: row.try_get("followers_count").map_err(db_error)?,
        following_count: row.try_get("following_count").map_err(db_error)?,
    }))
}

pub async fn follow(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(target_id): Path<Uuid>,
    Json(input): Json<FollowActionInput>,
) -> Result<Json<FollowActionResponse>, ApiError> {
    if target_id == user.id {
        return Err(api_error(
            StatusCode::BAD_REQUEST,
            "cannot_follow_self",
            "You cannot follow yourself.",
        ));
    }

    if !matches!(input.action.as_str(), "follow" | "unfollow") {
        return Err(api_error(
            StatusCode::UNPROCESSABLE_ENTITY,
            "invalid_follow_action",
            "Action must be follow or unfollow.",
        ));
    }

    let mut transaction = state.database.begin().await.map_err(|error| {
        tracing::error!(%error, "could not begin follow transaction");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "follow_transaction_failed",
            "Could not update this follow.",
        )
    })?;

    let target = sqlx::query(
        r#"
        SELECT username, display_name, privacy_settings
        FROM profiles
        WHERE id = $1
        FOR UPDATE
        "#,
    )
    .bind(target_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| {
        tracing::error!(%error, "could not load follow target");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "follow_target_failed",
            "Could not load this profile.",
        )
    })?;

    let Some(target) = target else {
        return Err(api_error(
            StatusCode::NOT_FOUND,
            "user_not_found",
            "This profile is unavailable.",
        ));
    };

    let username: String = target.try_get("username").map_err(db_error)?;
    let display_name: String = target.try_get("display_name").map_err(db_error)?;
    let privacy: Option<serde_json::Value> =
        target.try_get("privacy_settings").map_err(db_error)?;
    let visibility = privacy
        .as_ref()
        .and_then(|value| value.get("profile_visibility"))
        .and_then(serde_json::Value::as_str)
        .unwrap_or("public");
    let is_private = matches!(visibility, "private" | "followers");

    let is_blocked: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS (
            SELECT 1
            FROM user_blocks
            WHERE (blocker_id = $1 AND blocked_id = $2)
               OR (blocker_id = $2 AND blocked_id = $1)
        )
        "#,
    )
    .bind(user.id)
    .bind(target_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| {
        tracing::error!(%error, "could not check block relationship");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "block_check_failed",
            "Could not verify this relationship.",
        )
    })?;

    if is_blocked {
        return Err(api_error(
            StatusCode::FORBIDDEN,
            "relationship_blocked",
            "You cannot follow this user.",
        ));
    }

    if input.action == "unfollow" {
        let removed = sqlx::query_scalar::<_, Uuid>(
            "DELETE FROM follows WHERE follower_id = $1 AND following_id = $2 RETURNING id",
        )
        .bind(user.id)
        .bind(target_id)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| {
            tracing::error!(%error, "could not remove follow");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "unfollow_failed",
                "Could not unfollow this user.",
            )
        })?;

        if removed.is_some() {
            sqlx::query(
                "UPDATE profiles SET followers_count = GREATEST(0, followers_count - 1), updated_at = NOW() WHERE id = $1",
            )
            .bind(target_id)
            .execute(&mut *transaction)
            .await
            .map_err(db_error)?;

            sqlx::query(
                "UPDATE profiles SET following_count = GREATEST(0, following_count - 1), updated_at = NOW() WHERE id = $1",
            )
            .bind(user.id)
            .execute(&mut *transaction)
            .await
            .map_err(db_error)?;
        }

        // Recompute from the relationship table so duplicate retries and
        // historical counter drift cannot compound incorrect values.
        let (followers_count, following_count) =
            load_follow_counts(&mut transaction, user.id, target_id).await?;

        sqlx::query(
            r#"
            DELETE FROM follow_requests
            WHERE requester_id = $1 AND target_id = $2 AND status = 'pending'
            "#,
        )
        .bind(user.id)
        .bind(target_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| {
            tracing::error!(%error, "could not clear pending follow request");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "follow_request_clear_failed",
                "Could not update the follow request.",
            )
        })?;

        transaction.commit().await.map_err(|error| {
            tracing::error!(%error, "could not commit unfollow");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "unfollow_commit_failed",
                "Could not save this change.",
            )
        })?;

        return Ok(Json(FollowActionResponse {
            success: true,
            is_following: false,
            requires_approval: false,
            has_pending_follow_request: false,
            followers_count,
            following_count,
        }));
    }

    let already_following: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2)",
    )
    .bind(user.id)
    .bind(target_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(db_error)?;

    if already_following {
        let (followers_count, following_count) =
            load_follow_counts(&mut transaction, user.id, target_id).await?;
        transaction.commit().await.map_err(|error| {
            tracing::error!(%error, "could not commit idempotent follow");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "follow_commit_failed",
                "Could not save this change.",
            )
        })?;
        return Ok(Json(FollowActionResponse {
            success: true,
            is_following: true,
            requires_approval: false,
            has_pending_follow_request: false,
            followers_count,
            following_count,
        }));
    }

    if is_private {
        let requests_disabled = privacy.as_ref().is_some_and(|value| {
            value.get("allow_friend_requests") == Some(&serde_json::Value::Bool(false))
        });

        if requests_disabled {
            return Err(api_error(
                StatusCode::FORBIDDEN,
                "follow_requests_disabled",
                "This user is not accepting follow requests right now.",
            ));
        }

        let status: Option<String> = sqlx::query_scalar(
            "SELECT status FROM follow_requests WHERE requester_id = $1 AND target_id = $2",
        )
        .bind(user.id)
        .bind(target_id)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(db_error)?;

        if status.as_deref() == Some("pending") {
            let (followers_count, following_count) =
                load_follow_counts(&mut transaction, user.id, target_id).await?;
            transaction.commit().await.map_err(|error| {
                api_error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "follow_commit_failed",
                    "Could not save this change.",
                )
            })?;
            return Ok(Json(FollowActionResponse {
                success: true,
                is_following: false,
                requires_approval: true,
                has_pending_follow_request: true,
                followers_count,
                following_count,
            }));
        }

        let request_result = sqlx::query(
            r#"
            INSERT INTO follow_requests (requester_id, target_id, status)
            VALUES ($1, $2, 'pending')
            ON CONFLICT (requester_id, target_id)
            DO UPDATE SET status = 'pending', updated_at = NOW()
            WHERE follow_requests.status <> 'pending'
            "#,
        )
        .bind(user.id)
        .bind(target_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| {
            tracing::error!(%error, "could not create follow request");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "follow_request_failed",
                "Could not send this follow request.",
            )
        })?;

        if request_result.rows_affected() > 0 {
            insert_notification(
                &mut transaction,
                NotificationDraft {
                    recipient_id: target_id,
                    actor_id: user.id,
                    notification_type: "follow_request",
                    title: "New follow request",
                    message: &format!("{} requested to follow you", user.display_name),
                    data: serde_json::json!({
                        "requester_id": user.id,
                        "username": user.username,
                    }),
                    action_url: Some(&format!("/profile/{}", user.username)),
                },
            )
            .await?;
        }

        let (followers_count, following_count) =
            load_follow_counts(&mut transaction, user.id, target_id).await?;
        transaction.commit().await.map_err(|error| {
            tracing::error!(%error, "could not commit follow request");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "follow_request_commit_failed",
                "Could not save this request.",
            )
        })?;

        return Ok(Json(FollowActionResponse {
            success: true,
            is_following: false,
            requires_approval: true,
            has_pending_follow_request: true,
            followers_count,
            following_count,
        }));
    }

    // A public profile can be followed immediately. The unique relationship
    // constraint makes retries safe and the counters update only on insert.
    let inserted = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO follows (follower_id, following_id)
        VALUES ($1, $2)
        ON CONFLICT (follower_id, following_id) DO NOTHING
        RETURNING id
        "#,
    )
    .bind(user.id)
    .bind(target_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| {
        tracing::error!(%error, "could not create follow");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "follow_create_failed",
            "Could not follow this user.",
        )
    })?;

    if inserted.is_some() {
        sqlx::query(
            "UPDATE profiles SET followers_count = followers_count + 1, updated_at = NOW() WHERE id = $1",
        )
        .bind(target_id)
        .execute(&mut *transaction)
        .await
        .map_err(db_error)?;

        sqlx::query(
            "UPDATE profiles SET following_count = following_count + 1, updated_at = NOW() WHERE id = $1",
        )
        .bind(user.id)
        .execute(&mut *transaction)
        .await
        .map_err(db_error)?;

        insert_notification(
            &mut transaction,
            NotificationDraft {
                recipient_id: target_id,
                actor_id: user.id,
                notification_type: "follow",
                title: "New follower",
                message: &format!("{} started following you", user.display_name),
                data: serde_json::json!({
                    "follower_id": user.id,
                    "username": user.username,
                }),
                action_url: Some(&format!("/profile/{}", user.username)),
            },
        )
        .await?;
    }

    sqlx::query(
        r#"
        UPDATE follow_requests
        SET status = 'approved', updated_at = NOW()
        WHERE requester_id = $1 AND target_id = $2 AND status = 'pending'
        "#,
    )
    .bind(user.id)
    .bind(target_id)
    .execute(&mut *transaction)
    .await
    .map_err(db_error)?;

    let (followers_count, following_count) =
        load_follow_counts(&mut transaction, user.id, target_id).await?;
    transaction.commit().await.map_err(|error| {
        tracing::error!(%error, "could not commit follow");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "follow_commit_failed",
            "Could not save this change.",
        )
    })?;

    Ok(Json(FollowActionResponse {
        success: true,
        is_following: true,
        requires_approval: false,
        has_pending_follow_request: false,
        followers_count,
        following_count,
    }))
}

pub async fn withdraw_follow_request(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(target_id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let result = sqlx::query(
        r#"
        DELETE FROM follow_requests
        WHERE requester_id = $1 AND target_id = $2 AND status = 'pending'
        "#,
    )
    .bind(user.id)
    .bind(target_id)
    .execute(&state.database)
    .await
    .map_err(|error| {
        tracing::error!(%error, "could not withdraw follow request");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "follow_request_withdraw_failed",
            "Could not withdraw this request.",
        )
    })?;

    if result.rows_affected() == 0 {
        return Err(api_error(
            StatusCode::NOT_FOUND,
            "follow_request_not_found",
            "There is no pending request to withdraw.",
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}

async fn load_follow_counts(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
    target_id: Uuid,
) -> Result<(i64, i64), ApiError> {
    let row = sqlx::query(
        r#"
        SELECT
            (SELECT followers_count FROM profiles WHERE id = $1) AS followers_count,
            (SELECT following_count FROM profiles WHERE id = $2) AS following_count
        "#,
    )
    .bind(target_id)
    .bind(user_id)
    .fetch_one(&mut **transaction)
    .await
    .map_err(db_error)?;

    Ok((
        row.try_get("followers_count").map_err(db_error)?,
        row.try_get("following_count").map_err(db_error)?,
    ))
}

struct NotificationDraft<'a> {
    recipient_id: Uuid,
    actor_id: Uuid,
    notification_type: &'a str,
    title: &'a str,
    message: &'a str,
    data: serde_json::Value,
    action_url: Option<&'a str>,
}

async fn insert_notification(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    draft: NotificationDraft<'_>,
) -> Result<(), ApiError> {
    sqlx::query(
        r#"
        INSERT INTO notifications (user_id, actor_id, type, title, message, data, action_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(draft.recipient_id)
    .bind(draft.actor_id)
    .bind(draft.notification_type)
    .bind(draft.title)
    .bind(draft.message)
    .bind(draft.data)
    .bind(draft.action_url)
    .execute(&mut **transaction)
    .await
    .map_err(|error| {
        tracing::error!(%error, "could not insert social notification");
        api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "notification_insert_failed",
            "Could not create the notification.",
        )
    })?;

    Ok(())
}

fn db_error(error: sqlx::Error) -> ApiError {
    tracing::error!(%error, "social graph database operation failed");
    api_error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "social_graph_database_error",
        "Could not complete this social action.",
    )
}
