use std::{
    collections::HashMap,
    fmt::Display,
    path::PathBuf,
    sync::{Arc, OnceLock},
    time::Duration,
};

use anyhow::{Context, Result};
use cc_sdk::types::{ClaudeCodeOptions, PermissionMode, PermissionResult, SDKMessage};
use chrono::{DateTime, Utc};
use derive_more::Display;
use serde::{Deserialize, Serialize};
use tokio::{
    io::AsyncWriteExt,
    sync::{
        mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel},
        oneshot,
    },
};
use tracing::{debug, info, warn};

use crate::{
    BizResult, biz_ok,
    claude::{CanUseTool, ClaudeCli, ClaudeCliMessage, PromptGen},
    ensure_biz,
    message::{
        CanUseToolParams, ChatId, ClaudeSystemInfo, ClientMessage, ServerError, ServerMessage,
        ServerMessageData,
    },
    resume,
    setting::get_current_setting,
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
    session_id: Option<String>,
    work_dir: PathBuf,
    created_at: DateTime<Utc>,
    last_activity: DateTime<Utc>,
    messages: Vec<MessageRecord>,
    chat: Option<SessionChat>,
    mail_addr: ClaudeCliMailbox,
}

#[derive(Debug)]
struct SessionChat {
    id: ChatId,
    lag_count: u32,
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
    connections: HashMap<ConnId, WsSender>,
    cli_sessions: HashMap<CliId, CliSession>,
    chat_to_conn: HashMap<ChatId, ConnId>,
    chat_to_cli: HashMap<ChatId, CliId>,
}

#[derive(Debug, Clone, Copy, Hash, Eq, PartialEq, Display)]
pub struct ConnId(u32);

impl ConnId {
    pub fn generate() -> Self {
        static COUNTER: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
        ConnId(COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst))
    }
}

pub type WsSender = Arc<dyn WsWriter>;
type ClaudeCliMailbox = UnboundedSender<ClaudeCliMessage>;

pub enum ChatManagerMessage {
    NewConnect {
        conn_id: ConnId,
        ws_writer: Arc<dyn WsWriter>,
    },
    ClientMessage {
        conn_id: ConnId,
        msg: ClientMessage,
    },
    // Message from ClaudeCli
    CliMessage {
        cli_id: CliId,
        data: ServerMessageData,
    },
    // Connection closed
    ConnectionClosed {
        conn_id: ConnId,
    },
    GetActiveSessions {
        work_dir: PathBuf,
        responder: oneshot::Sender<Vec<SessionInfo>>,
    },
    GetClaudeInfo {
        work_dir: PathBuf,
        responder: oneshot::Sender<Result<ClaudeSystemInfo>>,
    },
    StartChat {
        options: StartChatOptions,
        responder: oneshot::Sender<BizResult<Vec<MessageRecord>, StartChatError>>,
    },
    CleanSessions,
}

#[derive(Hash, Eq, PartialEq, Clone, Copy, Debug, Display)]
pub struct CliId(u32);

impl CliId {
    fn next() -> Self {
        static COUNTER: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
        CliId(COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst))
    }
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
            ChatManagerMessage::CliMessage { cli_id, data } => {
                self.handle_cli_message(cli_id, data).await;
            }
            ChatManagerMessage::ConnectionClosed { conn_id } => {
                self.connections.remove(&conn_id);
                self.chat_to_conn.retain(|_, c| c != &conn_id);
            }
            ChatManagerMessage::GetActiveSessions {
                work_dir,
                responder,
            } => {
                self.handle_get_active_sessions(work_dir, responder);
            }
            ChatManagerMessage::StartChat { options, responder } => {
                let result = self.handle_start_chat(options).await;
                let _ = responder.send(result);
            }
            ChatManagerMessage::CleanSessions => {
                self.cleanup_inactive_sessions();
            }
            ChatManagerMessage::GetClaudeInfo {
                work_dir,
                responder,
            } => {
                let result = self.handle_get_claude_info(work_dir).await;
                let _ = responder.send(result);
            }
        }
    }

    async fn handle_client_msg(&mut self, conn_id: ConnId, msg: ClientMessage) {
        debug!(%conn_id, chat_id = msg.chat_id, "handle client msg");
        let chat_id = msg.chat_id;
        match msg.data {
            crate::message::ClientMessageData::RegisterChat => {
                self.regiter_chat(conn_id, chat_id);
            }
            crate::message::ClientMessageData::UserInput(prompt) => {
                self.record_user_input(&chat_id, &prompt);

                self.forward_to_cli(&chat_id, ClaudeCliMessage::UserInput(prompt.content));
            }
            crate::message::ClientMessageData::PermissionResp(permission_result) => {
                self.record_user_permission_resp(&chat_id, permission_result.clone());
                self.forward_to_cli(
                    &chat_id,
                    ClaudeCliMessage::PermissionResp(permission_result),
                );
            }
            crate::message::ClientMessageData::SetMode { mode } => {
                self.forward_to_cli(&chat_id, ClaudeCliMessage::SetMode(mode));
            }
            crate::message::ClientMessageData::GetInfo => {
                self.forward_to_cli(&chat_id, ClaudeCliMessage::GetInfo);
            }
            crate::message::ClientMessageData::StopSession => {
                self.stop_cli_by_chat(&chat_id);
            }
        }
    }

    async fn handle_get_claude_info(&mut self, work_dir: PathBuf) -> Result<ClaudeSystemInfo> {
        let options = ClaudeCodeOptions {
            cwd: Some(work_dir.clone()),
            ..Default::default()
        };
        let (_prompt, stream) = build_stream(None, options).await?.unwrap();
        let commands = stream.supported_commands()?;
        let models = stream.supported_models()?;

        Ok(ClaudeSystemInfo { commands, models })
    }

    fn record_user_permission_resp(
        &mut self,
        chat_id: &ChatId,
        permission_result: Arc<PermissionResult>,
    ) {
        let Some(cli_id) = self.get_chat_cli_id(chat_id) else {
            debug!(chat_id, "no cli found when record user permission response");
            self.report_err(
                chat_id,
                "No cli found. It maybe subscribed by another user.",
            );
            return;
        };
        let Some(session) = self.cli_sessions.get_mut(&cli_id) else {
            warn!(
                chat_id,
                "session not found when record user permission response"
            );
            return;
        };
        let now = Utc::now();
        session.messages.push(MessageRecord {
            timestamp: now,
            message: CacheMessage::PermissionResp(permission_result.clone()),
        });
        session.last_activity = now;
    }

    fn get_chat_cli_id(&self, chat_id: &ChatId) -> Option<CliId> {
        self.chat_to_cli.get(chat_id).copied()
    }

    fn record_user_input(&mut self, chat_id: &String, prompt: &crate::message::UserInput) {
        let Some(cli_id) = self.get_chat_cli_id(chat_id) else {
            debug!(chat_id, "no cli found when record user input");
            return;
        };
        let Some(session) = self.cli_sessions.get_mut(&cli_id) else {
            warn!(chat_id, "session not found when record user input");
            return;
        };

        let now = Utc::now();
        session.messages.push(MessageRecord {
            timestamp: now,
            message: CacheMessage::UserInput(prompt.content.clone()),
        });
        session.last_activity = now;
    }

    fn stop_cli_by_chat(&mut self, chat_id: &String) {
        let Some(cli_id) = self.get_chat_cli_id(chat_id) else {
            debug!(chat_id, "no cli found when stop cli by chat");
            return;
        };
        self.stop_cli(cli_id);
    }

    fn stop_cli(&mut self, cli_id: CliId) {
        if let Some(session) = self.cli_sessions.remove(&cli_id) {
            info!(session_id = ?session.session_id, %cli_id, chat = ?session.chat, "Stop cli session");
            let _ = session.mail_addr.send(ClaudeCliMessage::Stop);
            if let Some(chat) = session.chat {
                self.remove_chat(&chat.id);
            }
        }
    }

    fn remove_chat(&mut self, chat_id: &ChatId) {
        debug!("Remove chat: {}", chat_id);
        if let Some(conn_id) = self.chat_to_conn.get(chat_id) {
            debug!("notify client when remove chat: {}", chat_id);
            let conn = self.connections.get(conn_id).unwrap();
            let _ = conn.send_msg(ServerMessage {
                chat_id: chat_id.clone(),
                data: ServerMessageData::ChatRemoved,
            });
        }
        self.chat_to_cli.remove(chat_id);
        self.chat_to_conn.remove(chat_id);
    }

    fn regiter_chat(&mut self, conn_id: ConnId, chat_id: ChatId) {
        debug!("Register chat: {} -> conn: {}", chat_id, conn_id);
        'chat: {
            if let Some(cli_id) = self.chat_to_cli.get(&chat_id).copied() {
                info!("try send lag messages to client via new connection");
                let session = self.cli_sessions.get_mut(&cli_id).unwrap();
                let chat = session.chat.as_mut().unwrap();

                if chat.lag_count == 0 {
                    break 'chat;
                }

                let start = session.messages.len() - chat.lag_count as usize;
                let end = session.messages.len();
                for msg in &session.messages[start..end] {
                    let ws = self.connections.get(&conn_id).unwrap();
                    let data = match msg.message.clone() {
                        CacheMessage::UserInput(input) => {
                            warn!(%input, "Impossible to send user input");
                            continue;
                        }
                        CacheMessage::Claude(sdkmessage) => ServerMessageData::Claude(sdkmessage),
                        CacheMessage::SystemInfo(claude_system_info) => {
                            ServerMessageData::SystemInfo(claude_system_info)
                        }
                        CacheMessage::CanUseTool(can_use_tool_params) => {
                            ServerMessageData::CanUseTool(can_use_tool_params)
                        }
                        CacheMessage::PermissionResp(permission_result) => {
                            let result = serde_json::to_string(&permission_result).unwrap();
                            warn!(%result, "Impossible to send permission response");
                            continue;
                        }
                    };
                    if let Err(err) = ws.send_msg(ServerMessage {
                        chat_id: chat_id.clone(),
                        data: data,
                    }) {
                        info!(%err, "send message to chat ws failed");
                        break 'chat;
                    }
                }
            }
        }

        self.chat_to_conn.insert(chat_id.clone(), conn_id);
    }

    fn forward_to_cli(&mut self, chat_id: &ChatId, msg: ClaudeCliMessage) {
        let Some(cli_id) = self.get_chat_cli_id(chat_id) else {
            debug!(chat_id, "no cli found when forward to cli");
            return;
        };
        let Some(session) = self.cli_sessions.get_mut(&cli_id) else {
            debug!(chat_id, "session not found when forward to cli");
            return;
        };
        if let Err(err) = session.mail_addr.send(msg) {
            info!(%err, "forward to cli failed");
            self.report_err(chat_id, "Claude Session closed");
            self.stop_cli(cli_id);
        }
    }

    fn report_err<T: Display>(&mut self, chat_id: &ChatId, err: T) {
        if let Some(ws) = self.chat_conn(chat_id) {
            let result = ws.send_msg(ServerMessage {
                chat_id: chat_id.clone(),
                data: ServerMessageData::ServerError(ServerError {
                    error: err.to_string(),
                }),
            });

            if let Err(err) = result {
                info!(%err, "send error message to chat ws failed");
            }
        } else {
            debug!(%chat_id, "no ws found when report error");
        }
    }

    fn chat_conn(&self, chat_id: &ChatId) -> Option<WsSender> {
        let conn_id = self.chat_to_conn.get(chat_id)?;
        self.connections.get(&conn_id).cloned()
    }

    async fn build_claude_cli(
        &mut self,
        options: StartChatOptions,
    ) -> BizResult<(), StartChatError> {
        let (claude_tx, claude_rx) = unbounded_channel();
        let can_use_tool = CanUseTool::new(claude_tx.clone());

        let StartChatOptions {
            work_dir,
            mode,
            resume,
            chat_id,
            config_name,
        } = options;

        let cli_options = ClaudeCodeOptions {
            can_use_tool: Some(Box::new(can_use_tool)),
            resume: resume.clone(),
            cwd: Some(work_dir.clone()),
            permission_mode: mode,
            ..Default::default()
        };
        let (tx, stream) = ensure_biz!(build_stream(config_name, cli_options).await?);

        let cli_id = CliId::next();

        let manager_mailbox = get_manager_mailbox();
        let claude = ClaudeCli::new(cli_id.clone(), claude_rx, manager_mailbox, tx);
        claude.spawn(stream);

        // Create session record
        let session = CliSession {
            session_id: resume,
            work_dir: work_dir.clone(),
            created_at: Utc::now(),
            last_activity: Utc::now(),
            messages: Vec::new(),
            chat: Some(SessionChat {
                id: chat_id.clone(),
                lag_count: 0,
            }),
            mail_addr: claude_tx,
        };

        self.cli_sessions.insert(cli_id, session);
        self.chat_to_cli.insert(chat_id, cli_id);

        biz_ok!(())
    }

    async fn handle_cli_message(&mut self, cli_id: CliId, data: ServerMessageData) {
        debug!(%cli_id, "handle cli message");
        self.cache_message(cli_id, &data);

        let Some(session) = self.cli_sessions.get_mut(&cli_id) else {
            debug!(%cli_id, "session not found when handle cli message");
            return;
        };
        let Some(chat) = &mut session.chat else {
            debug!(%cli_id, "no subscriber found");
            return;
        };

        let Some(conn_id) = self.chat_to_conn.get(&chat.id) else {
            warn!(%chat.id, "conn not found when handle cli message");
            chat.lag_count += 1;
            return;
        };

        let Some(ws_writer) = self.connections.get(conn_id) else {
            warn!(%conn_id, "ws not found when handle cli message");
            chat.lag_count += 1;
            return;
        };

        let result = ws_writer.send_msg(ServerMessage {
            chat_id: chat.id.clone(),
            data,
        });
        if let Err(err) = result {
            info!(%err, "send message to chat ws failed");
            chat.lag_count += 1;
        }
    }

    fn cache_message(&mut self, cli_id: CliId, data: &ServerMessageData) {
        let Some(session) = self.cli_sessions.get_mut(&cli_id) else {
            debug!(%cli_id, "session not found when cache message");
            return;
        };

        session.last_activity = Utc::now();
        let msg = match data {
            ServerMessageData::Claude(msg) => {
                if session.session_id.is_none() {
                    session.session_id = Some(msg.session_id.clone());
                }
                CacheMessage::Claude(Arc::clone(msg))
            }
            ServerMessageData::SystemInfo(info) => CacheMessage::SystemInfo(Arc::clone(info)),
            ServerMessageData::CanUseTool(params) => CacheMessage::CanUseTool(Arc::clone(params)),
            ServerMessageData::ServerError(_) => return,
            ServerMessageData::ChatRemoved => return,
        };

        session.messages.push(MessageRecord {
            timestamp: Utc::now(),
            message: msg,
        });
    }

    fn handle_get_active_sessions(
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
                        session_id: session.session_id.clone()?,
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

    fn cli_id_by_session_id(&self, session_id: &str) -> Option<CliId> {
        self.cli_sessions.iter().find_map(|(id, session)| {
            if session.session_id.as_deref() == Some(session_id) {
                Some(*id)
            } else {
                None
            }
        })
    }

    async fn handle_start_chat(
        &mut self,
        options: StartChatOptions,
    ) -> BizResult<Vec<MessageRecord>, StartChatError> {
        let chat_id = options.chat_id.clone();

        match &options.resume {
            None => {
                debug!(chat_id, "New chat");
                // Case 1: New session
                ensure_biz!(self.build_claude_cli(options).await?);
                Ok(Ok(vec![]))
            }
            Some(session_id) => self.resume_session(session_id.clone(), options).await,
        }
    }

    async fn resume_session(
        &mut self,
        session_id: String,
        options: StartChatOptions,
    ) -> BizResult<Vec<MessageRecord>, StartChatError> {
        let session_id = session_id.clone();
        let chat_id = options.chat_id.clone();
        if let Some(cli_id) = self.cli_id_by_session_id(&session_id) {
            // Case 2: Resume active session
            debug!(chat_id, session_id, "Resume active session");

            let old_chat_id = {
                let cli = self.cli_sessions.get(&cli_id).unwrap();
                cli.chat.as_ref().map(|c| c.id.clone())
            };

            if let Some(chat_id) = old_chat_id {
                self.remove_chat(&chat_id);
            }

            self.chat_to_cli.insert(chat_id.clone(), cli_id);
            let session = self.cli_sessions.get_mut(&cli_id).unwrap();
            session.chat = Some(SessionChat {
                id: chat_id,
                lag_count: 0,
            });

            if let Some(mode) = options.mode {
                session.send_set_mode(mode);
            }

            let messages = session.messages.clone();
            Ok(Ok(messages))
        } else {
            // Case 3: Resume inactive session from file
            debug!(chat_id, session_id, "Resume closed session");

            let logs = resume::load_session(&options.work_dir, &session_id).await?;
            let mut messages = vec![];
            for log in logs.logs {
                if let Some(msg) = resume::log_to_message_record(log)? {
                    messages.push(msg);
                }
            }

            ensure_biz!(self.build_claude_cli(options).await?);
            let cli_id = self.chat_to_cli.get(&chat_id).unwrap();
            let session = self.cli_sessions.get_mut(cli_id).unwrap();
            session.messages = messages.clone();

            Ok(Ok(messages))
        }
    }

    fn cleanup_inactive_sessions(&mut self) {
        let now = Utc::now();
        const TIMEOUT: Duration = Duration::from_secs(10 * 60); // 10 minutes

        let expired: Vec<CliId> = self
            .cli_sessions
            .iter()
            .filter(|(_, session)| (now - session.last_activity).to_std().unwrap() > TIMEOUT)
            .map(|(session_id, _)| session_id.clone())
            .collect();

        for cli_id in expired {
            info!("Session {} expired", cli_id);
            self.stop_cli(cli_id);
        }
    }
}

async fn build_stream(
    config_name: Option<String>,
    cli_options: ClaudeCodeOptions,
) -> BizResult<
    (
        UnboundedSender<cc_sdk::types::SDKUserMessage>,
        cc_sdk::cli::QueryStream,
    ),
    StartChatError,
> {
    let (tx, rx) = unbounded_channel();
    let prompt_gen = PromptGen::new(rx);
    let stream = if let Some(name) = config_name {
        let cli_cmd = cc_sdk::query(prompt_gen, cli_options);
        let result = replace_claude_config(&name, cli_cmd).await?;
        ensure_biz!(result)?
    } else {
        cc_sdk::query(prompt_gen, cli_options).await?
    };

    Ok(Ok((tx, stream)))
}

async fn replace_claude_config<F: Future>(
    name: &str,
    cli_cmd: F,
) -> BizResult<F::Output, StartChatError> {
    let setting = get_current_setting();

    debug!(name, "Using custom claude config");
    let config = setting
        .get_claude_setting(name)
        .ok_or_else(|| StartChatError::ConfigNotFound(name.to_string()));
    let config = ensure_biz!(config);

    let home_dir = dirs::home_dir().context("Failed to get home directory")?;
    let claude_config_path = home_dir.join(".claude").join("settings.json");
    let backup_path = home_dir.join(".claude").join("settings.json.niu-code.bak");
    debug!(?claude_config_path, ?backup_path, "backup claude config");

    tokio::fs::rename(&claude_config_path, &backup_path).await?;

    let json = serde_json::to_string_pretty(&config.setting).unwrap();
    let mut file = tokio::fs::File::create(&claude_config_path).await?;
    file.write_all(json.as_bytes()).await?;

    let result = cli_cmd.await;

    tokio::fs::rename(&backup_path, &claude_config_path).await?;

    Ok(Ok(result))
}

pub trait WsWriter: Send + 'static + Sync {
    fn send_msg(&self, msg: ServerMessage) -> Result<()>;
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

    fn send_set_mode(&self, mode: PermissionMode) {
        if let Err(err) = self.mail_addr.send(ClaudeCliMessage::SetMode(mode)) {
            warn!(?err, "Failed to send set mode");
        }
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

    pub async fn active_session_list(&self, work_dir: PathBuf) -> Vec<SessionInfo> {
        let (responder, receiver) = oneshot::channel();
        self.mailbox
            .send(ChatManagerMessage::GetActiveSessions {
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
        debug!("wait for start chat");
        receiver.await.unwrap()
    }

    pub async fn get_claude_info(&self, work_dir: PathBuf) -> Result<ClaudeSystemInfo> {
        let (responder, receiver) = oneshot::channel();
        self.mailbox.send(ChatManagerMessage::GetClaudeInfo {
            work_dir,
            responder,
        })?;
        receiver.await.unwrap()
    }
}

#[derive(Deserialize)]
pub struct StartChatOptions {
    pub chat_id: String,
    pub work_dir: PathBuf,
    pub mode: Option<PermissionMode>,
    pub config_name: Option<String>,

    // session-id
    pub resume: Option<String>,
}

#[derive(Debug)]
pub enum StartChatError {
    ChatNotRegistered,
    ConfigNotFound(String),
}
