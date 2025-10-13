use std::{borrow::Cow, fmt::Display};

use actix_web::{
    Responder, ResponseError, mime,
    web::{self, Json, get, post},
};
use derive_more::{Display, From};
use serde::Serialize;

pub mod chat;
pub mod fs;
pub mod prompt;
pub mod setting;

pub fn config(cfg: &mut web::ServiceConfig) {
    // API routes
    cfg.route("/api/fs/home", get().to(fs::home));
    cfg.route("/api/fs/ls", get().to(fs::ls));
    cfg.route("/api/fs/files", get().to(fs::get_workspace_files));
    cfg.route("/api/fs/updates", get().to(fs::sse_handler));
    cfg.route("/api/connect", get().to(server::websocket::ws_handler));
    cfg.route("/api/chat/start", post().to(chat::start_chat));
    cfg.route("/api/chat/prompts", get().to(prompt::sse_handler));
    cfg.route("/api/claude/info", get().to(chat::get_claude_info));
    cfg.route("/api/session/list", get().to(chat::session_list));
    cfg.route("/api/setting", get().to(setting::get_setting));
    cfg.route("/api/setting", post().to(setting::update_setting));

    // Static file routes (must be last to act as catch-all)
    cfg.route("/", get().to(crate::embedded::serve_index));
    cfg.route("/{filename:.*}", get().to(crate::embedded::serve_static));
}

#[derive(Serialize)]
pub struct ApiOkResponse<T> {
    code: Ok,
    data: T,
}

pub struct Ok;

impl Serialize for Ok {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str("ok")
    }
}

impl<T> ApiOkResponse<T> {
    pub fn new(data: T) -> Self {
        Self { code: Ok, data }
    }
}

#[derive(Serialize)]
pub struct ApiErrorResponse {
    code: &'static str,
    err: Option<Cow<'static, str>>,
}

#[derive(Display, Debug, From)]
pub enum ApiError {
    Anyhow(anyhow::Error),
    BizError(BizError),
}

#[derive(Display, Debug)]
#[display("{}: {:?}", "code", "err")]
pub struct BizError {
    pub code: &'static str,
    pub err: Option<Cow<'static, str>>,
}

impl BizError {
    const CHAT_NOT_REGISTGERD: BizError = BizError {
        code: "chat/not-registerd",
        err: None,
    };

    const CONFIG_NOT_FOUND: BizError = BizError {
        code: "chat/config-not-found",
        err: None,
    };

    fn with_context<T: Display>(mut self, context: T) -> BizError {
        self.err = match self.err {
            Some(err) => {
                let err = format!("{}: {}", err, context);
                Some(Cow::Owned(err))
            }
            None => {
                let err = format!("{}", context);
                Some(Cow::Owned(err))
            }
        };

        self
    }
}

impl ResponseError for ApiError {
    fn status_code(&self) -> actix_web::http::StatusCode {
        match self {
            ApiError::Anyhow(..) => actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::BizError(..) => actix_web::http::StatusCode::BAD_REQUEST,
        }
    }

    fn error_response(&self) -> actix_web::HttpResponse<actix_web::body::BoxBody> {
        let error = match self {
            ApiError::Anyhow(error) => ApiErrorResponse {
                code: "SYSTEM_ERROR",
                err: Some(Cow::Owned(error.to_string())),
            },
            ApiError::BizError(biz_error) => ApiErrorResponse {
                code: biz_error.code,
                err: biz_error.err.clone(),
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
