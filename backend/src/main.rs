use actix_web::{App, HttpServer, web};
use anyhow::Result;
use server::websocket::ws_handler;
use tokio::signal;
use tracing::{Level, info};

mod api;

#[actix_web::main]
async fn main() -> Result<()> {
    init()?;

    tokio::spawn(server::start_manager());

    tokio::spawn(async {
        signal::ctrl_c().await.expect("failed to listen for event");
        info!("exiting...");
        std::process::exit(0);
    });

    let server = HttpServer::new(|| {
        App::new()
            .service(
                web::scope("/api")
                    .route("/home_path", web::get().to(api::home))
                    .route("/ls", web::get().to(api::ls))
                    .route("/connect", web::get().to(ws_handler))
                    .route("/load_sessions", web::get().to(api::load_sessions))
                    .route("/active_sessions", web::get().to(api::load_active_sessions))
                    .route("/reconnect_session", web::get().to(api::reconnect_session)),
            )
            .route("/api/connect", web::get().to(ws_handler))
    })
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
