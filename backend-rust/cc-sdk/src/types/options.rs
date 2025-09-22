use std::{collections::HashMap, fmt::Debug, path::PathBuf};

use serde::{Deserialize, Serialize};

use crate::types::{
    CanUseToolCallBackDyn, PermissionMode, can_use_tool::PermissionUpdate,
    tool_input::ToolInputSchemas,
};

pub type Dict<T> = HashMap<String, T>;

pub trait DebugCallBack: Debug + Send {
    fn call(&self, data: String);
}

#[derive(Debug, Default)]
pub struct ClaudeCodeOptions {
    pub abort_controller: Option<Unsupported>,
    pub additional_directories: Option<Vec<String>>,
    pub allowed_tools: Option<Vec<String>>,
    pub append_system_prompt: Option<String>,
    pub can_use_tool: Option<Box<dyn CanUseToolCallBackDyn>>,
    pub r#continue: Option<bool>,
    pub custom_system_prompt: Option<String>,
    pub cwd: Option<PathBuf>,
    pub disallowed_tools: Option<Vec<String>>,
    pub env: Option<Dict<String>>,
    pub executable: Option<Executable>,
    pub executable_args: Option<Vec<String>>,
    pub extra_args: Option<HashMap<String, Option<String>>>,
    pub fallback_model: Option<String>,

    /// unsupported yet
    pub hooks: Option<Unsupported>,

    pub include_partial_messages: Option<bool>,

    /// It's not used in official typescript sdk
    pub max_thinking_tokens: Option<Unsupported>,

    pub max_turns: Option<u32>,
    pub mcp_servers: Option<Unsupported>,
    pub model: Option<String>,
    pub path_to_claude_code_executable: Option<PathBuf>,
    pub permission_mode: Option<PermissionMode>,
    pub permission_prompt_tool_name: Option<String>,
    pub resume: Option<String>,
    pub stderr: Option<Box<dyn DebugCallBack>>,
    pub strict_mcp_config: Option<bool>,
}

#[derive(Debug)]
pub enum Unsupported {}

#[derive(Deserialize, Serialize)]
pub struct CanUseToolParams {
    pub tool_name: String,
    pub input: ToolInputSchemas,
    pub options: CandUseToolParamOptions,
}

#[derive(Deserialize, Serialize)]
pub struct CandUseToolParamOptions {
    pub suggestions: Vec<PermissionUpdate>,
}

pub type CanUseTool = Box<dyn Fn(&str) -> bool + Send + Sync>;

#[derive(Debug, Clone)]
pub enum Executable {
    Bun,
    Deno,
    Node,
}

impl Executable {
    pub fn as_str(&self) -> &'static str {
        match self {
            Executable::Bun => "bun",
            Executable::Deno => "deno",
            Executable::Node => "node",
        }
    }
}
