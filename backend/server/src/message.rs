use std::path::PathBuf;

use cc_sdk::{
    cli::{ModelInfo, SlashCommand},
    types::{PermissionMode, PermissionResult, SDKMessage},
};
use derive_more::From;
use serde::{Deserialize, Serialize};

pub type ChatId = String;

#[derive(Deserialize, Serialize)]
pub struct ClientMessage {
    pub chat_id: ChatId,
    pub data: ClientMessageData,
}

#[derive(Deserialize, Serialize)]
#[serde(tag = "kind")]
#[serde(rename_all = "snake_case")]
pub enum ClientMessageData {
    UserInput(UserInput),
    PermissionResp(PermissionResult),
    SetMode { mode: PermissionMode },
    GetInfo,
    Stop,
    StartChat(StartChatOptions),
}

#[derive(Deserialize, Serialize)]
pub struct StartChatOptions {
    pub work_dir: PathBuf,
    pub mode: Option<PermissionMode>,
    pub resume: Option<String>,
}

#[derive(Deserialize, Serialize)]
pub struct UserInput {
    pub content: String,
    pub resume: Option<String>,
}

#[derive(Serialize)]
pub struct ServerMessage {
    pub chat_id: ChatId,
    pub data: ServerMessageData,
}

#[derive(From, Serialize)]
#[serde(tag = "kind")]
#[serde(rename_all = "snake_case")]
pub enum ServerMessageData {
    Claude(SDKMessage),
    ServerError(ServerError),
    SystemInfo(ClaudeSystemInfo),
    CanUseTool(CanUseToolParams),
}

#[derive(Serialize)]
pub struct ServerError {
    pub error: String,
}

#[derive(Serialize)]
pub struct CanUseToolParams {
    pub tool_use: cc_sdk::types::ToolInputSchemasWithName,
    pub suggestions: Option<Vec<cc_sdk::types::PermissionUpdate>>,
}

#[derive(Serialize)]
pub struct ClaudeSystemInfo {
    pub commands: Vec<SlashCommand>,
    pub models: Vec<ModelInfo>,
}
