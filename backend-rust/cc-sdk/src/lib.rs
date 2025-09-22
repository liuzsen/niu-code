use crate::{
    cli::{Prompt, QueryStream},
    types::ClaudeCodeOptions,
};

mod cli;

pub mod types;

pub async fn query<T>(prompt: T, options: ClaudeCodeOptions) -> anyhow::Result<QueryStream>
where
    Prompt: From<T>,
{
    cli::QueryStream::new(prompt, options).await
}
