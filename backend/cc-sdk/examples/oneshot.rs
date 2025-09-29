use std::{collections::HashMap, path::PathBuf};

use cc_sdk::{
    query,
    types::{ClaudeCodeOptions, DebugCallBack},
};
use tokio_stream::StreamExt;
use tracing::Level;
use tracing_subscriber::FmtSubscriber;

fn cwd() -> PathBuf {
    std::env::current_dir().unwrap()
}

#[derive(Debug)]
struct StderrCallBack {}

impl DebugCallBack for StderrCallBack {
    fn call(&self, params: String) {
        println!("CLUADE STDERR: {params}");
    }
}

fn oneshot_options() -> ClaudeCodeOptions {
    ClaudeCodeOptions {
        abort_controller: None,
        additional_directories: None,
        allowed_tools: None,
        append_system_prompt: None,
        can_use_tool: None,
        r#continue: None,
        custom_system_prompt: None,
        cwd: Some(cwd()),
        disallowed_tools: None,
        env: Some(HashMap::from([
            (
                "ANTHROPIC_BASE_URL".to_string(),
                "http://127.0.0.1:3456".to_string(),
            ),
            (
                "ANTHROPIC_AUTH_TOKEN".to_string(),
                "your-secret-key".to_string(),
            ),
            ("DEBUG".to_string(), "true".to_string()),
        ])),
        executable: None,
        executable_args: None,
        extra_args: None,
        fallback_model: None,
        hooks: None,
        include_partial_messages: None,
        max_thinking_tokens: None,
        max_turns: Some(100),
        mcp_servers: None,
        model: None,
        path_to_claude_code_executable: Some("claude".into()),
        permission_mode: None,
        permission_prompt_tool_name: None,
        resume: None,
        stderr: Some(Box::new(StderrCallBack {})),
        strict_mcp_config: None,
    }
}

fn set_tracing() {
    // a builder for `FmtSubscriber`.
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::DEBUG)
        .finish();

    tracing::subscriber::set_global_default(subscriber).expect("setting default subscriber failed");
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    set_tracing();
    tracing::info!("This is being logged on the info level");
    let options = oneshot_options();
    let mut claude = query(
        "What is th answer to the Ultimate Question of Life, the Universe, and Everything",
        options,
    )
    .await?;
    while let Some(msg) = claude.next().await {
        let msg = msg.unwrap();
        println!("{}", serde_json::to_string_pretty(&msg).unwrap());
    }

    println!("claude exited");

    Ok(())
}
