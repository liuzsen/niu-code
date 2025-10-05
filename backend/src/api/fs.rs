use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;

use actix_web::web::Bytes;
use actix_web::web::Query;
use actix_web::{Error, HttpResponse, web};
use anyhow::Context;
use serde::{Deserialize, Serialize};
use server::work_dir;
use server::work_dir::{FileChange, FileChangeNotifier, add_file_change_notifier};
use tokio::sync::mpsc::{UnboundedSender, unbounded_channel};
use tokio_stream::StreamExt;
use tracing::{debug, error, info};

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

#[derive(Deserialize)]
pub struct WorkspaceFilesParams {
    work_dir: PathBuf,
}

// 获取工作目录下的所有文件列表
pub async fn get_workspace_files(
    path: Query<WorkspaceFilesParams>,
) -> Result<ApiOkResponse<Vec<PathBuf>>, ApiError> {
    let files = tokio::task::spawn_blocking(move || {
        work_dir::scan_workspace_files_realtime(&path.work_dir)
            .map_err(|e| ApiError::Anyhow(anyhow::anyhow!("Failed to get workspace files: {}", e)))
    })
    .await
    .context("tokio spawn_blocking failed to get workspace files")??;

    Ok(ApiOkResponse::new(files))
}

// 文件变动事件类型
#[derive(Serialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum FileChangeEvent {
    FileCreated { work_dir: PathBuf, file: PathBuf },
    FileRemoved { work_dir: PathBuf, file: PathBuf },
    Error { work_dir: PathBuf, message: String },
}

// SSE 通知器 - 实现 FileChangeNotifier trait
#[derive(Debug)]
pub struct SSENotifier {
    work_dir: PathBuf,
    sender: UnboundedSender<FileChangeEvent>,
}

impl SSENotifier {
    pub fn new(work_dir: PathBuf, sender: UnboundedSender<FileChangeEvent>) -> Self {
        Self { work_dir, sender }
    }
}

impl FileChangeNotifier for SSENotifier {
    fn file_changed(&self, work_dir: &Path, change: FileChange) -> Result<(), ()> {
        if work_dir != &self.work_dir {
            return Ok(());
        }

        let event = match change {
            FileChange::Created(path) => FileChangeEvent::FileCreated {
                work_dir: work_dir.to_path_buf(),
                file: path,
            },
            FileChange::Removed(path) => FileChangeEvent::FileRemoved {
                work_dir: work_dir.to_path_buf(),
                file: path,
            },
        };

        debug!("Sending file change event for work_dir: {:?}", work_dir);
        self.sender.send(event).map_err(|_| ())
    }

    fn notify_error(&self, work_dir: &Path, error: &str) -> Result<(), ()> {
        if work_dir != &self.work_dir {
            return Ok(());
        }

        let event = FileChangeEvent::Error {
            work_dir: work_dir.to_path_buf(),
            message: error.to_string(),
        };

        debug!("Sending Error event for work_dir: {:?}", work_dir);
        self.sender.send(event).map_err(|_| ())
    }
}

// 查询参数结构
#[derive(serde::Deserialize)]
pub struct WorkDirParam {
    work_dir: String,
}

// SSE 端点处理器
pub async fn sse_handler(work_dir: web::Query<WorkDirParam>) -> Result<HttpResponse, Error> {
    let work_dir_path = PathBuf::from(&work_dir.work_dir);

    info!("New SSE connection for work_dir: {:?}", work_dir_path);

    // 创建用于 SSE 的通道
    let (tx, rx) = unbounded_channel();

    // 创建 SSE 通知器
    let sse_notifier = Arc::new(SSENotifier::new(work_dir_path.clone(), tx.clone()));

    // 注册到全局文件监听器注册表
    add_file_change_notifier(
        work_dir_path.clone(),
        sse_notifier.clone() as Arc<dyn FileChangeNotifier>,
    )
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    // 创建 SSE 事件流
    let sse_stream = tokio_stream::wrappers::UnboundedReceiverStream::new(rx).map(
        move |event| -> Result<Bytes, Error> {
            match serde_json::to_string(&event) {
                Ok(data) => {
                    debug!("Sending SSE event: {}", data);
                    Ok(Bytes::from(format!("data: {}\n\n", data)))
                }
                Err(e) => {
                    error!("Failed to serialize SSE event: {}", e);
                    Ok(Bytes::from(
                        "data: {\"error\": \"Failed to serialize event\"}\n\n",
                    ))
                }
            }
        },
    );

    // 返回 SSE 响应
    Ok(HttpResponse::Ok()
        .insert_header((actix_web::http::header::CONTENT_TYPE, "text/event-stream"))
        .insert_header(("cache-control", "no-cache"))
        .insert_header(("connection", "keep-alive"))
        .insert_header(("access-control-allow-origin", "*"))
        .streaming(sse_stream))
}
