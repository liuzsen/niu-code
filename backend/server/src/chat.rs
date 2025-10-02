use std::{
    collections::HashMap,
    fmt::Display,
    path::PathBuf,
    sync::{Arc, OnceLock},
    time::Duration,
};

use anyhow::Result;
use cc_sdk::types::{ClaudeCodeOptions, PermissionMode, PermissionResult, SDKMessage};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tokio::sync::{
    mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel},
    oneshot,
};
use tracing::{debug, info, warn};

use crate::{
    BizResult,
    claude::{CanUseTool, ClaudeCli, ClaudeCliMessage, PromptGen},
    message::{
        CanUseToolParams, ChatId, ClaudeSystemInfo, ClientMessage, ServerError, ServerMessage,
        ServerMessageData,
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
    pub session_id: String,
    pub work_dir: PathBuf,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub messages: Vec<MessageRecord>,
    pub subscriber: Option<(ChatId, u32)>, // (chat_id, conn_id) pairs
    pub cli_mailbox: ClaudeCliMailbox,
}

// HTTP response structures
#[derive(Serialize, Debug)]
pub struct SessionInfo {
    pub session_id: String,
    pub work_dir: PathBuf,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub message_count: usize,
    pub last_user_input: Option<Arc<String>>,
}

pub struct ChatManager {
    mailbox: UnboundedReceiver<ChatManagerMessage>,
    connections: HashMap<u32, WsSender>,

    // Session management
    cli_sessions: HashMap<String, CliSession>, // session_id -> CliSession
    chat_to_conn: HashMap<ChatId, u32>,        // chat_id -> conn_id
    chat_to_cli: HashMap<ChatId, String>,      // chat_id -> session_id
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
        session_id: String,
        data: ServerMessageData,
    },
    // Connection closed
    ConnectionClosed {
        conn_id: u32,
    },
    GetSessionsByWorkDir {
        work_dir: PathBuf,
        responder: oneshot::Sender<Vec<SessionInfo>>,
    },
    StartChat {
        options: StartChatOptions,
        responder: oneshot::Sender<BizResult<Vec<MessageRecord>, StartChatError>>,
    },
    CleanSessions,
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
            let interval = Duration::from_secs(5 * 60); // Check every 5 minutes
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
            ChatManagerMessage::CliMessage { session_id, data } => {
                self.handle_cli_message(&session_id, data).await;
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
            ChatManagerMessage::StartChat { options, responder } => {
                let result = self.handle_start_chat(options).await;
                let _ = responder.send(result);
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
            crate::message::ClientMessageData::StopSession => {
                self.stop_cli_by_chat(&chat_id);
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
        if let Some(session_id) = self.chat_to_cli.get(chat_id) {
            if let Some(session) = self.cli_sessions.get_mut(session_id) {
                session.messages.push(MessageRecord {
                    timestamp: Utc::now(),
                    message: CacheMessage::UserInput(prompt.content.clone()),
                });
                session.last_activity = Utc::now();
            }
        }
    }

    fn stop_cli(&mut self, session_id: &str) {
        if let Some(session) = self.cli_sessions.remove(session_id) {
            log_err(session.cli_mailbox.send(ClaudeCliMessage::Stop));

            for (chat_id, _) in session.subscriber.iter() {
                self.unregister_chat(chat_id);
            }
        }
    }

    fn stop_cli_by_chat(&mut self, chat_id: &String) {
        if let Some(session_id) = self.chat_to_cli.get(chat_id) {
            let session_id = session_id.clone();
            self.stop_cli(&session_id);
        }
    }

    fn regiter_chat(&mut self, conn_id: u32, chat_id: ChatId) {
        debug!("Register chat: {} -> conn: {}", chat_id, conn_id);
        self.chat_to_conn.insert(chat_id.clone(), conn_id);
    }

    fn unregister_chat(&mut self, chat_id: &ChatId) -> Option<String> {
        self.chat_to_conn.remove(chat_id);
        let session_id = self.chat_to_cli.remove(chat_id);
        if let Some(ref session_id) = session_id {
            self.unsubscribe(session_id);
        }
        session_id
    }

    fn unsubscribe(&mut self, session_id: &str) {
        if let Some(session) = self.cli_sessions.get_mut(session_id) {
            session.subscriber = None;
        }
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
        let Some(session_id) = self.chat_to_cli.get(chat_id) else {
            info!("Chat not found");
            self.report_error(conn_id, chat_id, "Chat not found".to_string());
            return;
        };

        let Some(session) = self.cli_sessions.get(session_id) else {
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
        let result = self.build_claude_cli_inner(conn_id, chat_id, options).await;
        if let Err(err) = result {
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
        use tokio_stream::StreamExt;

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
            chat_id: _,
        } = options;

        let cli_options = ClaudeCodeOptions {
            can_use_tool: Some(Box::new(can_use_tool)),
            resume: resume.clone(),
            env: Some(env),
            cwd: Some(work_dir.clone()),
            permission_mode: mode,
            ..Default::default()
        };
        let (tx, rx) = unbounded_channel();
        let prompt_gen = PromptGen::new(rx);
        let mut stream = cc_sdk::query(prompt_gen, cli_options).await?;

        // Wait for first message to extract session_id
        let first_msg = stream
            .next()
            .await
            .ok_or_else(|| anyhow::anyhow!("No messages from Claude"))?
            .map_err(|e| anyhow::anyhow!("Claude stream error: {}", e))?;

        let session_id = stream
            .session_id()
            .ok_or_else(|| anyhow::anyhow!("No session_id from stream"))?
            .to_string();

        // Check if session already exists
        if self.cli_sessions.contains_key(&session_id) {
            anyhow::bail!("Session already exists: {}", session_id);
        }

        let manager_mailbox = get_manager_mailbox();
        let claude = ClaudeCli::new(session_id.clone(), claude_rx, manager_mailbox, tx);

        // Create session record
        let session = CliSession {
            session_id: session_id.clone(),
            work_dir: work_dir.clone(),
            created_at: Utc::now(),
            last_activity: Utc::now(),
            messages: Vec::new(),
            subscriber: Some((chat_id.clone(), conn_id)),
            cli_mailbox: claude_tx,
        };

        // Register session
        self.cli_sessions.insert(session_id.clone(), session);
        self.chat_to_cli.insert(chat_id.clone(), session_id.clone());

        // Cache the first message
        let data = crate::message::ServerMessageData::Claude(Arc::new(first_msg));
        self.cache_message(&session_id, &data);

        claude.spawn(stream);

        Ok(())
    }

    async fn handle_cli_message(&mut self, session_id: &str, data: ServerMessageData) {
        self.cache_message(session_id, &data);

        if let Some(session) = self.cli_sessions.get(session_id) {
            if let Some((chat_id, conn_id)) = session.subscriber.clone() {
                if let Some(ws_writer) = self.connections.get(&conn_id) {
                    let broadcast_msg = ServerMessage {
                        chat_id: chat_id,
                        data: data,
                    };
                    if ws_writer.send_msg(broadcast_msg).is_err() {
                        self.handle_connection_closed(conn_id);
                    }
                }
            }
        }
    }

    fn cache_message(&mut self, session_id: &str, data: &ServerMessageData) {
        let Some(session) = self.cli_sessions.get_mut(session_id) else {
            return;
        };

        session.last_activity = Utc::now();
        let msg = match data {
            ServerMessageData::Claude(msg) => CacheMessage::Claude(Arc::clone(msg)),
            ServerMessageData::SystemInfo(info) => CacheMessage::SystemInfo(Arc::clone(info)),
            ServerMessageData::CanUseTool(params) => CacheMessage::CanUseTool(Arc::clone(params)),
            ServerMessageData::ServerError(_) => return, // Don't cache errors
        };

        session.messages.push(MessageRecord {
            timestamp: Utc::now(),
            message: msg,
        });
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
                        session_id: session.session_id.clone(),
                        work_dir: session.work_dir.clone(),
                        created_at: session.created_at,
                        last_activity: session.last_activity,
                        message_count: session.messages.len(),
                        last_user_input: session.last_user_input(),
                    })
                } else {
                    None
                }
            })
            .collect();
        debug!(?sessions, "Get sessions by work dir");

        let _ = responder.send(sessions);
    }

    async fn handle_start_chat(
        &mut self,
        options: StartChatOptions,
    ) -> BizResult<Vec<MessageRecord>, StartChatError> {
        use crate::resume;

        let chat_id = options.chat_id.clone();
        let conn_id = *self
            .chat_to_conn
            .get(&chat_id)
            .ok_or_else(|| anyhow::anyhow!("Chat not registered"))?;

        match &options.resume {
            None => {
                // Case 1: New session
                self.build_claude_cli(conn_id, &chat_id, options).await;
                Ok(Ok(vec![]))
            }
            Some(session_id) => {
                let session_id = session_id.clone();
                if let Some(session) = self.cli_sessions.get_mut(&session_id) {
                    // Case 2: Resume active session
                    // Replace subscriber
                    session.subscriber = Some((chat_id.clone(), conn_id));
                    self.chat_to_cli.insert(chat_id, session_id.clone());

                    Ok(Ok(session.messages.clone()))
                } else {
                    // Case 3: Resume inactive session from file
                    let logs = resume::load_session(&options.work_dir, &session_id).await?;
                    let mut messages = vec![];
                    for log in logs.logs {
                        if let Some(msg) = resume::log_to_message_record(log)? {
                            messages.push(msg);
                        }
                    }

                    // Start new Claude CLI with resume parameter
                    self.build_claude_cli(conn_id, &chat_id, options).await;

                    // Add loaded messages to session cache
                    if let Some(session) = self.cli_sessions.get_mut(&session_id) {
                        session.messages = messages.clone();
                    }

                    Ok(Ok(messages))
                }
            }
        }
    }

    fn cleanup_inactive_sessions(&mut self) {
        let now = Utc::now();
        const TIMEOUT: Duration = Duration::from_secs(10 * 60); // 10 minutes

        let expired: Vec<String> = self
            .cli_sessions
            .iter()
            .filter(|(_, session)| (now - session.last_activity).to_std().unwrap() > TIMEOUT)
            .map(|(session_id, _)| session_id.clone())
            .collect();

        for session_id in expired {
            self.stop_cli(&session_id);
        }
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

pub struct ChatManagerHandle {
    mailbox: UnboundedSender<ChatManagerMessage>,
}

impl ChatManagerHandle {
    pub fn new() -> Self {
        Self {
            mailbox: get_manager_mailbox(),
        }
    }

    pub async fn session_list(&self, work_dir: PathBuf) -> Vec<SessionInfo> {
        let (responder, receiver) = oneshot::channel();
        self.mailbox
            .send(ChatManagerMessage::GetSessionsByWorkDir {
                work_dir,
                responder,
            })
            .unwrap();
        receiver.await.unwrap()
    }

    pub async fn start_chat(
        &self,
        options: StartChatOptions,
    ) -> BizResult<Vec<MessageRecord>, StartChatError> {
        let (responder, receiver) = oneshot::channel();
        self.mailbox
            .send(ChatManagerMessage::StartChat { options, responder })
            .unwrap();
        receiver.await.unwrap()
    }
}

#[derive(Deserialize)]
pub struct StartChatOptions {
    pub chat_id: String,
    pub work_dir: PathBuf,
    pub mode: Option<PermissionMode>,

    // session-id
    pub resume: Option<String>,
}

pub enum StartChatError {
    ChatNotRegistered,
}
