use anyhow::Result;
use tokio::sync::mpsc::unbounded_channel;

use crate::chat::{ChatManager, set_manager_mailbox};

pub mod chat;
pub mod claude;
pub mod claude_log;
pub mod message;
pub mod prompt_hub;
pub mod result;
pub mod resume;
pub mod setting;
pub mod websocket;
pub mod work_dir;

pub type BizResult<T, E> = Result<Result<T, E>, anyhow::Error>;

pub async fn init() -> Result<()> {
    setting::init().await;

    // 初始化提示词中心
    let prompt_hub = prompt_hub::init()?;

    let (tx, rx) = unbounded_channel();
    set_manager_mailbox(tx);
    let manager = ChatManager::new(rx, prompt_hub);
    manager.run().await;

    Ok(())
}
