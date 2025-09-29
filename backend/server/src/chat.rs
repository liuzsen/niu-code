use std::{
    collections::HashMap,
    fmt::Display,
    sync::{Arc, OnceLock},
};

use anyhow::{Context, Result};
use cc_sdk::types::ClaudeCodeOptions;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel};
use tracing::{debug, info, warn};

use crate::{
    claude::{CanUseTool, ClaudeCli, ClaudeCliMessage, PromptGen},
    message::{ChatId, ClientMessage, ServerError, ServerMessage, StartChatOptions},
};

static MAILBOX_SENDER: OnceLock<UnboundedSender<ChatManagerMessage>> = OnceLock::new();

pub fn set_manager_mailbox(tx: UnboundedSender<ChatManagerMessage>) {
    let _ = MAILBOX_SENDER.set(tx);
}

pub fn get_manager_mailbox() -> UnboundedSender<ChatManagerMessage> {
    MAILBOX_SENDER
        .get()
        .expect("You must invoke set_manager_mailbox first")
        .clone()
}

pub struct ChatManager {
    mailbox: UnboundedReceiver<ChatManagerMessage>,
    connections: HashMap<u32, WsSender>,
    claudes: HashMap<ChatId, ClaudeCliMailbox>,
}

pub type WsSender = Arc<dyn WsWriter>;
type ClaudeCliMailbox = UnboundedSender<ClaudeCliMessage>;

pub enum ChatManagerMessage {
    NewConnect {
        conn_id: u32,
        ws_writer: Arc<dyn WsWriter>,
    },
    ClientMessage {
        conn_id: u32,
        msg: ClientMessage,
    },
}

macro_rules! map {
    ($($key:expr => $value:expr),* $(,)?) => {
        std::collections::HashMap::from(
            [
                $(($key.to_string(), $value.to_string())),*
            ]
        )
    };
}

impl ChatManager {
    pub fn new(mailbox: UnboundedReceiver<ChatManagerMessage>) -> Self {
        Self {
            mailbox,
            connections: Default::default(),
            claudes: Default::default(),
        }
    }

    pub async fn run(mut self) {
        while let Some(msg) = self.mailbox.recv().await {
            self.handle_msg(msg).await;
        }
    }

    async fn handle_msg(&mut self, msg: ChatManagerMessage) {
        match msg {
            ChatManagerMessage::NewConnect { conn_id, ws_writer } => {
                debug!("register connection endpoint in manager");
                self.connections.insert(conn_id, ws_writer);
            }
            ChatManagerMessage::ClientMessage { conn_id, msg } => {
                self.handle_client_msg(conn_id, msg).await;
            }
        }
    }

    async fn handle_client_msg(&mut self, conn_id: u32, msg: ClientMessage) {
        debug!(conn_id, chat_id = msg.chat_id, "handle client msg");
        let chat_id = msg.chat_id;
        match msg.data {
            crate::message::ClientMessageData::UserInput(prompt) => {
                self.forward_to_cli(
                    conn_id,
                    &chat_id,
                    ClaudeCliMessage::UserInput(prompt.content),
                );
            }
            crate::message::ClientMessageData::PermissionResp(permission_result) => {
                self.forward_to_cli(
                    conn_id,
                    &chat_id,
                    ClaudeCliMessage::PermissionResp(permission_result),
                );
            }
            crate::message::ClientMessageData::SetMode { mode } => {
                self.forward_to_cli(conn_id, &chat_id, ClaudeCliMessage::SetMode(mode));
            }
            crate::message::ClientMessageData::GetInfo => {
                self.forward_to_cli(conn_id, &chat_id, ClaudeCliMessage::GetInfo);
            }
            crate::message::ClientMessageData::Stop => {
                if let Some(claude) = self.claudes.remove(&chat_id) {
                    log_err(claude.send(ClaudeCliMessage::Stop));
                }
            }
            crate::message::ClientMessageData::StartChat(start_chat) => {
                self.start_chat(conn_id, &chat_id, start_chat).await;
            }
        }
    }

    async fn start_chat(&mut self, conn_id: u32, chat_id: &ChatId, options: StartChatOptions) {
        debug!(conn_id, "start new chat");
        self.build_claude_cli(conn_id, chat_id, options).await;
    }

    fn report_error(&self, conn_id: u32, chat_id: &ChatId, err: String) {
        if let Some(conn) = self.connections.get(&conn_id) {
            let res = conn.send_msg(ServerMessage {
                chat_id: chat_id.clone(),
                data: crate::message::ServerMessageData::ServerError(ServerError { error: err }),
            });
            log_err(res);
        }
    }

    fn forward_to_cli(&mut self, conn_id: u32, chat_id: &ChatId, msg: ClaudeCliMessage) {
        let Some(claude) = self.claudes.get(chat_id) else {
            info!("Claude cli not found");
            self.report_error(conn_id, chat_id, "Claude cli not found".to_string());
            return;
        };

        if let Err(_) = claude.send(msg) {
            warn!("Claude cli dead");
            self.claudes.remove(chat_id);
        }
    }

    async fn build_claude_cli(
        &mut self,
        conn_id: u32,
        chat_id: &ChatId,
        options: StartChatOptions,
    ) {
        if let Err(err) = self.build_claude_cli_inner(conn_id, chat_id, options).await {
            let ws_writer = self.connections.get(&conn_id).unwrap();
            let err = format!("Cannot spawn Claude cli: {err:?}");

            // no need to handle error if ws is closed
            let _ = ws_writer.send_msg(ServerMessage {
                chat_id: chat_id.clone(),
                data: crate::message::ServerMessageData::ServerError(ServerError { error: err }),
            });
        }
    }

    async fn build_claude_cli_inner(
        &mut self,
        conn_id: u32,
        chat_id: &ChatId,
        options: StartChatOptions,
    ) -> Result<()> {
        debug!("build claude cli");
        let (claude_tx, claude_rx) = unbounded_channel();
        let can_use_tool = CanUseTool::new(claude_tx.clone());
        let env = map! {
            "ANTHROPIC_BASE_URL" => "http://127.0.0.1:3456",
            "ANTHROPIC_AUTH_TOKEN" => "your-secret-key",
        };

        let StartChatOptions {
            work_dir,
            mode,
            resume,
        } = options;

        let cli_options = ClaudeCodeOptions {
            can_use_tool: Some(Box::new(can_use_tool)),
            resume,
            env: Some(env),
            cwd: Some(work_dir),
            permission_mode: mode,
            ..Default::default()
        };
        let (tx, rx) = unbounded_channel();
        let prompt_gen = PromptGen::new(rx);
        let stream = cc_sdk::query(prompt_gen, cli_options).await?;

        let ws_writer = self
            .connections
            .get(&conn_id)
            .context("No connection")?
            .clone();
        let claude = ClaudeCli::new(chat_id.clone(), claude_rx, ws_writer, tx);

        self.claudes.insert(chat_id.clone(), claude_tx);

        claude.spawn(stream);

        Ok(())
    }
}

pub trait WsWriter: Send + 'static + Sync {
    fn send_msg(&self, msg: ServerMessage) -> Result<()>;
}

fn log_err<E: Display>(result: Result<(), E>) {
    if let Err(err) = result {
        info!(%err, "error occured");
    }
}
