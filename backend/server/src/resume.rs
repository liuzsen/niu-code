use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    time::Duration,
};
use tokio::{
    fs::{File, read_dir},
    io::{AsyncBufReadExt, BufReader},
};

use crate::claude_log::ClaudeLogTypes;

#[derive(Serialize, Deserialize)]
pub struct ClaudeSession {
    logs: Vec<ClaudeLogTypes>,
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
}
