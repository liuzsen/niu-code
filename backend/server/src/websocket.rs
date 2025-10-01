use std::sync::{Arc, atomic::AtomicU32};

use actix_web::{Error, HttpRequest, HttpResponse, rt, web};
use actix_ws::{AggregatedMessage, AggregatedMessageStream, ProtocolError};
use anyhow::{Context, Result, bail};
use tokio::{
    select,
    sync::mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel},
};
use tokio_stream::StreamExt;
use tracing::{debug, warn};

use crate::{
    chat::{ChatManagerMessage, WsWriter, get_manager_mailbox},
    message::{ClientMessage, ServerMessage},
};

pub async fn ws_handler(req: HttpRequest, stream: web::Payload) -> Result<HttpResponse, Error> {
    debug!("new ws connection");

    let (res, session, stream) = actix_ws::handle(&req, stream)?;

    let stream = stream
        .aggregate_continuations()
        // aggregate continuation frames up to 1MiB
        .max_continuation_size(2_usize.pow(20));

    // start task but don't wait for it
    rt::spawn(async move {
        let ws = WsEndpoint::new(stream, session);
        match ws {
            Ok(ws) => {
                if let Err(err) = ws.run().await {
                    warn!(?err, "ws connection error");
                }
            }
            Err(err) => {
                warn!(?err, "cannot build ws endpoint");
            }
        }
    });

    Ok(res)
}

struct WsEndpoint {
    conn_id: u32,
    mailbox: UnboundedReceiver<ServerMessage>,
    manager_mailbox: UnboundedSender<ChatManagerMessage>,
    stream: AggregatedMessageStream,
    session: actix_ws::Session,
}

struct WsMessageAdapter {
    tx: UnboundedSender<ServerMessage>,
}

impl WsWriter for WsMessageAdapter {
    fn send_msg(&self, msg: ServerMessage) -> Result<()> {
        self.tx.send(msg).context("ws conection closed")?;
        Ok(())
    }
}

impl WsEndpoint {
    const CONN_ID: AtomicU32 = AtomicU32::new(0);

    fn new(stream: AggregatedMessageStream, session: actix_ws::Session) -> anyhow::Result<Self> {
        debug!("build endpoint");
        let conn_id = Self::CONN_ID.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let manager_mailbox = get_manager_mailbox();
        let (tx, rx) = unbounded_channel();

        manager_mailbox
            .send(ChatManagerMessage::NewConnect {
                conn_id: conn_id,
                ws_writer: Arc::new(WsMessageAdapter { tx }),
            })
            .context("manager is dead")?;

        Ok(Self {
            conn_id,
            mailbox: rx,
            manager_mailbox,
            stream,
            session,
        })
    }

    async fn run(mut self) -> Result<()> {
        let result = self.run_inner().await;

        // Notify manager that connection is closed
        let _ = self.manager_mailbox.send(ChatManagerMessage::ConnectionClosed {
            conn_id: self.conn_id,
        });

        result
    }

    async fn run_inner(&mut self) -> Result<()> {
        loop {
            select! {
                Some(msg) = self.stream.next() => {
                    self.handle_client_msg(msg).await?;
                }
                Some(msg) = self.mailbox.recv() => {
                    self.handle_msg(msg).await?;
                }
            }
        }
    }

    async fn handle_msg(&mut self, msg: ServerMessage) -> anyhow::Result<()> {
        let msg = serde_json::to_string(&msg)?;
        self.session.text(msg).await?;

        Ok(())
    }

    async fn handle_client_msg(
        &mut self,
        msg: Result<AggregatedMessage, ProtocolError>,
    ) -> anyhow::Result<()> {
        let msg = msg.context("invalid client msg")?;
        match msg {
            AggregatedMessage::Text(byte_string) => {
                let msg: ClientMessage = serde_json::from_str(&byte_string)?;
                let msg = ChatManagerMessage::ClientMessage {
                    conn_id: self.conn_id,
                    msg,
                };
                self.manager_mailbox.send(msg)?;
            }
            AggregatedMessage::Ping(bytes) => self.session.pong(&bytes).await?,
            AggregatedMessage::Close(close_reason) => {
                bail!("ws session closed. reason = {:?}", close_reason)
            }
            _ => {}
        }

        Ok(())
    }
}
