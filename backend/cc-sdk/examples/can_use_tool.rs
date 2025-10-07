use std::{
    collections::HashMap,
    io::Write,
    path::PathBuf,
    sync::Arc,
    task::{Poll, ready},
};

use cc_sdk::{
    cli::PromptGenerator,
    query,
    types::{
        APIUserMessage, CanUseToolCallBack, ClaudeCodeOptions, DebugCallBack, PermissionAllow,
        PermissionDeny, PermissionResult, SDKMessageTyped, SDKUserMessage,
    },
};
use tokio::sync::mpsc::{UnboundedReceiver, unbounded_channel};
use tokio_stream::StreamExt;
use tracing::Level;
use tracing_subscriber::FmtSubscriber;

const RED: &str = "\x1b[31m";
const GREEN: &str = "\x1b[32m";
const RESET: &str = "\x1b[0m";

fn to_green(s: &str) -> String {
    format!("{}{s}{}{}", GREEN, RESET, RESET)
}

fn to_red(s: &str) -> String {
    format!("{}{s}{}{}", RED, RESET, RESET)
}

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

#[derive(Debug)]
struct CanUseTool {}

impl CanUseToolCallBack for CanUseTool {
    async fn call(
        &mut self,
        input: cc_sdk::types::ToolUseParams,
        suggestions: Option<Vec<cc_sdk::types::PermissionUpdate>>,
    ) -> anyhow::Result<Arc<PermissionResult>> {
        println!("Ask permission for tool: {}", input.tool_name());

        match input {
            cc_sdk::types::ToolUseParams::Bash { input } => {
                println!("\n-------------------------------------------------");
                println!("Claude want to run command: {}", to_red(&input.command));
                println!(
                    "Command description: {}",
                    to_green(input.description.as_deref().unwrap_or_default())
                );
                if let Some(sugs) = suggestions {
                    for sug in sugs {
                        println!("other suggestions: {sug:?}")
                    }
                }
                print!("Do you want to proceed? [Y/n]: ");
                std::io::stdout().flush()?;
                let mut buffer = String::new();
                std::io::stdin().read_line(&mut buffer)?;
                match buffer.trim() {
                    "" | "Y" | "y" => {
                        return Ok(Arc::new(PermissionResult::Allow(PermissionAllow {
                            updated_input: input.into(),
                            updated_permissions: None,
                        })));
                    }
                    _ => {
                        return Ok(Arc::new(PermissionResult::Deny(PermissionDeny {
                            message: "try other methods".to_string(),
                            interrupt: None,
                        })));
                    }
                }
            }
            _ => Ok(Arc::new(PermissionResult::Allow(PermissionAllow {
                updated_input: input,
                updated_permissions: None,
            }))),
        }
    }
}

fn options() -> ClaudeCodeOptions {
    ClaudeCodeOptions {
        abort_controller: None,
        additional_directories: None,
        allowed_tools: None,
        append_system_prompt: None,
        can_use_tool: Some(CanUseTool {}.boxed()),
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

struct PromptGen {
    receiver: UnboundedReceiver<String>,
}

impl PromptGenerator for PromptGen {
    fn poll_next(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> Poll<Option<SDKUserMessage>> {
        let prompt = ready!(self.get_mut().receiver.poll_recv(cx));
        let prompt = match prompt {
            Some(p) => p,
            None => return Poll::Ready(None),
        };
        let msg = SDKUserMessage {
            message: APIUserMessage {
                content: Arc::new(prompt).into(),
                role: cc_sdk::types::APIUserMessageRole::User,
            },
            parent_tool_use_id: None,
            uuid: None,
        };

        Poll::Ready(Some(msg))
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    set_tracing();
    tracing::info!("This is being logged on the info level");
    let options = options();
    let (tx, rx) = unbounded_channel();
    let prompt = PromptGen { receiver: rx };

    let mut claude = query(prompt, options).await?;

    let prompt = "Use the cat command to get the first 3 lines of the file Cargo.toml and write them to the file test-output.txt.";
    tx.send(prompt.to_owned()).unwrap();

    while let Some(msg) = claude.next().await {
        let msg = msg.unwrap();
        println!(
            "Got claude msg:\n{}",
            serde_json::to_string_pretty(&msg).unwrap()
        );

        if matches!(msg.typed, SDKMessageTyped::Result(..)) {
            break;
        }
    }

    println!("chat done");

    Ok(())
}
