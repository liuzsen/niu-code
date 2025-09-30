use std::path::PathBuf;

use actix_web::{
    Responder, ResponseError, mime,
    web::{Json, Query},
};
use derive_more::{Display, From};
use serde::{Deserialize, Serialize};
use server::resume::{self, ClaudeSession, LoadSessionOptions};
use server::work_dir::{self};

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
    code: u32,
    error: String,
}

#[derive(Display, Debug, From)]
pub enum ApiError {
    Anyhow(anyhow::Error),
}

impl ResponseError for ApiError {
    fn status_code(&self) -> actix_web::http::StatusCode {
        actix_web::http::StatusCode::INTERNAL_SERVER_ERROR
    }

    fn error_response(&self) -> actix_web::HttpResponse<actix_web::body::BoxBody> {
        let error = match self {
            ApiError::Anyhow(error) => format!("{:?}", error),
        };
        let resp = ApiErrorResponse { code: 1, error };
        let body = serde_json::to_string(&resp).unwrap();

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
