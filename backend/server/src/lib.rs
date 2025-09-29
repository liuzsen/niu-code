use tokio::sync::mpsc::unbounded_channel;

use crate::chat::{ChatManager, set_manager_mailbox};

pub mod chat;
pub mod claude;
pub mod claude_log;
pub mod message;
pub mod resume;
pub mod websocket;

pub async fn start_manager() {
    let (tx, rx) = unbounded_channel();
    set_manager_mailbox(tx);
    let manager = ChatManager::new(rx);
    manager.run().await;
}
