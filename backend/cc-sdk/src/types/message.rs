use std::sync::Arc;

use derive_more::From;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize, Debug)]
pub struct SDKMessage {
    pub session_id: String,
    #[serde(flatten)]
    pub typed: SDKMessageTyped,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
#[serde(deny_unknown_fields)]
pub enum SDKMessageTyped {
    Assistant(SDKAssistantMessage),
    User(SDKUserMessage),
    Result(SDKResultMessage),
    System(SDKSystemMessage),
    StreamEvent(SDKPartialAssistantMessage),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SDKAssistantMessage {
    pub uuid: String,
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
pub struct SDKUserMessage {
    pub uuid: Option<String>,
    pub message: APIUserMessage,
    pub parent_tool_use_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct APIUserMessage {
    pub content: UserContent,
    pub role: APIUserMessageRole,
}

#[derive(Serialize, Deserialize, Debug, From)]
#[serde(untagged)]
pub enum UserContent {
    String(Arc<String>),
    Vec(Vec<serde_json::Value>),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SDKUserMessageReplay {
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
    pub uuid: String,
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
    pub uuid: String,
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
    pub uuid: String,
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
    pub uuid: String,
    pub event: Value,
    pub parent_tool_use_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SDKCompactBoundaryMessage {
    pub uuid: String,
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

#[cfg(test)]
mod tests {
    use std::fs::read_dir;

    use super::*;

    #[test]
    fn test_parse() -> anyhow::Result<()> {
        let currnet_dir = std::env::current_dir().unwrap();
        let test_collection_dir = currnet_dir.join(".local/messages");
        println!("test_collection_dir: {}", test_collection_dir.display());

        let dir = read_dir(test_collection_dir)?;
        for entry in dir {
            let entry = entry?;
            let content = std::fs::read_to_string(entry.path())?;
            let _: SDKMessage = serde_json::from_str(&content)?;
        }

        Ok(())
    }
}
