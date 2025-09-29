use actix_web::{Responder, ResponseError, mime, web::Json};
use derive_more::{Display, From};
use serde::Serialize;
use server::resume::{self, ClaudeSession, LoadSessionOptions};

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
    options: Json<LoadSessionOptions>,
) -> Result<ApiOkResponse<Vec<ClaudeSession>>, ApiError> {
    let sessions = resume::load_sessions(options.0).await?;
    Ok(ApiOkResponse::new(sessions))
}
