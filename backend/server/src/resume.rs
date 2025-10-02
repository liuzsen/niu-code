use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    ffi::OsStr,
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};
use tokio::{
    fs::{File, read_dir},
    io::{AsyncBufReadExt, BufReader},
};
use tracing::debug;

use crate::{
    chat::{CacheMessage, MessageRecord},
    claude_log::{ClaudeLog, ClaudeLogTypes},
};
use cc_sdk::types::{SDKAssistantMessage, SDKMessage, SDKMessageTyped, SDKUserMessage};

#[derive(Serialize, Deserialize)]
pub struct ClaudeSession {
    pub logs: Vec<ClaudeLogTypes>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ClaudeSessionInfo {
    pub session_id: String,
    pub last_user_input: String,
    pub last_active: DateTime<Utc>,
}

pub async fn load_session_infos(work_dir: &Path) -> Result<Vec<ClaudeSessionInfo>> {
    let logs_dir = dbg!(logs_dir(work_dir)?);
    debug!("loading logs dir: {}", logs_dir.display());
    let mut dir = read_dir(logs_dir).await?;

    let mut sessions = vec![];
    while let Some(entry) = dir.next_entry().await? {
        if entry.path().extension() != Some(OsStr::new("jsonl")) {
            continue;
        }
        println!("{}", entry.path().display());

        let file = File::open(entry.path()).await?;
        let reader = BufReader::new(file);

        let session_id = entry
            .path()
            .file_stem()
            .unwrap()
            .to_string_lossy()
            .to_string();
        let mut lines = reader.lines();
        let mut last_timestamp: Option<DateTime<Utc>> = None;
        let mut last_user_input = String::new();

        // Read all lines to find the last timestamp and user input
        let mut all_lines = vec![];
        while let Some(line) = lines.next_line().await? {
            all_lines.push(line);
        }

        // Process lines in reverse order
        for line in all_lines.iter().rev() {
            let Ok(log_entry) = serde_json::from_str::<serde_json::Value>(line) else {
                continue;
            };

            // Extract timestamp from the last line
            if last_timestamp.is_none() {
                if let Some(timestamp_str) = log_entry["timestamp"].as_str() {
                    if let Ok(timestamp) = DateTime::parse_from_rfc3339(timestamp_str) {
                        last_timestamp = Some(timestamp.with_timezone(&Utc));
                    }
                }
            }

            // Look for user input message
            if last_user_input.is_empty() {
                if let (Some("user"), Some(message)) = (
                    log_entry.get("type").and_then(|t| t.as_str()),
                    log_entry.get("message"),
                ) {
                    let content = &message["content"];
                    if let Some(content) = content.as_str() {
                        last_user_input = content.to_string();
                        break;
                    }
                    if let Some(content) = content.as_array() {
                        for content_item in content {
                            if let (Some("text"), Some(text)) = (
                                content_item.get("type").and_then(|t| t.as_str()),
                                content_item.get("text").and_then(|t| t.as_str()),
                            ) {
                                last_user_input = text.to_string();
                                break;
                            }
                        }
                    }
                }
            }

            // If we found both values, break
            if last_timestamp.is_some() && !last_user_input.is_empty() {
                break;
            }
        }

        // If we found a timestamp, create a session info
        if let Some(last_active) = last_timestamp {
            sessions.push(ClaudeSessionInfo {
                last_user_input,
                last_active,
                session_id,
            });
        }
    }

    Ok(sessions)
}

#[derive(Deserialize)]
pub struct LoadSessionOptions {
    work_dir: PathBuf,
    limit: usize,
    max_age: DurationMilliSec,
}

pub struct DurationMilliSec(Duration);

impl<'de> Deserialize<'de> for DurationMilliSec {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let milli_secs = u64::deserialize(deserializer)?;
        Ok(DurationMilliSec(Duration::from_millis(milli_secs)))
    }
}

pub async fn load_session(work_dir: &Path, session_id: &str) -> Result<ClaudeSession> {
    let logs_dir = logs_dir(&work_dir)?;
    let path = logs_dir.join(session_id).with_extension("jsonl");

    let mut logs = vec![];
    let file = File::open(path).await?;
    let reader = BufReader::new(file);
    let mut lines = reader.lines();
    while let Some(line) = lines.next_line().await? {
        let log: ClaudeLogTypes = serde_json::from_str(&line)?;
        logs.push(log);
    }

    Ok(ClaudeSession { logs: logs })
}

pub async fn load_sessions(options: LoadSessionOptions) -> Result<Vec<ClaudeSession>> {
    let logs_dir = logs_dir(&options.work_dir)?;
    let mut dir = read_dir(logs_dir).await?;

    let mut sessions = vec![];
    while let Some(entry) = dir.next_entry().await? {
        if !entry.path().ends_with("jsonl") {
            continue;
        }
        if sessions.len() >= options.limit {
            break;
        }
        let metadata = entry.metadata().await?;
        if metadata.modified()?.elapsed()? > options.max_age.0 {
            continue;
        }

        let mut logs = vec![];
        let file = File::open(entry.path()).await?;
        let reader = BufReader::new(file);
        let mut lines = reader.lines();
        while let Some(line) = lines.next_line().await? {
            let log: ClaudeLogTypes = serde_json::from_str(&line)?;
            logs.push(log);
        }
        sessions.push(ClaudeSession { logs });
    }

    Ok(sessions)
}

fn logs_dir(work_dir: &Path) -> Result<PathBuf> {
    let home = std::env::var("HOME").context("No env: HOME")?;

    // Get the canonical form of the working directory
    let work_dir_canonical = work_dir
        .canonicalize()
        .unwrap_or_else(|_| work_dir.to_path_buf());

    // Convert to string and replace path separators with hyphens
    let work_dir_str = work_dir_canonical.to_string_lossy();
    let project_id = work_dir_str
        .replace('/', "-")
        .replace('\\', "-")
        .replace(':', "-")
        .replace('.', "-");

    // Get Claude config directory (from env var or default to ~/.claude)
    let claude_config_dir =
        std::env::var("CLAUDE_CONFIG_DIR").unwrap_or_else(|_| format!("{}/.claude", home));

    // Join the paths: claude_config_dir/projects/project_id
    let mut path = PathBuf::from(claude_config_dir);
    path.push("projects");
    path.push(&project_id);

    Ok(path)
}

pub fn log_to_message_record(log: ClaudeLogTypes) -> anyhow::Result<Option<MessageRecord>> {
    match log {
        ClaudeLogTypes::User(log) => {
            let timestamp = parse_timestamp(&log.timestamp)?;
            let record = extract_user_msg(&log).context("unexpected user log")?;
            Ok(Some(MessageRecord {
                timestamp,
                message: record,
            }))
        }
        ClaudeLogTypes::Assistant(log) => {
            let timestamp = parse_timestamp(&log.timestamp)?;
            let msg: Value = serde_json::from_value(log.message.clone())?;
            Ok(Some(MessageRecord {
                timestamp,
                message: CacheMessage::Claude(Arc::new(SDKMessage {
                    session_id: log.session_id.clone(),
                    typed: SDKMessageTyped::Assistant(SDKAssistantMessage {
                        uuid: log.uuid.clone(),
                        message: msg,
                        parent_tool_use_id: None,
                    }),
                })),
            }))
        }
        // Skip these log types
        ClaudeLogTypes::Summary(_) => Ok(None),
        ClaudeLogTypes::FileHistorySnapshot(_) => Ok(None),
        ClaudeLogTypes::System(_) => Ok(None),
    }
}

fn parse_timestamp(timestamp_str: &str) -> Result<DateTime<Utc>> {
    Ok(DateTime::parse_from_rfc3339(timestamp_str)?.to_utc())
}

fn extract_user_msg(log: &ClaudeLog) -> anyhow::Result<CacheMessage> {
    let msg = serde_json::from_value(log.message.clone()).context("parse log message")?;
    let msg = SDKMessage {
        session_id: log.session_id.clone(),
        typed: SDKMessageTyped::User(SDKUserMessage {
            uuid: Some(log.uuid.clone()),
            message: msg,
            parent_tool_use_id: None,
        }),
    };

    Ok(CacheMessage::Claude(Arc::new(msg)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_logs_dir_with_path() {
        // Set up test environment
        let test_home = "/test/home";
        unsafe {
            std::env::set_var("HOME", test_home);
        }

        let input_path = Path::new("/data/home/sen/code/projects/ai/zsen-cc-web");
        let result = logs_dir(input_path).unwrap();

        let expected_path = PathBuf::from(format!(
            "{}/.claude/projects/-data-home-sen-code-projects-ai-zsen-cc-web",
            test_home
        ));
        assert_eq!(result, expected_path);
    }

    #[tokio::test]
    async fn test_load_session_infos() {
        let input_path = Path::new("/data/home/sen/code/projects/ai/test-project");
        let result = load_session_infos(input_path).await.unwrap();
        dbg!(result);
    }
}
