use actix_web::{App, HttpServer};
use anyhow::Result;
use tokio::signal;
use tracing::{Level, info};

mod api;

#[actix_web::main]
async fn main() -> Result<()> {
    init()?;

    tokio::spawn(server::init());

    tokio::spawn(async {
        signal::ctrl_c().await.expect("failed to listen for event");
        info!("exiting...");
        std::process::exit(0);
    });

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
