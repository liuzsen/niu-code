use crate::{
    cli::{MyFrom, Prompt, QueryStream},
    types::ClaudeCodeOptions,
};

pub mod cli;
pub mod types;

pub use tokio_stream::{Stream, StreamExt};

pub async fn query<T>(prompt: T, options: ClaudeCodeOptions) -> anyhow::Result<QueryStream>
where
    Prompt: MyFrom<T>,
{
    cli::QueryStream::new(prompt, options).await
}
