use std::{
    collections::VecDeque,
    fs::File,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    sync::{Arc, OnceLock, RwLock},
};

use anyhow::{Context, Result};
use cc_sdk::types::APIUserMessage;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

use crate::setting::get_config_dir;

const MAX_PROMPTS: usize = 100;

/// 单条提示词记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptRecord {
    pub content: Arc<String>,
    pub timestamp: DateTime<Utc>,
    pub work_dir: Option<PathBuf>,
}

/// 提示词监听器 trait
pub trait PromptListener: Send + Sync {
    fn on_new_prompt(&self, prompt: &PromptRecord) -> Result<(), ()>;
}

pub type DynPromptListener = Arc<dyn PromptListener>;

/// 提示词中心 - 管理提示词的内存缓存和持久化
pub struct PromptHub {
    prompts: RwLock<VecDeque<PromptRecord>>,
    listeners: RwLock<Vec<DynPromptListener>>,
    storage_path: PathBuf,
}

impl std::fmt::Debug for PromptHub {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PromptHub")
            .field("prompts", &self.prompts)
            .field(
                "listeners",
                &format!("<{} listeners>", self.listeners.read().unwrap().len()),
            )
            .field("storage_path", &self.storage_path)
            .finish()
    }
}

impl PromptHub {
    /// 添加新提示词
    pub fn add_user_input(&self, prompt: APIUserMessage, work_dir: Option<PathBuf>) {
        match &*prompt.content {
            cc_sdk::types::UserContent::String(s) => {
                self.add_prompt(Arc::new(s.clone()), work_dir);
            }
            cc_sdk::types::UserContent::Vec(msgs) => {
                for msg in msgs {
                    match msg {
                        cc_sdk::types::anthropic::ContentBlockParam::Text(block) => {
                            self.add_prompt(block.text.clone(), work_dir.clone());
                        }
                        cc_sdk::types::anthropic::ContentBlockParam::Other(..) => {}
                    }
                }
            }
        }
    }

    /// 添加新提示词
    fn add_prompt(&self, content: Arc<String>, work_dir: Option<PathBuf>) {
        let record = PromptRecord {
            content: content.clone(),
            timestamp: Utc::now(),
            work_dir,
        };

        debug!("Adding new prompt: {}", content);

        // 添加到内存缓存
        {
            let mut prompts = self.prompts.write().unwrap();
            prompts.push_back(record.clone());

            // LRU: 超过最大数量时删除最老的
            if prompts.len() > MAX_PROMPTS {
                prompts.pop_front();
            }
        }

        // 持久化到文件
        if let Err(e) = self.append_to_file(&record) {
            warn!("Failed to append prompt to file: {}", e);
        }

        // 通知所有监听者
        self.notify_listeners(&record);
    }

    /// 添加监听者
    pub fn add_listener(&self, listener: DynPromptListener) {
        debug!("Adding prompt listener");
        for p in self.get_all_prompts() {
            if listener.on_new_prompt(&p).is_err() {
                info!("send init prompts failed");
                return;
            }
        }
        self.listeners.write().unwrap().push(listener);
    }

    /// 获取所有提示词（用于 SSE 初始响应）
    fn get_all_prompts(&self) -> Vec<PromptRecord> {
        self.prompts.read().unwrap().iter().cloned().collect()
    }

    fn new() -> Result<Self> {
        let niu_code_dir = get_config_dir();

        // 确保目录存在
        if !niu_code_dir.exists() {
            std::fs::create_dir_all(&niu_code_dir)
                .context("Failed to create .niu-code directory")?;
        }

        let storage_path = niu_code_dir.join("prompts.jsonl");
        info!("PromptHub storage path: {:?}", storage_path);

        let mut hub = Self {
            prompts: RwLock::new(VecDeque::new()),
            listeners: RwLock::new(Vec::new()),
            storage_path,
        };

        // 加载历史记录
        hub.load_from_file()?;

        Ok(hub)
    }

    /// 从文件加载历史记录
    fn load_from_file(&mut self) -> Result<()> {
        if !self.storage_path.exists() {
            info!("Prompt storage file does not exist yet");
            return Ok(());
        }

        let file = File::open(&self.storage_path).context("Failed to open prompts.jsonl")?;
        let reader = BufReader::new(file);

        let mut prompts = VecDeque::new();
        for line in reader.lines() {
            let line = line.context("Failed to read line from prompts.jsonl")?;
            if line.trim().is_empty() {
                continue;
            }

            match serde_json::from_str::<PromptRecord>(&line) {
                Ok(record) => prompts.push_back(record),
                Err(e) => {
                    warn!("Failed to parse prompt record: {}. Line: {}", e, line);
                }
            }
        }

        // 只保留最新的 MAX_PROMPTS 条
        while prompts.len() > MAX_PROMPTS {
            prompts.pop_front();
        }

        info!("Loaded {} prompts from file", prompts.len());
        *self.prompts.write().unwrap() = prompts;

        Ok(())
    }

    /// 追加记录到文件
    fn append_to_file(&self, record: &PromptRecord) -> Result<()> {
        let json = serde_json::to_string(record).context("Failed to serialize prompt record")?;

        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.storage_path)
            .context("Failed to open prompts.jsonl for appending")?;

        writeln!(file, "{}", json).context("Failed to write to prompts.jsonl")?;

        Ok(())
    }

    /// 通知所有监听者
    fn notify_listeners(&self, record: &PromptRecord) {
        let mut listeners = self.listeners.write().unwrap();
        listeners.retain(|listener| listener.on_new_prompt(record).is_ok());
    }
}

// 全局提示词中心实例
static PROMPT_HUB: OnceLock<Arc<PromptHub>> = OnceLock::new();

pub fn init() -> anyhow::Result<Arc<PromptHub>> {
    if let Some(p) = PROMPT_HUB.get() {
        return Ok(p.clone());
    }

    let p = Arc::new(PromptHub::new()?);
    Ok(PROMPT_HUB.get_or_init(|| p).clone())
}

/// 获取全局提示词中心实例
pub fn get_prompt_hub() -> Arc<PromptHub> {
    PROMPT_HUB
        .get()
        .expect("PromptHub not initialized. Call set_prompt_hub first.")
        .clone()
}
