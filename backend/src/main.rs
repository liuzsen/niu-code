use actix_web::{App, HttpServer};
use anyhow::Result;
use tokio::signal;
use tracing::{Level, info};

mod api;
mod embedded;

#[actix_web::main]
async fn main() -> Result<()> {
    if version_command() {
        println_version();
        return Ok(());
    }

    init()?;

    // Check if claude-code CLI is installed
    check_claude_cli();

    tokio::spawn(server::init());

    tokio::spawn(async {
        signal::ctrl_c().await.expect("failed to listen for event");
        info!("exiting...");
        std::process::exit(0);
    });

    info!("Starting Niu Code on http://127.0.0.1:33333");
    let server = HttpServer::new(|| App::new().configure(api::config))
        .bind(("127.0.0.1", 33333))?
        .run();
    server.await?;

    Ok(())
}

fn init() -> Result<()> {
    let subscriber = tracing_subscriber::fmt()
        .with_max_level(Level::DEBUG)
        .finish();

    tracing::subscriber::set_global_default(subscriber)?;

    Ok(())
}

fn version_command() -> bool {
    let args: Vec<_> = std::env::args().collect();
    let arg = args.get(1).map(|a| &**a);
    arg == Some("--version") || arg == Some("version")
}

fn println_version() {
    let version = env!("CARGO_PKG_VERSION");
    println!("v{}", version);
}

/// Check if claude-code CLI is installed and accessible
pub fn check_claude_cli() {
    match which::which("claude") {
        Ok(path) => {
            info!("Found claude-code CLI at: {:?}", path);
        }
        Err(e) => {
            tracing::warn!("⚠️  Claude Code CLI not found: {}", e);
            tracing::warn!("⚠️  Please install it with: npm install -g @anthropic-ai/claude-code");
            tracing::warn!("⚠️  The application will start but chat functionality may not work.");
        }
    }
}
