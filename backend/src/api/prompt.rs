use std::sync::Arc;

use actix_web::web::Bytes;
use actix_web::{Error, HttpResponse};
use server::prompt_hub::{DynPromptListener, PromptListener, PromptRecord, get_prompt_hub};
use tokio::sync::mpsc::{UnboundedSender, unbounded_channel};
use tokio_stream::StreamExt;
use tracing::{error, info};

/// SSE 监听器实现
pub struct SSEPromptListener {
    sender: UnboundedSender<PromptRecord>,
}

impl SSEPromptListener {
    pub fn new(sender: UnboundedSender<PromptRecord>) -> Self {
        Self { sender }
    }
}

impl PromptListener for SSEPromptListener {
    fn on_new_prompt(&self, prompt: &PromptRecord) -> Result<(), ()> {
        self.sender.send(prompt.clone()).map_err(|_| ())
    }
}

/// SSE 端点处理器
pub async fn sse_handler() -> Result<HttpResponse, Error> {
    info!("New SSE connection for prompts");

    // 创建用于 SSE 的通道
    let (tx, rx) = unbounded_channel();

    // 获取提示词中心
    let prompt_hub = get_prompt_hub();

    // 创建并注册 SSE 监听器
    let sse_listener = Arc::new(SSEPromptListener::new(tx.clone()));
    prompt_hub.add_listener(sse_listener as DynPromptListener);

    // 创建 SSE 事件流
    let sse_stream = tokio_stream::wrappers::UnboundedReceiverStream::new(rx).map(
        move |event| -> Result<Bytes, Error> {
            match serde_json::to_string(&event) {
                Ok(data) => Ok(Bytes::from(format!("data: {}\n\n", data))),
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
