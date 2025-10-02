use std::path::PathBuf;

use actix_web::web::Query;
use serde::{Deserialize, Serialize};
use server::work_dir;

use crate::api::{ApiError, ApiOkResponse};

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
