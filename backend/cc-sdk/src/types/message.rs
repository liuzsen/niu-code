use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize, Debug)]
#[serde(deny_unknown_fields)]
pub struct SDKMessageBase {
    pub uuid: String,
    pub session_id: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
#[serde(deny_unknown_fields)]
pub enum SDKMessage {
    Assistant(SDKAssistantMessage),
    User(SDKUserMessagePack),
    Result(SDKResultMessage),
    System(SDKSystemMessage),
    StreamEvent(SDKPartialAssistantMessage),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SDKAssistantMessage {
    #[serde(flatten)]
    pub base: SDKMessageBase,
    pub message: Value,
    pub parent_tool_use_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "snake_case")]
pub enum APIUserMessageRole {
    User,
    Assistant,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(untagged)]
pub enum SDKUserMessagePack {
    Replay(SDKUserMessageReplay),
    UserMessage(SDKUserMessage),
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(deny_unknown_fields)]
pub struct SDKUserMessage {
    pub uuid: Option<String>,
    pub session_id: String,
    pub message: APIUserMessage,
    pub parent_tool_use_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(deny_unknown_fields)]
pub struct APIUserMessage {
    /// TODO: support more content type
    ///
    /// content: string | Array<ContentBlockParam>;
    pub content: Arc<String>,
    pub role: APIUserMessageRole,
}

impl SDKUserMessage {
    pub fn to_sdk_msg(self) -> SDKMessage {
        SDKMessage::User(SDKUserMessagePack::UserMessage(self))
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SDKUserMessageReplay {
    #[serde(flatten)]
    pub base: SDKMessageBase,
    pub message: Value,
    pub parent_tool_use_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(deny_unknown_fields)]
pub struct SDKPermissionDenial {
    pub tool_name: String,
    pub tool_use_id: String,
    pub tool_input: Value,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "subtype")]
#[serde(rename_all = "snake_case")]
#[serde(deny_unknown_fields)]
pub enum SDKResultMessage {
    Success(SDKResultSuccessMessage),
    ErrorMaxTurns(SDKResultErrorMessage),
    ErrorDuringExecution(SDKResultErrorMessage),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SDKResultSuccessMessage {
    #[serde(flatten)]
    pub base: SDKMessageBase,
    pub duration_ms: u64,
    pub duration_api_ms: u64,
    pub is_error: bool,
    pub num_turns: u32,
    pub result: String,
    pub total_cost_usd: f64,
    pub usage: Value,
    #[serde(rename = "modelUsage")]
    pub model_usage: std::collections::HashMap<String, ModelUsage>,
    pub permission_denials: Vec<SDKPermissionDenial>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SDKResultErrorMessage {
    #[serde(flatten)]
    pub base: SDKMessageBase,
    pub duration_ms: u64,
    pub duration_api_ms: u64,
    pub is_error: bool,
    pub num_turns: u32,
    pub total_cost_usd: f64,
    pub usage: Value,
    #[serde(rename = "modelUsage")]
    pub model_usage: std::collections::HashMap<String, ModelUsage>,
    pub permission_denials: Vec<SDKPermissionDenial>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ModelUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_input_tokens: u64,
    pub cache_creation_input_tokens: u64,
    pub web_search_requests: u64,
    #[serde(rename = "costUSD")]
    pub cost_usd: f64,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "subtype")]
#[serde(rename_all = "snake_case")]
#[serde(deny_unknown_fields)]
pub enum SDKSystemMessage {
    Init(SDKSystemInitMessage),
    CompactBoundary(SDKCompactBoundaryMessage),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SDKSystemInitMessage {
    #[serde(flatten)]
    pub base: SDKMessageBase,
    #[serde(rename = "apiKeySource")]
    pub api_key_source: Option<ApiKeySource>,
    pub cwd: String,
    pub tools: Vec<String>,
    pub mcp_servers: Vec<MCPServerStatus>,
    pub model: String,
    #[serde(rename = "permissionMode")]
    pub permission_mode: PermissionMode,
    pub slash_commands: Vec<String>,
    pub output_style: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PermissionMode {
    Default,
    AcceptEdits,
    BypassPermissions,
    Plan,
}

impl PermissionMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            PermissionMode::Default => "default",
            PermissionMode::Plan => "plan",
            PermissionMode::AcceptEdits => "accept-edits",
            PermissionMode::BypassPermissions => "bypass-permissions",
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "snake_case")]
pub enum ApiKeySource {
    User,
    Project,
    Org,
    Temporary,
    None,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(deny_unknown_fields)]
pub struct MCPServerStatus {
    pub name: String,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SDKPartialAssistantMessage {
    #[serde(flatten)]
    pub base: SDKMessageBase,
    pub event: Value,
    pub parent_tool_use_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SDKCompactBoundaryMessage {
    #[serde(flatten)]
    pub base: SDKMessageBase,
    pub compact_metadata: CompactMetadata,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(deny_unknown_fields)]
pub struct CompactMetadata {
    pub trigger: CompactMetadataTrigger,
    pub pre_tokens: u64,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "snake_case")]
pub enum CompactMetadataTrigger {
    Manual,
    Auto,
}
