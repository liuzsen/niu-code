use std::{borrow::Cow, path::PathBuf};

use actix_web::{
    Responder, ResponseError, mime,
    web::{Json, Query},
};
use anyhow::Context;
use derive_more::{Display, From};
use serde::{Deserialize, Serialize};
use server::chat::{ChatManagerMessage, ReconnectSessionError, SessionInfo, get_manager_mailbox};
use server::resume::{self, ClaudeSession, LoadSessionOptions};
use server::work_dir::{self};
use tokio::sync::oneshot;

#[derive(Serialize)]
pub struct ApiOkResponse<T> {
    code: u32,
    data: T,
}

impl<T> ApiOkResponse<T> {
    pub fn new(data: T) -> Self {
        Self { code: 0, data }
    }
}

#[derive(Serialize)]
pub struct ApiErrorResponse {
    code: &'static str,
    tip: Option<Cow<'static, str>>,
}

#[derive(Display, Debug, From)]
pub enum ApiError {
    Anyhow(anyhow::Error),
    BizError(BizError),
}

#[derive(Display, Debug)]
#[display("{}: {:?}", "code", "tip")]
pub struct BizError {
    pub code: &'static str,
    pub tip: Option<Cow<'static, str>>,
}

impl BizError {
    const SESSION_NOT_FOUND: BizError = BizError {
        code: "session-not-found",
        tip: None,
    };

    const CHAT_NOT_FOUND: BizError = BizError {
        code: "chat-not-found",
        tip: None,
    };
}

impl ResponseError for ApiError {
    fn status_code(&self) -> actix_web::http::StatusCode {
        actix_web::http::StatusCode::INTERNAL_SERVER_ERROR
    }

    fn error_response(&self) -> actix_web::HttpResponse<actix_web::body::BoxBody> {
        let error = match self {
            ApiError::Anyhow(error) => ApiErrorResponse {
                code: "SYSTEM_ERROR",
                tip: Some(Cow::Owned(error.to_string())),
            },
            ApiError::BizError(biz_error) => ApiErrorResponse {
                code: biz_error.code,
                tip: biz_error.tip.clone(),
            },
        };
        let body = serde_json::to_string(&error).unwrap();

        let res = actix_web::HttpResponse::build(self.status_code())
            .content_type(mime::APPLICATION_JSON)
            .body(body);

        res
    }
}

impl<T> Responder for ApiOkResponse<T>
where
    T: Serialize,
{
    type Body = <Json<T> as Responder>::Body;

    fn respond_to(self, req: &actix_web::HttpRequest) -> actix_web::HttpResponse<Self::Body> {
        Responder::respond_to(Json(self), req)
    }
}

pub async fn load_sessions(
    options: Query<LoadSessionOptions>,
) -> Result<ApiOkResponse<Vec<ClaudeSession>>, ApiError> {
    let sessions = resume::load_sessions(options.0).await?;
    Ok(ApiOkResponse::new(sessions))
}

pub async fn home() -> Result<ApiOkResponse<String>, ApiError> {
    let home_path = work_dir::home().await?;
    Ok(ApiOkResponse::new(home_path.to_string_lossy().to_string()))
}

#[derive(Deserialize)]
pub struct LsParams {
    dir: PathBuf,
}

#[derive(Serialize)]
pub struct FileName(String);

pub async fn ls(path: Query<LsParams>) -> Result<ApiOkResponse<Vec<FileName>>, ApiError> {
    let entries = work_dir::ls(&path.dir).await?;
    let file_names: Vec<FileName> = entries.into_iter().map(FileName).collect();
    Ok(ApiOkResponse::new(file_names))
}

#[derive(Deserialize)]
pub struct GetSessionsParams {
    work_dir: PathBuf,
}

pub async fn load_active_sessions(
    params: Query<GetSessionsParams>,
) -> Result<ApiOkResponse<Vec<SessionInfo>>, ApiError> {
    let (tx, rx) = oneshot::channel();
    let manager_tx = get_manager_mailbox();

    manager_tx
        .send(ChatManagerMessage::GetSessionsByWorkDir {
            work_dir: params.work_dir.clone(),
            responder: tx,
        })
        .map_err(|e| anyhow::anyhow!("Failed to send message: {}", e))?;

    let sessions = rx
        .await
        .map_err(|e| anyhow::anyhow!("Failed to receive response: {}", e))?;

    Ok(ApiOkResponse::new(sessions))
}

#[derive(Deserialize)]
pub struct ReconnectSessionParams {
    cli_id: u32,
    chat_id: String,
}

impl From<ReconnectSessionError> for BizError {
    fn from(value: ReconnectSessionError) -> Self {
        match value {
            ReconnectSessionError::ChatNotFound => BizError::CHAT_NOT_FOUND,
            ReconnectSessionError::SessionNotFound => BizError::SESSION_NOT_FOUND,
        }
    }
}
pub async fn reconnect_session(
    params: Query<ReconnectSessionParams>,
) -> Result<ApiOkResponse<Vec<server::chat::MessageRecord>>, ApiError> {
    let (tx, rx) = oneshot::channel();
    let manager_tx = get_manager_mailbox();

    manager_tx
        .send(ChatManagerMessage::ReconnectSession {
            cli_id: params.cli_id,
            chat_id: params.chat_id.clone(),
            responder: tx,
        })
        .map_err(|e| anyhow::anyhow!("Failed to send message: {}", e))?;

    let messages = rx
        .await
        .context("no oneshot response")?
        .map_err(BizError::from)?;

    Ok(ApiOkResponse::new(messages))
}
