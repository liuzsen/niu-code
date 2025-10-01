use std::{
    collections::HashMap,
    fmt::Display,
    path::PathBuf,
    sync::{
        Arc, OnceLock,
        atomic::{AtomicU32, Ordering},
    },
    time::Duration,
};

use anyhow::Result;
use cc_sdk::types::{ClaudeCodeOptions, PermissionResult, SDKMessage};
use chrono::{DateTime, Utc};
use serde::Serialize;
use tokio::sync::{
    mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel},
    oneshot,
};
use tracing::{debug, info, warn};

use crate::{
    claude::{CanUseTool, ClaudeCli, ClaudeCliMessage, PromptGen},
    message::{
        CanUseToolParams, ChatId, ClaudeSystemInfo, ClientMessage, ServerError, ServerMessage,
        ServerMessageData, StartChatOptions,
    },
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

// CLI ID type
pub type CliId = u32;

// Persistent message types
#[derive(Clone, Serialize)]
pub enum CacheMessage {
    UserInput(Arc<String>),
    Claude(Arc<SDKMessage>),
    SystemInfo(Arc<ClaudeSystemInfo>),
    CanUseTool(Arc<CanUseToolParams>),
    PermissionResp(Arc<PermissionResult>),
}

#[derive(Clone, Serialize)]
pub struct MessageRecord {
    pub timestamp: DateTime<Utc>,
    pub message: CacheMessage,
}

pub struct CliSession {
    pub cli_id: CliId,
    pub work_dir: PathBuf,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub messages: Vec<MessageRecord>,
    pub subscribers: Vec<(ChatId, u32)>, // (chat_id, conn_id) pairs
    pub cli_mailbox: ClaudeCliMailbox,
}

// HTTP response structures
#[derive(Serialize, Debug)]
pub struct SessionInfo {
    pub cli_id: CliId,
    pub work_dir: PathBuf,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub message_count: usize,
    pub last_uesr_input: Option<Arc<String>>,
}

pub struct ChatManager {
    mailbox: UnboundedReceiver<ChatManagerMessage>,
    connections: HashMap<u32, WsSender>,

    // Session management
    cli_sessions: HashMap<CliId, CliSession>,
    chat_to_conn: HashMap<ChatId, u32>, // chat_id -> conn_id
    chat_to_cli: HashMap<ChatId, CliId>,
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
    // Message from ClaudeCli
    CliMessage {
        cli_id: CliId,
        data: ServerMessageData,
    },
    // Connection closed
    ConnectionClosed {
        conn_id: u32,
    },
    // HTTP API queries
    GetSessionsByWorkDir {
        work_dir: PathBuf,
        responder: oneshot::Sender<Vec<SessionInfo>>,
    },
    // Reconnect to existing session
    ReconnectSession {
        cli_id: CliId,
        chat_id: ChatId,
        responder: oneshot::Sender<Result<Vec<MessageRecord>, ReconnectSessionError>>,
    },
    CleanSessions,
}

static CLI_ID_COUNTER: AtomicU32 = AtomicU32::new(0);

fn generate_cli_id() -> CliId {
    CLI_ID_COUNTER.fetch_add(1, Ordering::SeqCst)
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
            cli_sessions: Default::default(),
            chat_to_conn: Default::default(),
            chat_to_cli: Default::default(),
        }
    }

    pub async fn run(mut self) {
        tokio::spawn(async move {
            let interval = Duration::from_secs(3600);
            let mut cleanup_interval = tokio::time::interval(interval);
            let mailbox = get_manager_mailbox();
            loop {
                cleanup_interval.tick().await;
                mailbox.send(ChatManagerMessage::CleanSessions).unwrap();
            }
        });

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
            ChatManagerMessage::CliMessage { cli_id, data } => {
                self.handle_cli_message(cli_id, data).await;
            }
            ChatManagerMessage::ConnectionClosed { conn_id } => {
                self.handle_connection_closed(conn_id);
            }
            ChatManagerMessage::GetSessionsByWorkDir {
                work_dir,
                responder,
            } => {
                self.handle_get_sessions_by_work_dir(work_dir, responder);
            }
            ChatManagerMessage::ReconnectSession {
                cli_id,
                chat_id,
                responder,
            } => {
                self.handle_reconnect_session(cli_id, chat_id, responder);
            }
            ChatManagerMessage::CleanSessions => {
                self.cleanup_inactive_sessions();
            }
        }
    }

    async fn handle_client_msg(&mut self, conn_id: u32, msg: ClientMessage) {
        debug!(conn_id, chat_id = msg.chat_id, "handle client msg");
        let chat_id = msg.chat_id;
        match msg.data {
            crate::message::ClientMessageData::RegisterChat => {
                self.regiter_chat(conn_id, chat_id);
            }
            crate::message::ClientMessageData::UserInput(prompt) => {
                self.record_user_input(&chat_id, &prompt);

                self.forward_to_cli(
                    conn_id,
                    &chat_id,
                    ClaudeCliMessage::UserInput(prompt.content),
                );
            }
            crate::message::ClientMessageData::PermissionResp(permission_result) => {
                self.record_user_permission_resp(&chat_id, permission_result.clone());
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
            crate::message::ClientMessageData::StopCliSession => {
                self.stop_cli_by_chat(&chat_id);
            }
            crate::message::ClientMessageData::StartChat(start_chat) => {
                self.start_chat(conn_id, &chat_id, start_chat).await;
            }
        }
    }

    fn record_user_permission_resp(
        &mut self,
        chat_id: &ChatId,
        permission_result: Arc<PermissionResult>,
    ) {
        if let Some(cli_id) = self.chat_to_cli.get(chat_id) {
            if let Some(session) = self.cli_sessions.get_mut(cli_id) {
                session.messages.push(MessageRecord {
                    timestamp: Utc::now(),
                    message: CacheMessage::PermissionResp(permission_result.clone()),
                });
                session.last_activity = Utc::now();
            }
        }
    }

    fn record_user_input(&mut self, chat_id: &String, prompt: &crate::message::UserInput) {
        if let Some(cli_id) = self.chat_to_cli.get(chat_id) {
            if let Some(session) = self.cli_sessions.get_mut(cli_id) {
                session.messages.push(MessageRecord {
                    timestamp: Utc::now(),
                    message: CacheMessage::UserInput(prompt.content.clone()),
                });
                session.last_activity = Utc::now();
            }
        }
    }

    fn stop_cli(&mut self, cli_id: CliId) {
        if let Some(session) = self.cli_sessions.remove(&cli_id) {
            log_err(session.cli_mailbox.send(ClaudeCliMessage::Stop));

            for (chat_id, _) in session.subscribers.iter() {
                self.unregister_chat(chat_id);
            }
        }
    }

    fn stop_cli_by_chat(&mut self, chat_id: &String) {
        if let Some(cli_id) = self.chat_to_cli.get(chat_id) {
            self.stop_cli(*cli_id);
        }
    }

    fn regiter_chat(&mut self, conn_id: u32, chat_id: ChatId) {
        debug!("Register chat: {} -> conn: {}", chat_id, conn_id);
        self.chat_to_conn.insert(chat_id.clone(), conn_id);
    }

    fn unregister_chat(&mut self, chat_id: &ChatId) -> Option<u32> {
        self.chat_to_conn.remove(chat_id);
        let cli_id = self.chat_to_cli.remove(chat_id);
        if let Some(cli_id) = cli_id {
            self.unsubscribe(chat_id, cli_id);
        }
        cli_id
    }

    fn unsubscribe(&mut self, chat_id: &ChatId, cli_id: CliId) {
        if let Some(session) = self.cli_sessions.get_mut(&cli_id) {
            session.subscribers.retain(|(c, _)| c != chat_id);
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
        let Some(cli_id) = self.chat_to_cli.get(chat_id) else {
            info!("Chat not found");
            self.report_error(conn_id, chat_id, "Chat not found".to_string());
            return;
        };

        let Some(session) = self.cli_sessions.get(cli_id) else {
            info!("Claude cli not found");
            self.report_error(conn_id, chat_id, "Claude cli not found".to_string());
            return;
        };

        if let Err(_) = session.cli_mailbox.send(msg) {
            warn!("Claude cli dead");
        }
    }

    async fn build_claude_cli(
        &mut self,
        conn_id: u32,
        chat_id: &ChatId,
        options: StartChatOptions,
    ) {
        let cli_id = generate_cli_id();
        let result = self
            .build_claude_cli_inner(conn_id, cli_id, chat_id, options)
            .await;
        if let Err(err) = result {
            let ws_writer = self.connections.get(&conn_id).unwrap();
            let err = format!("Cannot spawn Claude cli: {err:?}");

            // no need to handle error if ws is closed
            let _ = ws_writer.send_msg(ServerMessage {
                chat_id: chat_id.clone(),
                data: crate::message::ServerMessageData::ServerError(ServerError { error: err }),
            });
        }

        self.chat_to_cli.insert(chat_id.clone(), cli_id);
    }

    async fn build_claude_cli_inner(
        &mut self,
        conn_id: u32,
        cli_id: CliId,
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
            cwd: Some(work_dir.clone()),
            permission_mode: mode,
            ..Default::default()
        };
        let (tx, rx) = unbounded_channel();
        let prompt_gen = PromptGen::new(rx);
        let stream = cc_sdk::query(prompt_gen, cli_options).await?;

        let manager_mailbox = get_manager_mailbox();
        let claude = ClaudeCli::new(cli_id, claude_rx, manager_mailbox, tx);

        // Create session record
        let session = CliSession {
            cli_id,
            work_dir: work_dir.clone(),
            created_at: Utc::now(),
            last_activity: Utc::now(),
            messages: Vec::new(),
            subscribers: vec![(chat_id.clone(), conn_id)],
            cli_mailbox: claude_tx,
        };

        // Register session
        self.cli_sessions.insert(cli_id, session);

        claude.spawn(stream);

        Ok(())
    }

    async fn handle_cli_message(&mut self, cli_id: CliId, data: ServerMessageData) {
        self.cache_message(cli_id, &data);

        if let Some(session) = self.cli_sessions.get(&cli_id) {
            for (chat_id, conn_id) in session.subscribers.clone() {
                if let Some(ws_writer) = self.connections.get(&conn_id) {
                    let broadcast_msg = ServerMessage {
                        chat_id: chat_id.clone(),
                        data: data.clone(),
                    };
                    if ws_writer.send_msg(broadcast_msg).is_err() {
                        self.handle_connection_closed(conn_id);
                    }
                }
            }
        }
    }

    fn cache_message(&mut self, cli_id: CliId, data: &ServerMessageData) {
        let msg = match data {
            ServerMessageData::Claude(msg) => CacheMessage::Claude(Arc::clone(msg)),
            ServerMessageData::SystemInfo(info) => CacheMessage::SystemInfo(Arc::clone(info)),
            ServerMessageData::CanUseTool(params) => CacheMessage::CanUseTool(Arc::clone(params)),
            ServerMessageData::ServerError(_) => return, // Don't persist errors
        };

        if let Some(session) = self.cli_sessions.get_mut(&cli_id) {
            session.messages.push(MessageRecord {
                timestamp: Utc::now(),
                message: msg,
            });
            session.last_activity = Utc::now();
        }
    }

    fn handle_connection_closed(&mut self, conn_id: u32) {
        debug!("Connection closed: {}", conn_id);
        self.connections.remove(&conn_id);

        let remove_chats = self
            .chat_to_conn
            .iter()
            .filter_map(|(chat_id, &c)| {
                if c == conn_id {
                    Some(chat_id.clone())
                } else {
                    None
                }
            })
            .collect::<Vec<_>>();

        // Note: We don't remove CLI sessions, they continue running
        for chat_id in remove_chats {
            self.unregister_chat(&chat_id);
        }
    }

    fn handle_get_sessions_by_work_dir(
        &self,
        work_dir: PathBuf,
        responder: oneshot::Sender<Vec<SessionInfo>>,
    ) {
        debug!(?work_dir, "Get sessions by work dir");
        let sessions = self
            .cli_sessions
            .iter()
            .filter_map(|(_, session)| {
                if session.work_dir == work_dir {
                    Some(SessionInfo {
                        cli_id: session.cli_id,
                        work_dir: session.work_dir.clone(),
                        created_at: session.created_at,
                        last_activity: session.last_activity,
                        message_count: session.messages.len(),
                        last_uesr_input: session.last_user_input(),
                    })
                } else {
                    None
                }
            })
            .collect();
        debug!(?sessions, "Get sessions by work dir");

        let _ = responder.send(sessions);
    }

    fn handle_reconnect_session(
        &mut self,
        cli_id: CliId,
        chat_id: ChatId,
        responder: oneshot::Sender<Result<Vec<MessageRecord>, ReconnectSessionError>>,
    ) {
        debug!(cli_id, chat_id, "Reconnect session");
        // Look up conn_id from chat_id
        let conn_id = match self.chat_to_conn.get(&chat_id) {
            Some(&conn_id) => conn_id,
            None => {
                let _ = responder.send(Err(ReconnectSessionError::ChatNotFound));
                return;
            }
        };

        let result = match self.cli_sessions.get_mut(&cli_id) {
            Some(session) => {
                // Add subscriber
                session.subscribers.push((chat_id.clone(), conn_id));
                self.chat_to_cli.insert(chat_id, cli_id);

                // Clone messages first to avoid borrowing issues
                let messages = session.messages.clone();
                Ok(messages)
            }
            None => Err(ReconnectSessionError::SessionNotFound),
        };
        debug!("Reconnected session");

        let _ = responder.send(result);
    }

    fn cleanup_inactive_sessions(&mut self) {
        let now = Utc::now();
        const TIMEOUT_HOURS: Duration = Duration::from_secs(60 * 60 * 24);

        let expired: Vec<CliId> = self
            .cli_sessions
            .iter()
            .filter(|(_, session)| (now - session.last_activity).to_std().unwrap() > TIMEOUT_HOURS)
            .map(|(cli_id, _)| *cli_id)
            .collect();

        for cli_id in expired {
            self.stop_cli(cli_id);
        }
    }
}

pub enum ReconnectSessionError {
    ChatNotFound,
    SessionNotFound,
}

pub trait WsWriter: Send + 'static + Sync {
    fn send_msg(&self, msg: ServerMessage) -> Result<()>;
}

fn log_err<E: Display>(result: Result<(), E>) {
    if let Err(err) = result {
        info!(%err, "error occured");
    }
}

impl CliSession {
    fn last_user_input(&self) -> Option<Arc<String>> {
        self.messages.iter().rev().find_map(|msg| {
            if let CacheMessage::UserInput(input) = &msg.message {
                Some(input.clone())
            } else {
                None
            }
        })
    }
}
