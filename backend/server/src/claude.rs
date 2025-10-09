use std::{sync::Arc, task::ready};

use anyhow::{Context, Result};
use cc_sdk::{
    StreamExt as _,
    cli::{ClaudeStreamError, PromptGenerator, QueryStream},
    types::{
        APIUserMessage, CanUseToolCallBack, PermissionMode, PermissionResult, SDKMessage,
        SDKUserMessage,
    },
};
use tokio::{
    select,
    sync::{
        mpsc::{UnboundedReceiver, UnboundedSender},
        oneshot,
    },
};
use tracing::{debug, warn};

use crate::{
    chat::{ChatManagerMessage, CliId},
    message::{CanUseToolParams, ClaudeSystemInfo, ServerError, ServerMessageData},
};

pub type Responder<T> = oneshot::Sender<T>;
pub type CanUseToolReponder = Responder<Arc<PermissionResult>>;

pub enum ClaudeCliMessage {
    UserInput(Arc<String>),
    PermissionResp(Arc<PermissionResult>),
    SetMode(PermissionMode),
    GetInfo,
    CanUseTool(CanUseToolParams, CanUseToolReponder),
    Stop,
    Interrupt,
}

pub type ClaudeReceiver = UnboundedReceiver<ClaudeCliMessage>;

pub struct ClaudeCli {
    cli_id: CliId,
    mailbox: ClaudeReceiver,

    manager_mailbox: UnboundedSender<ChatManagerMessage>,
    prompt_box: UnboundedSender<SDKUserMessage>,
    can_use_tool_responder: Option<CanUseToolReponder>,
}

impl ClaudeCli {
    pub fn new(
        cli_id: CliId,
        mailbox: ClaudeReceiver,
        manager_mailbox: UnboundedSender<ChatManagerMessage>,
        prompt_box: UnboundedSender<SDKUserMessage>,
    ) -> Self {
        Self {
            cli_id,
            mailbox,
            manager_mailbox,
            prompt_box,
            can_use_tool_responder: None,
        }
    }

    pub fn spawn(self, stream: QueryStream) {
        tokio::spawn(async move {
            if let Err(err) = self.run(stream).await {
                warn!(?err, "Claude cli error");
            }
        });
    }

    async fn run(mut self, mut stream: QueryStream) -> anyhow::Result<()> {
        debug!("ClaudeCli serving");
        loop {
            select! {
                Some(msg) = stream.next() => {
                    self.handle_claude_msg(msg);
                }
                Some(msg) = self.mailbox.recv() => {
                    if msg.is_stop() {
                        stream.stop();
                        return Ok(());
                    }
                    self.handle_msg(&stream, msg).await?;
                }
            }
        }
    }

    async fn handle_msg(&mut self, stream: &QueryStream, msg: ClaudeCliMessage) -> Result<()> {
        debug!(name = msg.name(), "handle_msg");
        match msg {
            ClaudeCliMessage::UserInput(input) => {
                self.prompt_box.send(self.build_prompt(input))?;
            }
            ClaudeCliMessage::PermissionResp(msg) => {
                if let Some(responder) = self.can_use_tool_responder.take() {
                    let _ = responder.send(msg); // It cannot fail
                }
            }
            ClaudeCliMessage::SetMode(mode) => {
                debug!("set model: {mode:?}");
                stream.set_permission_mode(mode)?;
            }
            ClaudeCliMessage::GetInfo => {
                let commands = stream.supported_commands()?;
                let models = stream.supported_models()?;
                let info = Arc::new(ClaudeSystemInfo { commands, models });

                self.forward_claude_msg(info);
            }
            ClaudeCliMessage::CanUseTool(parms, responder) => {
                self.forward_claude_msg(Arc::new(parms));
                if self.can_use_tool_responder.is_some() {
                    warn!("There's already a can_use_tool_responder!");
                }
                self.can_use_tool_responder = Some(responder);
            }
            ClaudeCliMessage::Stop => {
                unreachable!()
            }
            ClaudeCliMessage::Interrupt => {
                stream.interrupt().context("Interrupt error")?;
            }
        }

        Ok(())
    }

    fn build_prompt(&self, prompt: Arc<String>) -> SDKUserMessage {
        SDKUserMessage {
            uuid: None,
            message: APIUserMessage {
                content: cc_sdk::types::UserContent::String(prompt),
                role: cc_sdk::types::APIUserMessageRole::User,
            },
            parent_tool_use_id: None,
        }
    }

    fn forward_claude_msg<T>(&mut self, msg: T)
    where
        ServerMessageData: From<T>,
    {
        debug!("send claude msg to manager");
        let _ = self.manager_mailbox.send(ChatManagerMessage::CliMessage {
            cli_id: self.cli_id.clone(),
            data: ServerMessageData::from(msg),
        });
    }

    fn handle_claude_msg(&mut self, msg: Result<SDKMessage, ClaudeStreamError>) {
        self.forward_claude_msg(msg);
    }
}

impl From<Result<SDKMessage, ClaudeStreamError>> for ServerMessageData {
    fn from(value: Result<SDKMessage, ClaudeStreamError>) -> Self {
        match value {
            Ok(msg) => ServerMessageData::Claude(Arc::new(msg)),
            Err(err) => ServerMessageData::ServerError(ServerError {
                error: err.to_string(),
            }),
        }
    }
}

#[derive(Debug)]
pub struct CanUseTool {
    ask_box: UnboundedSender<ClaudeCliMessage>,
}

impl CanUseTool {
    pub fn new(ask_box: UnboundedSender<ClaudeCliMessage>) -> Self {
        Self { ask_box }
    }
}

impl CanUseToolCallBack for CanUseTool {
    async fn call(
        &mut self,
        tool_use: cc_sdk::types::ToolUseParams,
        suggestions: Option<Vec<cc_sdk::types::PermissionUpdate>>,
    ) -> anyhow::Result<Arc<PermissionResult>> {
        let (tx, rx) = oneshot::channel();
        self.ask_box
            .send(ClaudeCliMessage::CanUseTool(
                CanUseToolParams {
                    tool_use,
                    suggestions,
                },
                tx,
            ))
            .context("System error: client dead")?;
        let answer = rx.await.context("There's no answer")?;
        Ok(answer)
    }
}

pub struct PromptGen {
    mailbox: UnboundedReceiver<SDKUserMessage>,
}

impl PromptGen {
    pub fn new(mailbox: UnboundedReceiver<SDKUserMessage>) -> Self {
        Self { mailbox }
    }
}

impl PromptGenerator for PromptGen {
    fn poll_next(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Option<SDKUserMessage>> {
        let msg = ready!(self.mailbox.poll_recv(cx));
        debug!("yield prompt: {msg:#?}");

        std::task::Poll::Ready(msg)
    }
}

impl ClaudeCliMessage {
    pub fn name(&self) -> &'static str {
        match self {
            ClaudeCliMessage::UserInput(..) => "UserInput",
            ClaudeCliMessage::PermissionResp(..) => "PermissionResp",
            ClaudeCliMessage::SetMode(..) => "SetMode",
            ClaudeCliMessage::GetInfo => "GetInfo",
            ClaudeCliMessage::CanUseTool(..) => "CanUseTool",
            ClaudeCliMessage::Stop => "Stop",
            ClaudeCliMessage::Interrupt => "Interrupt",
        }
    }

    #[must_use]
    pub fn is_stop(&self) -> bool {
        matches!(self, Self::Stop)
    }
}
