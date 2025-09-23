use actix_web::{App, HttpServer, web};
use anyhow::{Result, bail};
use server::websocket::ws_handler;
use tokio::signal;
use tracing::{Level, info};

#[actix_web::main]
async fn main() -> Result<()> {
    init()?;

    let server = HttpServer::new(|| App::new().route("/api/connect", web::get().to(ws_handler)))
        .bind(("127.0.0.1", 33333))?
        .run();

    let server = tokio::spawn(server);

    let manager = tokio::spawn(server::start_manager());

    tokio::spawn(async {
        signal::ctrl_c().await.expect("failed to listen for event");
        info!("exiting...");
        std::process::exit(0);
    });

    let result = tokio::try_join!(server, manager)?;
    match result {
        (Ok(_), Ok(_)) => unreachable!(),
        (Ok(_), Err(err)) => {
            bail!("Chat manager failed: {err:?}")
        }
        (Err(err), Ok(_)) => {
            bail!("actix-web failed: {err}")
        }
        (Err(_), Err(_)) => {
            unreachable!()
        }
    }
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
