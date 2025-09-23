use std::{
    collections::HashMap,
    ffi::OsStr,
    fmt::Debug,
    ops::ControlFlow,
    path::{Path, PathBuf},
    pin::Pin,
    process::Stdio,
    task::{Context, Poll},
};

use anyhow::{Context as _, Result, bail};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tokio::{
    io::AsyncWriteExt,
    process::{Child, ChildStdin, Command},
    select,
    sync::{
        mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel},
        oneshot,
    },
};
use tokio_stream::{Stream, StreamExt};
use tokio_util::codec::{FramedRead, LinesCodec};
use tracing::{debug, error, info, warn};
use which::which;

use crate::types::{
    BoxedCanUseTollCallback, ClaudeCodeOptions, DebugCallBack, Executable, PermissionMode,
    PermissionUpdate, SDKMessage, SDKUserMessage, ToolInputSchemas,
};

pub trait PromptGenerator: Send + Unpin + 'static {
    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<SDKUserMessage>>;
}

impl Stream for Box<dyn PromptGenerator> {
    type Item = SDKUserMessage;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let this = &mut **self.get_mut();
        let this = Pin::new(this);
        PromptGenerator::poll_next(this, cx)
    }
}

pub enum Prompt {
    Oneshot(String),
    Stream(Box<dyn PromptGenerator>),
}

pub trait MyFrom<T> {
    fn my_from(v: T) -> Self;
}

impl<T> MyFrom<T> for Prompt
where
    T: PromptGenerator,
{
    fn my_from(v: T) -> Self {
        Self::Stream(Box::new(v))
    }
}

impl MyFrom<String> for Prompt {
    fn my_from(v: String) -> Self {
        Prompt::Oneshot(v)
    }
}

impl MyFrom<&'static str> for Prompt {
    fn my_from(v: &'static str) -> Self {
        Prompt::Oneshot(v.to_owned())
    }
}

impl Prompt {
    fn is_oneshot(&self) -> bool {
        matches!(self, Prompt::Oneshot(..))
    }
}

impl<T> From<Box<T>> for Prompt
where
    T: PromptGenerator,
{
    fn from(value: Box<T>) -> Self {
        Self::Stream(value)
    }
}

impl From<Box<dyn PromptGenerator>> for Prompt {
    fn from(value: Box<dyn PromptGenerator>) -> Self {
        Self::Stream(value)
    }
}

impl From<&'static str> for Prompt {
    fn from(value: &'static str) -> Self {
        let s = value.to_owned();
        s.into()
    }
}

impl From<String> for Prompt {
    fn from(value: String) -> Self {
        Prompt::Oneshot(value)
    }
}

pub struct QueryStream {
    receiver: UnboundedReceiver<SDKMessage>,
    writer_chan: Option<UnboundedSender<ClaudeWriterMessage>>,
    claude_sys_info: Option<ClaudeSysInfo>,
}

impl Stream for QueryStream {
    type Item = SDKMessage;

    fn poll_next(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Option<Self::Item>> {
        self.as_mut().receiver.poll_recv(cx)
    }
}

struct ClaudeReader {
    stdout: tokio::process::ChildStdout,
    ctrl_chan: UnboundedSender<ControlMessage>,
    output_chan: UnboundedSender<SDKMessage>,
}

struct ClaudeWriter {
    prompt: Box<dyn PromptGenerator>,
    claude_stdin: ChildStdin,
    receiver: UnboundedReceiver<ClaudeWriterMessage>,
}

struct ControlHandler {
    receiver: UnboundedReceiver<ControlMessage>,
    wirter_chan: Option<UnboundedSender<ClaudeWriterMessage>>,
    can_use_cb: Option<BoxedCanUseTollCallback>,
    resp_chans: HashMap<String, oneshot::Sender<Value>>,
}

pub enum ClaudeWriterMessage {
    Write(Value),
}

pub enum ControlMessage {
    ControlRequest(Value),
    ControlResponse(Value),
    RegisterResponseChan {
        id: String,
        chan: oneshot::Sender<Value>,
    },
}

impl ClaudeReader {
    fn spawn(self) {
        tokio::spawn(async move {
            if let Err(err) = self.run().await {
                warn!(?err, "ClaudeReader error");
            }
        });
    }

    async fn run(self) -> Result<()> {
        let Self {
            ctrl_chan,
            output_chan,
            stdout,
        } = self;

        let mut reader = FramedRead::new(stdout, LinesCodec::new());

        while let Some(line) = reader.next().await {
            let line = line.context("Failed to read claude code stdout")?;

            let msg: Value = serde_json::from_str(&line)?;
            let Some(ty) = &msg["type"].as_str() else {
                warn!(?msg, "Unkown message type from claude");
                continue;
            };

            match *ty {
                "control_response" => {
                    Self::send_ctrl_resp(&ctrl_chan, msg);
                }
                "control_request" => {
                    Self::send_ctrl_req(&ctrl_chan, msg);
                }
                "control_cancel_request" => {
                    warn!(msg = line, "control_cancel_request is unsupported");
                }
                _ => {
                    if Self::send_out_message(&output_chan, msg)?.is_break() {
                        break;
                    }
                }
            }
        }

        Ok(())
    }

    fn send_out_message(chan: &UnboundedSender<SDKMessage>, msg: Value) -> Result<ControlFlow<()>> {
        let msg = serde_json::from_value(msg)?;
        if let Err(_) = chan.send(msg) {
            info!("output chan closed, exit claude reader");
            return Ok(ControlFlow::Break(()));
        }

        Ok(ControlFlow::Continue(()))
    }

    fn send_ctrl_resp(chan: &UnboundedSender<ControlMessage>, msg: Value) {
        chan.send(ControlMessage::ControlResponse(msg))
            .expect("ctrl chan closed before reader");
    }

    fn send_ctrl_req(chan: &UnboundedSender<ControlMessage>, msg: Value) {
        chan.send(ControlMessage::ControlRequest(msg))
            .expect("ctrl chan closed before reader");
    }
}

impl ClaudeWriter {
    fn spawn(self) {
        tokio::spawn(async move {
            if let Err(err) = self.run().await {
                warn!(?err, "ClaudeWriter error");
            }
        });
    }

    async fn run(mut self) -> anyhow::Result<()> {
        loop {
            select! {
                Some(p) = self.prompt.next() => {
                    debug!("send prompt msg to cli");
                    self.write_msg(p.to_sdk_msg()).await?;
                }
                Some(msg) = self.receiver.recv() => {
                    self.handle_msg(msg).await?;
                }
            }
        }
    }

    async fn handle_msg(&mut self, msg: ClaudeWriterMessage) -> anyhow::Result<()> {
        match msg {
            ClaudeWriterMessage::Write(value) => {
                debug!("send direct msg to claude cli");
                self.write_msg(value).await?;
            }
        }
        Ok(())
    }

    async fn write_msg<T: Serialize + Debug>(&mut self, msg: T) -> Result<()> {
        let mut msg = serde_json::to_string(&msg)
            .with_context(|| format!("Failed to serialize msg: {msg:?}"))?;
        msg.push('\n');
        self.claude_stdin.write_all(msg.as_bytes()).await?;

        Ok(())
    }
}

#[derive(Serialize, Deserialize)]
pub struct ControlRequstMessageWrapper {
    request_id: String,
    request: ControlRequstMessage,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "subtype")]
#[serde(rename_all = "snake_case")]
pub enum ControlRequstMessage {
    CanUseTool(CanUseToolRequest),
    HookCallback(HookCallbackRequest),
    McpMessage(McpMessageRequest),
}

#[derive(Serialize, Deserialize)]
pub struct McpMessageRequest {
    server_name: String,
    message: Value,
}

#[derive(Serialize, Deserialize)]
pub struct HookCallbackRequest {
    callback_id: String,
    input: ToolInputSchemas,
    tool_use_id: String,
}

#[derive(Serialize, Deserialize)]
pub struct CanUseToolRequest {
    tool_name: String,
    input: ToolInputSchemas,
    permission_suggestions: Option<Vec<PermissionUpdate>>,
}

impl ControlHandler {
    fn spawn(self) {
        tokio::spawn(async move {
            if let Err(err) = self.run().await {
                warn!(?err, "ControlHandler error");
            }
        });
    }

    async fn run(mut self) -> anyhow::Result<()> {
        while let Some(msg) = self.receiver.recv().await {
            match msg {
                ControlMessage::ControlRequest(value) => {
                    self.handle_ctrl_req(value).await?;
                }
                ControlMessage::ControlResponse(value) => {
                    self.handle_ctrl_resp(value).await;
                }
                ControlMessage::RegisterResponseChan { id, chan } => {
                    self.register_resp_chan(id, chan);
                }
            }
        }

        info!("No more message. ControlHandler exited");

        Ok(())
    }

    async fn handle_ctrl_req(&mut self, value: Value) -> Result<()> {
        let msg: ControlRequstMessageWrapper =
            serde_json::from_value(value.clone()).with_context(|| {
                let msg = serde_json::to_string_pretty(&value).unwrap();
                format!("Cannot deserialize control request msg: {msg}")
            })?;

        let res = self.process_control_request(msg.request).await;
        match res {
            Ok(resp) => {
                let resp = json!({
                  "type": "control_response",
                  "response": {
                    "subtype": "success",
                    "request_id": msg.request_id,
                    "response": resp
                  }
                });
                tracing::error!(
                    "send ctrl resp: {}",
                    serde_json::to_string_pretty(&resp).unwrap()
                );
                self.send_write(resp).await?;
            }
            Err(err) => {
                let resp = json!({
                  "type": "control_response",
                  "response": {
                    "subtype": "error",
                    "request_id": msg.request_id,
                    "error": format!("{err:?}")
                  }
                });
                self.send_write(resp).await?;
            }
        }

        Ok(())
    }

    async fn send_write(&self, msg: Value) -> Result<()> {
        if let Some(tx) = &self.wirter_chan {
            tx.send(ClaudeWriterMessage::Write(msg))?;
            Ok(())
        } else {
            bail!("No writer chan in ControlHandler")
        }
    }

    async fn process_control_request(&mut self, msg: ControlRequstMessage) -> Result<Value> {
        match msg {
            ControlRequstMessage::CanUseTool(req) => {
                let Some(cb) = &mut self.can_use_cb else {
                    bail!("canUseTool callback is not provided.")
                };

                let CanUseToolRequest {
                    tool_name,
                    input,
                    permission_suggestions,
                } = req;

                let resp = cb
                    .call(tool_name, input, permission_suggestions)
                    .await
                    .context("CanUseTool call error")?;

                Ok(serde_json::to_value(resp).unwrap())
            }
            ControlRequstMessage::HookCallback(..) => {
                bail!("unsupported HookCallback")
            }
            ControlRequstMessage::McpMessage(..) => {
                bail!("unsupported McpMessage")
            }
        }
    }

    async fn handle_ctrl_resp(&mut self, mut msg: Value) {
        if let Value::String(id) = &msg["response"]["request_id"] {
            let Some(chan) = self.resp_chans.remove(id) else {
                return;
            };
            let resp = msg.as_object_mut().unwrap().remove("response").unwrap();
            let _ = chan.send(resp); // ignore error
        } else {
            warn!(?msg, "Unkown control_response from claude");
        }
    }

    fn register_resp_chan(&mut self, id: String, chan: oneshot::Sender<Value>) {
        self.resp_chans.insert(id, chan);
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SlashCommand {
    name: String,
    description: String,
    argument_hint: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub value: String,
    pub display_name: String,
    pub description: String,
}

pub struct ClaudeSysInfo {
    pub supported_commands: Vec<SlashCommand>,
    pub models: Vec<ModelInfo>,
}

impl QueryStream {
    pub async fn new<T>(prompt: T, mut options: ClaudeCodeOptions) -> anyhow::Result<Self>
    where
        Prompt: MyFrom<T>,
    {
        let prompt = Prompt::my_from(prompt);
        let mut child = spawn_cc_cli(&prompt, &options)?;
        debug!("claude code cli running");

        let stderr_db = options.stderr.take();
        if child.has_stderr {
            handle_stderr(stderr_db, child.inner.stderr.take().unwrap());
        }

        let (ctrl_tx, ctrl_rx) = unbounded_channel();
        let (out_tx, out_rx) = unbounded_channel();

        let reader = ClaudeReader {
            stdout: child.inner.stdout.take().unwrap(),
            ctrl_chan: ctrl_tx.clone(),
            output_chan: out_tx,
        };
        reader.spawn();

        let mut writer_tx = None;
        if let Prompt::Stream(stream) = prompt {
            let (tx, rx) = unbounded_channel();
            let writer = ClaudeWriter {
                prompt: stream,
                claude_stdin: child.inner.stdin.take().unwrap(),
                receiver: rx,
            };
            writer_tx = Some(tx);
            writer.spawn();
        }

        let can_use_tool_cb = options.can_use_tool.take();
        let ctrl_handler = ControlHandler {
            receiver: ctrl_rx,
            wirter_chan: writer_tx.clone(),
            can_use_cb: can_use_tool_cb,
            resp_chans: Default::default(),
        };
        ctrl_handler.spawn();

        let mut sys_info = None;
        if let Some(write_tx) = &writer_tx {
            let info = Self::get_init_info(write_tx, &ctrl_tx).await?;
            sys_info = Some(info);
        }

        Ok(Self {
            receiver: out_rx,
            writer_chan: writer_tx,
            claude_sys_info: sys_info,
        })
    }

    async fn get_init_info(
        wirter_tx: &UnboundedSender<ClaudeWriterMessage>,
        ctrl_tx: &UnboundedSender<ControlMessage>,
    ) -> Result<ClaudeSysInfo> {
        debug!("get claude system init info");
        let id = gen_request_id();
        let req = json!({
          "request_id": &id,
          "type": "control_request",
          "request": {
            "subtype": "initialize"
          }
        });
        wirter_tx.send(ClaudeWriterMessage::Write(req)).unwrap();
        let (tx, rx) = oneshot::channel();
        ctrl_tx
            .send(ControlMessage::RegisterResponseChan { id: id, chan: tx })
            .unwrap();
        let res = rx.await.context("Failed to wait claude sys info")?;
        debug!("got claude system info");
        let commands = &res["response"]["commands"];
        let models = &res["response"]["models"];
        let commands = serde_json::from_value(commands.clone())?;
        let models = serde_json::from_value(models.clone())?;

        Ok(ClaudeSysInfo {
            supported_commands: commands,
            models,
        })
    }

    pub fn interrupt(&self) -> Result<()> {
        self.send_req(QueryCommand::Interrupt {})
    }

    pub fn set_permission_mode(&self, mode: PermissionMode) -> Result<()> {
        self.send_req(QueryCommand::SetPermissionMode { mode })
    }

    pub fn set_model(&self, model: String) -> Result<()> {
        self.send_req(QueryCommand::SetModel { model })
    }

    pub fn supported_commands(&self) -> Result<Vec<SlashCommand>> {
        let Some(info) = &self.claude_sys_info else {
            bail!("supportedCommands is only supported in streaming mode")
        };

        Ok(info.supported_commands.clone())
    }

    pub fn supported_models(&self) -> Result<Vec<ModelInfo>> {
        let Some(info) = &self.claude_sys_info else {
            bail!("supportedCommands is only supported in streaming mode")
        };

        Ok(info.models.clone())
    }

    fn send_req(&self, sub_type: QueryCommand) -> anyhow::Result<()> {
        let Some(writer_tx) = &self.writer_chan else {
            bail!("{} requires --input-format stream-json", sub_type.name());
        };

        let id = gen_request_id();
        let req = json!({
          "request_id": &id,
          "type": "control_request",
          "request": sub_type
        });
        if let Err(err) = writer_tx.send(ClaudeWriterMessage::Write(req)) {
            info!(?err, "Failed to send msg to claude writer")
        }

        Ok(())
    }
}

fn gen_request_id() -> String {
    nanoid::nanoid!()
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "subtype")]
#[serde(rename_all = "snake_case")]
pub enum QueryCommand {
    Interrupt {},
    SetPermissionMode { mode: PermissionMode },
    SetModel { model: String },
}

impl QueryCommand {
    pub fn name(&self) -> &'static str {
        match self {
            QueryCommand::Interrupt {} => "interrupt",
            QueryCommand::SetPermissionMode { .. } => "set_permission_mode",
            QueryCommand::SetModel { .. } => "set_model",
        }
    }
}

fn handle_stderr(err_cb: Option<Box<dyn DebugCallBack>>, stderr: tokio::process::ChildStderr) {
    if let Some(err_cb) = err_cb {
        tokio::spawn(async move {
            let mut reader = FramedRead::new(stderr, LinesCodec::new());
            while let Some(data) = reader.next().await {
                match data {
                    Ok(d) => {
                        err_cb.call(d);
                    }
                    Err(err) => {
                        error!(%err, "Failed to read claude code stderr");
                    }
                }
            }
        });
    } else {
        tokio::spawn(async move {
            let mut reader = FramedRead::new(stderr, LinesCodec::new());
            while let Some(data) = reader.next().await {
                match data {
                    Ok(d) => {
                        debug!("claude code stderr: {d}")
                    }
                    Err(err) => {
                        error!(%err, "Failed to read claude code stderr");
                    }
                }
            }
        });
    }
}

struct ClaudeProcess {
    inner: Child,
    has_stderr: bool,
}

fn spawn_cc_cli(prompt: &Prompt, options: &ClaudeCodeOptions) -> anyhow::Result<ClaudeProcess> {
    let ClaudeCodeOptions {
        abort_controller: _,
        additional_directories,
        allowed_tools,
        append_system_prompt,
        can_use_tool,
        r#continue,
        custom_system_prompt,
        cwd,
        disallowed_tools,
        env,
        executable,
        executable_args,
        extra_args,
        fallback_model,
        hooks: _,
        include_partial_messages,
        max_thinking_tokens: _,
        max_turns,
        mcp_servers: _,
        model,
        path_to_claude_code_executable,
        permission_mode,
        permission_prompt_tool_name,
        resume,
        stderr: _, // use later
        strict_mcp_config,
    } = options;

    info!("spawn claude child process");

    #[derive(Default)]
    struct ArgCollector<'a> {
        args: Vec<Box<dyn AsRef<OsStr> + 'a>>,
    }

    impl<'a> ArgCollector<'a> {
        fn arg<T: AsRef<OsStr> + 'a>(&mut self, arg: T) -> &mut Self {
            self.args.push(Box::new(arg));
            self
        }
    }

    let mut args = ArgCollector::default();

    // Base arguments for stream output
    args.arg("--output-format").arg("stream-json");
    args.arg("--verbose");

    // Add custom system prompt
    if let Some(prompt) = custom_system_prompt {
        args.arg("--system-prompt").arg(prompt);
    }

    // Add append system prompt
    if let Some(append_prompt) = append_system_prompt {
        args.arg("--append-system-prompt").arg(append_prompt);
    }

    // Add max turns
    if let Some(max_turns) = max_turns {
        args.arg("--max-turns").arg(max_turns.to_string());
    }

    // Add model
    if let Some(model) = model {
        args.arg("--model").arg(model);
    }

    // Add debug flag if DEBUG env var is set
    if let Some(env) = env {
        if env.get("DEBUG").is_some() {
            args.arg("--debug-to-stderr");
        }
    }

    // Handle can_use_tool and permission_prompt_tool_name
    if can_use_tool.is_some() {
        if prompt.is_oneshot() {
            bail!(
                "canUseTool callback requires --input-format stream-json. Please set prompt as an AsyncIterable."
            )
        }
        if permission_prompt_tool_name.is_some() {
            bail!(
                "canUseTool callback cannot be used with permissionPromptToolName. Please use one or the other."
            );
        }
        args.arg("--permission-prompt-tool").arg("stdio");
    } else if let Some(tool_name) = permission_prompt_tool_name {
        args.arg("--permission-prompt-tool").arg(tool_name);
    }

    // Add continue flag
    if r#continue.unwrap_or(false) {
        args.arg("--continue");
    }

    // Add resume flag
    if let Some(resume) = resume {
        args.arg("--resume").arg(resume);
    }

    // Add allowed tools
    if let Some(allowed_tools) = allowed_tools {
        if !allowed_tools.is_empty() {
            args.arg("--allowedTools").arg(allowed_tools.join(","));
        }
    }

    // Add disallowed tools
    if let Some(disallowed_tools) = disallowed_tools {
        if !disallowed_tools.is_empty() {
            args.arg("--disallowedTools")
                .arg(disallowed_tools.join(","));
        }
    }
    // TODO: add mcp config here

    if strict_mcp_config == &Some(true) {
        args.arg("--strict-mcp-config");
    }

    // Add permission mode
    if let Some(permission_mode) = permission_mode {
        if !matches!(permission_mode, PermissionMode::Default) {
            args.arg("--permission-mode").arg(permission_mode.as_str());
        }
    }

    // Add fallback model
    if let Some(fallback_model) = fallback_model {
        if model.as_ref() == Some(&fallback_model) {
            bail!(
                "Fallback model cannot be the same as the main model. Please specify a different model for fallbackModel option."
            )
        }
        args.arg("--fallback-model").arg(fallback_model);
    }

    if include_partial_messages.unwrap_or(false) {
        args.arg("--include-partial-messages");
    }

    // input format
    if let Prompt::Oneshot(prompt) = prompt {
        args.arg("--print").arg("--").arg(prompt.trim());
    } else {
        args.arg("--input-format").arg("stream-json");
    }

    // Add additional directories
    if let Some(directories) = additional_directories {
        for dir in directories {
            args.arg("--add-dir").arg(dir);
        }
    }

    if let Some(ext_args) = extra_args {
        for (k, v) in ext_args {
            match v {
                Some(v) => {
                    args.arg(format!("--{k}")).arg(v);
                }
                None => {
                    args.arg(format!("--{k}"));
                }
            }
        }
    }

    let bin_path = path_to_claude_code_executable
        .as_deref()
        .unwrap_or_else(|| Path::new("claude"));
    let path = &*bin_path.to_string_lossy();
    let claude_bin_path = if is_command(path) {
        match find_command_real_path(path)? {
            Some(p) => p,
            None => {
                bail!("Failed to find claude command. Did you install it")
            }
        }
    } else {
        bin_path.to_owned()
    };

    let is_native = is_native_binary(&claude_bin_path);
    if !claude_bin_path.exists() {
        if is_native {
            bail!(
                "Claude Code native binary not found at {claude_bin_path:?}. Please ensure Claude Code is installed via native installer or specify a valid path with options.pathToClaudeCodeExecutable."
            );
        } else {
            bail!(
                "Claude Code executable not found at {claude_bin_path:?}. Is options.pathToClaudeCodeExecutable set?"
            )
        }
    }

    let command = if is_native {
        &claude_bin_path.to_string_lossy()
    } else {
        match executable {
            Some(e) => e.as_str(),
            None => default_claude_runtime()?.as_str(),
        }
    };
    let args = args
        .args
        .iter()
        .map(|a| (&**a).as_ref())
        .collect::<Vec<_>>();

    let args = if is_native {
        args
    } else {
        let mut execute_args = match &executable_args {
            Some(e) => e.iter().map(|a| a.as_ref()).collect(),
            None => {
                vec![]
            }
        };
        execute_args.push(claude_bin_path.as_os_str());
        execute_args.extend(args);

        execute_args
    };

    let mut cmd = Command::new(command);
    cmd.args(args);

    cmd.stdout(Stdio::piped());

    let mut has_stderr = false;
    if let Some(env) = env {
        if env.contains_key("DEBUG") {
            has_stderr = true;
            cmd.stderr(Stdio::piped());
        }
    }

    if prompt.is_oneshot() {
        cmd.stdin(Stdio::null());
    } else {
        cmd.stdin(Stdio::piped());
    }

    if let Ok(value) = std::env::var("CLAUDE_CODE_ENTRYPOINT") {
        cmd.env("CLAUDE_CODE_ENTRYPOINT", value);
    } else {
        cmd.env("CLAUDE_CODE_ENTRYPOINT", "sdk-rs");
    }

    // Add working directory
    if let Some(cwd) = cwd {
        cmd.current_dir(cwd);
    }

    // Set environment variables
    if let Some(env_vars) = env {
        for (key, value) in env_vars {
            cmd.env(key, value);
        }
    }

    let child = cmd.spawn()?;

    Ok(ClaudeProcess {
        inner: child,
        has_stderr,
    })
}

fn default_claude_runtime() -> anyhow::Result<Executable> {
    // TODO: find available runtime
    Ok(Executable::Node)
}

fn is_native_binary(path: &Path) -> bool {
    static JS_EXTENSIONS: &[&str] = &[".js", ".mjs", ".tsx", ".ts", ".jsx"];
    !JS_EXTENSIONS.iter().any(|ext| path.ends_with(ext))
}

fn is_command(cmd: &str) -> bool {
    let path = Path::new(cmd);
    path.parent() == Some(Path::new(""))
}

fn find_command_real_path(cmd: &str) -> Result<Option<PathBuf>> {
    if !is_command(cmd) {
        return Ok(None);
    }

    let path = which(cmd).with_context(|| format!("Failed to find command path: {cmd}"))?;

    Ok(Some(path))
}
