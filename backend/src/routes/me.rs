use axum::{extract::State, Json};
use serde::Serialize;

use crate::{auth::AuthenticatedUser, state::AppState};

#[derive(Serialize)]
pub struct MeResponse {
    id: String,
    username: String,
    display_name: String,
    avatar_url: Option<String>,
    is_verified: bool,
}

pub async fn get_me(
    _state: State<AppState>,
    user: AuthenticatedUser,
) -> Json<MeResponse> {
    Json(MeResponse {
        id: user.id.to_string(),
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        is_verified: user.is_verified,
    })
}
