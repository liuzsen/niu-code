use std::{ops::ControlFlow, sync::Arc};

use actix_web::{Error, HttpRequest, HttpResponse, rt, web};
use actix_ws::ProtocolError;
use anyhow::{Context, Result, bail};
use tokio::{
    select,
    sync::mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel},
};
use tokio_stream::StreamExt;
use tracing::{debug, warn};

use crate::{
    chat::{ChatManagerMessage, ConnId, WsWriter, get_manager_mailbox},
    message::{ClientMessage, ServerMessage},
};

use my_aggregate::{AggregatedMessage, AggregatedMessageStream};

pub async fn ws_handler(req: HttpRequest, stream: web::Payload) -> Result<HttpResponse, Error> {
    debug!("new ws connection");

    let (res, session, stream) = actix_ws::handle(&req, stream)?;
    let stream = stream.max_frame_size(10 * 1024 * 1024);

    let stream = AggregatedMessageStream::new(stream).max_continuation_size(10 * 1024 * 1024);

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
    conn_id: ConnId,
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
    fn new(stream: AggregatedMessageStream, session: actix_ws::Session) -> anyhow::Result<Self> {
        debug!("build endpoint");
        let conn_id = ConnId::generate();
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
        debug!(
            conn_id = %self.conn_id,
            "connection closed, notify the manager"
        );
        let _ = self
            .manager_mailbox
            .send(ChatManagerMessage::ConnectionClosed {
                conn_id: self.conn_id,
            });

        result
    }

    async fn run_inner(&mut self) -> Result<()> {
        loop {
            select! {
                msg = self.stream.next() => {
                    if self.handle_client_msg(msg).await?.is_break() {
                        break;
                    }
                }
                Some(msg) = self.mailbox.recv() => {
                    self.handle_msg(msg).await?;
                }
            }
        }

        Ok(())
    }

    async fn handle_msg(&mut self, msg: ServerMessage) -> anyhow::Result<()> {
        let msg = serde_json::to_string(&msg)?;
        self.session.text(msg).await?;

        Ok(())
    }

    async fn handle_client_msg(
        &mut self,
        msg: Option<Result<AggregatedMessage, ProtocolError>>,
    ) -> anyhow::Result<ControlFlow<()>> {
        let Some(msg) = msg else {
            self.manager_mailbox
                .send(ChatManagerMessage::ConnectionClosed {
                    conn_id: self.conn_id,
                })?;
            return Ok(ControlFlow::Break(()));
        };
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
            AggregatedMessage::Binary(bytes) => {
                let msg: ClientMessage = serde_json::from_slice(&bytes)?;
                let msg = ChatManagerMessage::ClientMessage {
                    conn_id: self.conn_id,
                    msg,
                };
                self.manager_mailbox.send(msg)?;
            }
            AggregatedMessage::Pong(..) => {}
        }

        Ok(ControlFlow::Continue(()))
    }
}

mod my_aggregate {
    //! WebSocket stream for aggregating continuation frames.

    use std::{
        io, mem,
        pin::Pin,
        task::{Context, Poll, ready},
    };

    use actix_http::ws::{CloseReason, Item, Message, ProtocolError};
    use actix_web::web::{Bytes, BytesMut};
    use bytestring::ByteString;
    use futures_core::Stream;

    use actix_ws::MessageStream;

    pub(crate) enum ContinuationKind {
        Text,
        Binary,
    }

    /// WebSocket message with any continuations aggregated together.
    #[derive(Debug, PartialEq, Eq)]
    pub enum AggregatedMessage {
        /// Text message.
        Text(ByteString),

        /// Binary message.
        Binary(Bytes),

        /// Ping message.
        Ping(Bytes),

        /// Pong message.
        Pong(Bytes),

        /// Close message with optional reason.
        Close(Option<CloseReason>),
    }

    /// Stream of messages from a WebSocket client, with continuations aggregated.
    pub struct AggregatedMessageStream {
        stream: MessageStream,
        current_size: usize,
        max_size: usize,
        continuations: Vec<Bytes>,
        continuation_kind: ContinuationKind,
    }

    impl AggregatedMessageStream {
        #[must_use]
        pub(crate) fn new(stream: MessageStream) -> Self {
            AggregatedMessageStream {
                stream,
                current_size: 0,
                max_size: 1024 * 1024,
                continuations: Vec::new(),
                continuation_kind: ContinuationKind::Binary,
            }
        }

        /// Sets the maximum allowed size for aggregated continuations, in bytes.
        ///
        /// By default, up to 1 MiB is allowed.
        ///
        /// ```no_run
        /// # use actix_ws::AggregatedMessageStream;
        /// # async fn test(stream: AggregatedMessageStream) {
        /// // increase the allowed size from 1MB to 8MB
        /// let mut stream = stream.max_continuation_size(8 * 1024 * 1024);
        ///
        /// while let Some(Ok(msg)) = stream.recv().await {
        ///     // handle message
        /// }
        /// # }
        /// ```
        #[must_use]
        pub fn max_continuation_size(mut self, max_size: usize) -> Self {
            self.max_size = max_size;
            self
        }
    }

    fn size_error() -> Poll<Option<Result<AggregatedMessage, ProtocolError>>> {
        Poll::Ready(Some(Err(ProtocolError::Io(io::Error::other(
            "Exceeded maximum continuation size",
        )))))
    }

    impl Stream for AggregatedMessageStream {
        type Item = Result<AggregatedMessage, ProtocolError>;

        fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
            let this = self.get_mut();

            loop {
                let Some(msg) = ready!(Pin::new(&mut this.stream).poll_next(cx)?) else {
                    return Poll::Ready(None);
                };

                match msg {
                    Message::Continuation(item) => match item {
                        Item::FirstText(bytes) => {
                            this.continuation_kind = ContinuationKind::Text;
                            this.current_size += bytes.len();

                            if this.current_size > this.max_size {
                                this.continuations.clear();
                                return size_error();
                            }

                            this.continuations.push(bytes);

                            continue;
                        }

                        Item::FirstBinary(bytes) => {
                            this.continuation_kind = ContinuationKind::Binary;
                            this.current_size += bytes.len();

                            if this.current_size > this.max_size {
                                this.continuations.clear();
                                return size_error();
                            }

                            this.continuations.push(bytes);

                            continue;
                        }

                        Item::Continue(bytes) => {
                            this.current_size += bytes.len();

                            if this.current_size > this.max_size {
                                this.continuations.clear();
                                return size_error();
                            }

                            this.continuations.push(bytes);

                            continue;
                        }

                        Item::Last(bytes) => {
                            this.current_size += bytes.len();

                            if this.current_size > this.max_size {
                                // reset current_size, as this is the last message for
                                // the current continuation
                                this.current_size = 0;
                                this.continuations.clear();

                                return size_error();
                            }

                            this.continuations.push(bytes);
                            let bytes = collect(&mut this.continuations);

                            this.current_size = 0;

                            match this.continuation_kind {
                                ContinuationKind::Text => {
                                    return Poll::Ready(Some(match ByteString::try_from(bytes) {
                                        Ok(bytestring) => Ok(AggregatedMessage::Text(bytestring)),
                                        Err(err) => Err(ProtocolError::Io(io::Error::new(
                                            io::ErrorKind::InvalidData,
                                            err.to_string(),
                                        ))),
                                    }));
                                }
                                ContinuationKind::Binary => {
                                    return Poll::Ready(Some(Ok(AggregatedMessage::Binary(bytes))));
                                }
                            }
                        }
                    },

                    Message::Text(text) => {
                        return Poll::Ready(Some(Ok(AggregatedMessage::Text(text))));
                    }
                    Message::Binary(binary) => {
                        return Poll::Ready(Some(Ok(AggregatedMessage::Binary(binary))));
                    }
                    Message::Ping(ping) => {
                        return Poll::Ready(Some(Ok(AggregatedMessage::Ping(ping))));
                    }
                    Message::Pong(pong) => {
                        return Poll::Ready(Some(Ok(AggregatedMessage::Pong(pong))));
                    }
                    Message::Close(close) => {
                        return Poll::Ready(Some(Ok(AggregatedMessage::Close(close))));
                    }

                    Message::Nop => unreachable!("MessageStream should not produce no-ops"),
                }
            }
        }
    }

    fn collect(continuations: &mut Vec<Bytes>) -> Bytes {
        let continuations = mem::take(continuations);
        let total_len = continuations.iter().map(|b| b.len()).sum();

        let mut buf = BytesMut::with_capacity(total_len);

        for chunk in continuations {
            buf.extend(chunk);
        }

        buf.freeze()
    }
}
