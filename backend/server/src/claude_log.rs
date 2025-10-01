use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
pub enum ClaudeLogTypes {
    User(ClaudeLog),
    Assistant(ClaudeLog),
    Summary(ClaudeSummary),
    #[serde(rename = "file-history-snapshot")]
    FileHistorySnapshot(FileHistorySnapshot),
    System(serde_json::Value),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct FileHistorySnapshot {
    message_id: String,
    snapshot: serde_json::Value,
    is_snapshot_update: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSummary {
    summary: String,
    leaf_uuid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeLog {
    pub parent_uuid: Option<String>,
    pub is_sidechain: bool,
    pub user_type: String,
    pub cwd: String,
    pub session_id: String,
    pub version: String,
    pub git_branch: Option<String>,
    pub message: Value,
    pub is_meta: Option<bool>,
    pub uuid: String,
    pub timestamp: String,
    pub thinking_metadata: Option<Value>,
    pub tool_use_result: Option<Value>,
    pub is_visible_in_transcript_only: Option<bool>,
    pub is_compact_summary: Option<bool>,
    pub is_api_error_message: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSystemLog {
    pub parent_uuid: Option<String>,
    pub logical_parent_uuid: Option<String>,
    pub is_sidechain: bool,
    pub user_type: String,
    pub cwd: String,
    pub session_id: String,
    pub version: String,
    pub git_branch: Option<String>,
    // compact_boundary
    pub subtype: Option<String>,
    pub content: Option<String>,
    pub message: Value,
    pub is_meta: Option<bool>,
    pub uuid: String,
    pub level: Option<String>,
    pub timestamp: String,
    pub thinking_metadata: Option<Value>,
    pub tool_use_result: Option<Value>,
}

#[cfg(test)]
mod tests {
    use std::{
        fs::File,
        io::{BufRead, BufReader},
        path::PathBuf,
    };

    use walkdir::WalkDir;

    use crate::claude_log::ClaudeLogTypes;

    #[test]
    fn test_parse() -> anyhow::Result<()> {
        let home = PathBuf::from(std::env::var("HOME")?);
        for entry in WalkDir::new(home.join(".claude/projects")) {
            let entry = entry?;
            let metadata = entry.metadata()?;
            if metadata.is_dir() {
                continue;
            }
            println!("{}", entry.path().display());
            let file = File::open(entry.path())?;
            let reader = BufReader::new(file);
            for line in reader.lines() {
                let line = line?;
                let _: ClaudeLogTypes = serde_json::from_str(&line)?;
            }
        }

        Ok(())
    }
}
