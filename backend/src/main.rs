use actix_web::{App, HttpServer};
use anyhow::Result;
use tokio::signal;
use tracing::{Level, info};

mod api;
mod embedded;

#[actix_web::main]
async fn main() -> Result<()> {
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
        // filter spans/events with level TRACE or higher.
        .with_max_level(Level::DEBUG)
        // build but do not install the subscriber.
        .finish();

    tracing::subscriber::set_global_default(subscriber)?;

    Ok(())
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
