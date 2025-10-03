use tokio::sync::mpsc::unbounded_channel;

use crate::chat::{ChatManager, set_manager_mailbox};

pub mod chat;
pub mod claude;
pub mod claude_log;
pub mod message;
pub mod result;
pub mod resume;
pub mod setting;
pub mod websocket;
pub mod work_dir;

pub type BizResult<T, E> = Result<Result<T, E>, anyhow::Error>;

pub async fn init() {
    setting::init().await;

    let (tx, rx) = unbounded_channel();
    set_manager_mailbox(tx);
    let manager = ChatManager::new(rx);
    manager.run().await;
}
