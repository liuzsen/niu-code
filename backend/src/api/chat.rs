use std::path::PathBuf;

use actix_web::web::{Json, Query};
use serde::{Deserialize, Serialize};
use server::chat::{ChatManagerHandle, MessageRecord, StartChatError, StartChatOptions};
use server::message::ClaudeSystemInfo;
use server::resume::{self};
use tracing::debug;

use crate::api::{ApiError, ApiOkResponse, BizError};

#[derive(Deserialize)]
pub struct LoadSessionInfoOptions {
    work_dir: PathBuf,
}

#[derive(Serialize)]
pub struct UnifiedSessionInfo {
    pub session_id: String,
    pub last_user_input: String,
    pub last_activity: String, // Use String instead of DateTime<Utc>
    pub is_active: bool,
}

pub async fn session_list(
    options: Query<LoadSessionInfoOptions>,
) -> Result<ApiOkResponse<Vec<UnifiedSessionInfo>>, ApiError> {
    // 1. Load from file
    let file_sessions = resume::load_session_infos(&options.work_dir).await?;

    // 2. Load active sessions
    let handle = ChatManagerHandle::new();
    let active_sessions = handle.active_session_list(options.work_dir.clone()).await;

    // 3. Merge lists
    let mut sessions = vec![];
    for file_session in file_sessions {
        let is_active = active_sessions
            .iter()
            .any(|s| s.session_id == file_session.session_id);

        sessions.push(UnifiedSessionInfo {
            session_id: file_session.session_id,
            last_user_input: file_session.last_user_input,
            last_activity: file_session.last_active.to_rfc3339(),
            is_active,
        });
    }

    Ok(ApiOkResponse::new(sessions))
}

pub async fn start_chat(
    options: Json<StartChatOptions>,
) -> Result<ApiOkResponse<Vec<MessageRecord>>, ApiError> {
    let handle = ChatManagerHandle::new();
    let messages = handle.start_chat(options.into_inner()).await?;
    let messages = messages.map_err(BizError::from)?;
    debug!("chat started");
    Ok(ApiOkResponse::new(messages))
}

impl From<StartChatError> for BizError {
    fn from(value: StartChatError) -> Self {
        match value {
            StartChatError::ChatNotRegistered => BizError::CHAT_NOT_REGISTGERD,
            StartChatError::ConfigNotFound(v) => BizError::CONFIG_NOT_FOUND.with_context(v),
        }
    }
}

pub async fn get_claude_info(
    options: Query<LoadSessionInfoOptions>,
) -> Result<ApiOkResponse<ClaudeSystemInfo>, ApiError> {
    let handle = ChatManagerHandle::new();
    let info = handle.get_claude_info(options.work_dir.clone()).await?;
    Ok(ApiOkResponse::new(info))
}
