use derive_more::From;
use serde::{Deserialize, Serialize};

macro_rules! to_untagged {
    ($($type:ident),* $(,)?) => {
        $(
        impl From<$type> for UntaggedToolUseParams {
            fn from(value: $type) -> Self {
                Self(serde_json::to_value(value).unwrap())
            }
        }
        )*
    };
}

#[derive(Deserialize, Serialize, Debug)]
pub struct UntaggedToolUseParams(serde_json::Value);

to_untagged! {
    BashInput,
    FileEditInput,
    GlobInput,
    GrepInput,
    FileMultiEditInput,
    NotebookEditInput,
    FileReadInput,
    TodoWriteInput,
    WebFetchInput,
    WebSearchInput,
    FileWriteInput,
    AgentInput,
    BashOutputInput,
    ExitPlanModeInput,
    KillShellInput,
    ListMcpResourcesInput,
    ReadMcpResourceInput,
}

impl From<serde_json::Value> for UntaggedToolUseParams {
    fn from(value: serde_json::Value) -> Self {
        Self(value)
    }
}

impl From<ToolUseParams> for UntaggedToolUseParams {
    fn from(value: ToolUseParams) -> Self {
        let mut value = serde_json::to_value(value).unwrap();
        let input = value["input"].take();
        Self(input)
    }
}

#[derive(Deserialize, Serialize, Debug, From)]
#[serde(tag = "tool_name")]
pub enum ToolUseParams {
    Bash {
        input: BashInput,
    },
    Edit {
        input: FileEditInput,
    },
    Glob {
        input: GlobInput,
    },
    Grep {
        input: GrepInput,
    },
    MultiEdit {
        input: FileMultiEditInput,
    },
    NotebookEdit {
        input: NotebookEditInput,
    },
    // NotebookRead
    Read {
        input: FileReadInput,
    },
    // Task
    TodoWrite {
        input: TodoWriteInput,
    },
    WebFetch {
        input: WebFetchInput,
    },
    WebSearch {
        input: WebSearchInput,
    },
    Write {
        input: FileWriteInput,
    },

    Agent {
        input: AgentInput,
    },
    BashOutput {
        input: BashOutputInput,
    },
    ExitPlanMode {
        input: ExitPlanModeInput,
    },
    KillShell {
        input: KillShellInput,
    },
    ListMcpResources {
        input: ListMcpResourcesInput,
    },
    ReadMcpResource {
        input: ReadMcpResourceInput,
    },
    #[serde(untagged)]
    Mcp {
        tool_name: McpToolName,
        input: serde_json::Value,
    },
}

#[derive(Serialize, Debug)]
pub struct McpToolName(String);

impl<'de> Deserialize<'de> for McpToolName {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        if s.starts_with("mcp__") {
            Ok(McpToolName(s))
        } else {
            Err(serde::de::Error::custom("invalid tool name"))
        }
    }
}

#[derive(Deserialize, Serialize, Debug)]
pub struct McpToolUse {
    tool_name: McpToolName,
    input: serde_json::Value,
}

impl ToolUseParams {
    pub fn tool_name(&self) -> &'static str {
        match self {
            ToolUseParams::Bash { .. } => "Bash",
            ToolUseParams::Edit { .. } => "Edit",
            ToolUseParams::Glob { .. } => "Glob",
            ToolUseParams::Agent { .. } => "Agent",
            ToolUseParams::Grep { .. } => "Grep",
            ToolUseParams::MultiEdit { .. } => "MultiEdit",
            ToolUseParams::NotebookEdit { .. } => "NotebookEdit",
            ToolUseParams::Read { .. } => "Read",
            ToolUseParams::TodoWrite { .. } => "TodoWrite",
            ToolUseParams::WebFetch { .. } => "WebFetch",
            ToolUseParams::WebSearch { .. } => "WebSearch",
            ToolUseParams::Write { .. } => "Write",
            ToolUseParams::BashOutput { .. } => "BashOutput",
            ToolUseParams::ExitPlanMode { .. } => "ExitPlanMode",
            ToolUseParams::KillShell { .. } => "KillShell",
            ToolUseParams::ListMcpResources { .. } => "ListMcpResources",
            ToolUseParams::Mcp { .. } => "Mcp",
            ToolUseParams::ReadMcpResource { .. } => "ReadMcpResource",
        }
    }
}

#[derive(Deserialize, Serialize, Debug)]
pub struct AgentInput {
    /// A short (3-5 word) description of the task
    pub description: String,
    /// The task for the agent to perform
    pub prompt: String,
    /// The type of specialized agent to use for this task
    pub subagent_type: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct BashInput {
    /// The command to execute
    pub command: String,
    /// Optional timeout in milliseconds (max 600000)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<u64>,
    /// Clear, concise description of what this command does in 5-10 words, in active voice. Examples:
    /// Input: ls
    /// Output: List files in current directory
    ///
    /// Input: git status
    /// Output: Show working tree status
    ///
    /// Input: npm install
    /// Output: Install package dependencies
    ///
    /// Input: mkdir foo
    /// Output: Create directory 'foo'
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Set to true to run this command in the background. Use BashOutput to read the output later.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_in_background: Option<bool>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct BashOutputInput {
    /// The ID of the background shell to retrieve output from
    pub bash_id: String,
    /// Optional regular expression to filter the output lines. Only lines matching this regex will be included in the result. Any lines that do not match will no longer be available to read.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter: Option<String>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct ExitPlanModeInput {
    /// The plan you came up with, that you want to run by the user for approval. Supports markdown. The plan should be pretty concise.
    pub plan: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct FileEditInput {
    /// The absolute path to the file to modify
    pub file_path: String,
    /// The text to replace
    pub old_string: String,
    /// The text to replace it with (must be different from old_string)
    pub new_string: String,
    /// Replace all occurences of old_string (default false)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub replace_all: Option<bool>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct FileEditOperation {
    /// The text to replace
    pub old_string: String,
    /// The text to replace it with
    pub new_string: String,
    /// Replace all occurences of old_string (default false).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub replace_all: Option<bool>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct FileMultiEditInput {
    /// The absolute path to the file to modify
    pub file_path: String,
    /// Array of edit operations to perform sequentially on the file
    ///
    /// @minItems 1
    pub edits: Vec<FileEditOperation>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct FileReadInput {
    /// The absolute path to the file to read
    pub file_path: String,
    /// The line number to start reading from. Only provide if the file is too large to read at once
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<u64>,
    /// The number of lines to read. Only provide if the file is too large to read at once.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u64>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct FileWriteInput {
    /// The absolute path to the file to write (must be absolute, not relative)
    pub file_path: String,
    /// The content to write to the file
    pub content: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct GlobInput {
    /// The glob pattern to match files against
    pub pattern: String,
    /// The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter "undefined" or "null" - simply omit it for the default behavior. Must be a valid directory path if provided.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct GrepInput {
    /// The regular expression pattern to search for in file contents
    pub pattern: String,
    /// File or directory to search in (rg PATH). Defaults to current working directory.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}") - maps to rg --glob
    #[serde(skip_serializing_if = "Option::is_none")]
    pub glob: Option<String>,
    /// Output mode: "content" shows matching lines (supports -A/-B/-C context, -n line numbers, head_limit), "files_with_matches" shows file paths (supports head_limit), "count" shows match counts (supports head_limit). Defaults to "files_with_matches".
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_mode: Option<GrepOutputMode>,
    /// Number of lines to show before each match (rg -B). Requires output_mode: "content", ignored otherwise.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "-B")]
    pub b_: Option<u64>,
    /// Number of lines to show after each match (rg -A). Requires output_mode: "content", ignored otherwise.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "-A")]
    pub a_: Option<u64>,
    /// Number of lines to show before and after each match (rg -C). Requires output_mode: "content", ignored otherwise.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "-C")]
    pub c_: Option<u64>,
    /// Show line numbers in output (rg -n). Requires output_mode: "content", ignored otherwise.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "-n")]
    pub n_: Option<bool>,
    /// Case insensitive search (rg -i)
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "-i")]
    pub i_: Option<bool>,
    /// File type to search (rg --type). Common types: js, py, rust, go, java, etc. More efficient than include for standard file types.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "type")]
    pub r#type: Option<String>,
    /// Limit output to first N lines/entries, equivalent to "| head -N". Works across all output modes: content (limits output lines), files_with_matches (limits file paths), count (limits count entries). When unspecified, shows all results from ripgrep.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub head_limit: Option<u64>,
    /// Enable multiline mode where . matches newlines and patterns can span lines (rg -U --multiline-dotall). Default: false.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub multiline: Option<bool>,
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(rename_all = "snake_case")]
pub enum GrepOutputMode {
    Content,
    FilesWithMatches,
    Count,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct KillShellInput {
    /// The ID of the background shell to kill
    pub shell_id: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct ListMcpResourcesInput {
    /// Optional server name to filter resources by
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server: Option<String>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct NotebookEditInput {
    /// The absolute path to the Jupyter notebook file to edit (must be absolute, not relative)
    pub notebook_path: String,
    /// The ID of the cell to edit. When inserting a new cell, the new cell will be inserted after the cell with this ID, or at the beginning if not specified.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cell_id: Option<String>,
    /// The new source for the cell
    pub new_source: String,
    /// The type of the cell (code or markdown). If not specified, it defaults to the current cell type. If using edit_mode=insert, this is required.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cell_type: Option<NotebookCellType>,
    /// The type of edit to make (replace, insert, delete). Defaults to replace.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edit_mode: Option<NotebookEditMode>,
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(rename_all = "snake_case")]
pub enum NotebookCellType {
    Code,
    Markdown,
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(rename_all = "snake_case")]
pub enum NotebookEditMode {
    Replace,
    Insert,
    Delete,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct ReadMcpResourceInput {
    /// The MCP server name
    pub server: String,
    /// The resource URI to read
    pub uri: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct TodoItem {
    pub content: String,
    pub status: TodoStatus,
    #[serde(rename = "activeForm")]
    pub active_form: String,
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(rename_all = "snake_case")]
pub enum TodoStatus {
    Pending,
    InProgress,
    Completed,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct TodoWriteInput {
    /// The updated todo list
    pub todos: Vec<TodoItem>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct WebFetchInput {
    /// The URL to fetch content from
    pub url: String,
    /// The prompt to run on the fetched content
    pub prompt: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct WebSearchInput {
    /// The search query to use
    pub query: String,
    /// Only include search results from these domains
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allowed_domains: Option<Vec<String>>,
    /// Never include search results from these domains
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blocked_domains: Option<Vec<String>>,
}
