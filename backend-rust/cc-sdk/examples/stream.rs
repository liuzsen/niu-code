use std::{
    collections::HashMap,
    path::PathBuf,
    task::{Poll, ready},
};

use cc_sdk::{
    cli::PromptGenerator,
    query,
    types::{APIUserMessage, ClaudeCodeOptions, DebugCallBack, SDKMessage, SDKUserMessage},
};
use tokio::sync::mpsc::{UnboundedReceiver, unbounded_channel};
use tokio_stream::StreamExt;
use tracing::{Level, info};
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

fn options() -> ClaudeCodeOptions {
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
    ) -> std::task::Poll<Option<SDKUserMessage>> {
        let prompt = ready!(self.get_mut().receiver.poll_recv(cx));
        let prompt = match prompt {
            Some(p) => p,
            None => return Poll::Ready(None),
        };
        let msg = SDKUserMessage {
            uuid: None,
            session_id: "".to_string(),
            message: APIUserMessage {
                content: prompt,
                role: cc_sdk::types::APIUserMessageRole::User,
            },
            parent_tool_use_id: None,
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
    let mut has_followed_up = false;

    // Send the first prompt only after the stream is fully initialized.
    // Sending it too early may cause runtime errors: Already initialized.
    let p = "What is th answer to the Ultimate Question of Life, the Universe, and Everything";
    tx.send(p.to_string()).unwrap();

    while let Some(msg) = claude.next().await {
        println!("{}", serde_json::to_string_pretty(&msg).unwrap());

        if matches!(msg, SDKMessage::Result(..)) {
            if !has_followed_up {
                info!("send the second question");
                let p = "What is the source of your answer?";
                tx.send(p.to_string()).unwrap();
                has_followed_up = true;
            } else {
                break;
            }
        }
    }

    println!("chat done");

    Ok(())
}
