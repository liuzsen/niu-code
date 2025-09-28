use actix_web::{App, HttpServer, web};
use anyhow::Result;
use server::websocket::ws_handler;
use tokio::signal;
use tracing::{Level, info};

#[actix_web::main]
async fn main() -> Result<()> {
    init()?;

    tokio::spawn(server::start_manager());

    tokio::spawn(async {
        signal::ctrl_c().await.expect("failed to listen for event");
        info!("exiting...");
        std::process::exit(0);
    });

    let server = HttpServer::new(|| App::new().route("/api/connect", web::get().to(ws_handler)))
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
