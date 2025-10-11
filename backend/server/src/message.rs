use std::sync::Arc;

use cc_sdk::{
    cli::{ModelInfo, SlashCommand},
    types::{APIUserMessage, PermissionMode, PermissionResult, SDKMessage},
};
use derive_more::From;
use serde::{Deserialize, Serialize};

pub type ChatId = String;

#[derive(Deserialize, Serialize, Debug)]
pub struct ClientMessage {
    pub chat_id: ChatId,
    pub data: ClientMessageData,
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(tag = "kind")]
#[serde(rename_all = "snake_case")]
pub enum ClientMessageData {
    RegisterChat,
    UserInput(APIUserMessage),
    PermissionResp(Arc<PermissionResult>),
    SetMode { mode: PermissionMode },
    GetInfo,
    StopSession,
    Interrupt,
}

#[derive(Serialize)]
pub struct ServerMessage {
    pub chat_id: ChatId,
    pub data: ServerMessageData,
}

#[derive(From, Serialize, Clone)]
#[serde(tag = "kind")]
#[serde(rename_all = "snake_case")]
pub enum ServerMessageData {
    Claude(Arc<SDKMessage>),
    ServerError(ServerError),
    SystemInfo(Arc<ClaudeSystemInfo>),
    CanUseTool(Arc<CanUseToolParams>),
    ChatRemoved,
}

#[derive(Serialize, Clone)]
pub struct ServerError {
    pub error: String,
}

#[derive(Serialize)]
pub struct CanUseToolParams {
    pub tool_use: cc_sdk::types::ToolUseParams,
    pub suggestions: Option<Vec<cc_sdk::types::PermissionUpdate>>,
}

#[derive(Serialize, Clone)]
pub struct ClaudeSystemInfo {
    pub commands: Vec<SlashCommand>,
    pub models: Vec<ModelInfo>,
}
