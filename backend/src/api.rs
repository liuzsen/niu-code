use std::{borrow::Cow, fmt::Display};

use actix_web::{
    Responder, ResponseError, mime,
    web::{self, Json, get, post},
};
use derive_more::{Display, From};
use serde::Serialize;

pub mod chat;
pub mod fs;
pub mod setting;

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.route("/api/fs/home", get().to(fs::home));
    cfg.route("/api/fs/ls", get().to(fs::ls));
    cfg.route("/api/connect", get().to(server::websocket::ws_handler));
    cfg.route("/api/chat/start", post().to(chat::start_chat));
    cfg.route("/api/session/list", get().to(chat::session_list));
    cfg.route("/api/setting", get().to(setting::get_setting));
    cfg.route("/api/setting", post().to(setting::update_setting));
}

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
    const CHAT_NOT_REGISTGERD: BizError = BizError {
        code: "chat/not-registerd",
        tip: None,
    };

    const CONFIG_NOT_FOUND: BizError = BizError {
        code: "chat/config-not-found",
        tip: None,
    };

    fn with_context<T: Display>(mut self, context: T) -> BizError {
        self.tip = match self.tip {
            Some(tip) => {
                let tip = format!("{}: {}", tip, context);
                Some(Cow::Owned(tip))
            }
            None => {
                let tip = format!("{}", context);
                Some(Cow::Owned(tip))
            }
        };

        self
    }
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
