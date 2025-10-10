use std::{
    collections::VecDeque,
    fs::File,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    sync::{Arc, OnceLock, RwLock},
};

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

const MAX_PROMPTS: usize = 100;

/// 单条提示词记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptRecord {
    pub content: Arc<String>,
    pub timestamp: DateTime<Utc>,
    pub work_dir: Option<PathBuf>,
}

#[test]
fn aa() {
    let prompts = [
        "用 Rust 实现一个函数 is_prime(n: u32) -> bool，判断给定的无符号整数是否为质数。",
        "用 Rust 定义一个泛型栈结构 Stack<T>，实现 push、pop 和 peek 方法，并使用 Vec<T> 作为底层存储。",
        "用 Rust 实现快速排序算法，函数签名为 fn quicksort<T: Ord + Clone>(arr: &mut [T])。",
        "用 Rust 读取指定路径的文本文件，统计每行的字节数，并将结果写入新文件。",
        "使用 reqwest crate 编写一个异步函数 fetch_weather(city: &str) -> Result<f64, Box<dyn std::error::Error>>，从公开天气 API 获取当前温度。",
        "使用 axum 框架编写一个最小的 REST API，当访问 GET / 时返回 JSON: {\"message\": \"Hello, World!\"}。",
        "实现一个安全的除法函数 divide(a: f64, b: f64) -> Result<f64, String>，在除数为零时返回错误信息。",
        "定义一个结构体 Car，包含字段 brand: String、model: String，并实现一个方法 fn start_engine(&self) -> String。",
        "使用 regex crate 编写函数 is_valid_email(email: &str) -> bool，验证电子邮件格式是否合法。",
        "使用 tokio 编写一个异步函数 fetch_multiple_urls(urls: Vec<&str>) -> Vec<String>，并发获取多个网页内容。",
        "使用 rusqlite crate 创建一个 SQLite 数据库，定义 users 表（id INTEGER PRIMARY KEY, name TEXT），并插入一条测试记录。",
        "为一个计算阶乘的函数 factorial(n: u64) -> u64 编写单元测试，覆盖正常值和边界情况（如 0）。",
        "编写一个命令行程序，使用 clap 解析输入参数 --file <PATH>，并输出该文件的总行数。",
        "使用 polars 或 csv crate 读取 CSV 文件，筛选出 age > 30 的行，并将结果写入 output.csv。",
        "将以下使用 for 循环构建 Vec 的 Rust 代码重构为使用迭代器和 collect：[提供原始代码示例]。",
    ];
    let ph = init().unwrap();
    for p in prompts {
        ph.add_prompt(
            Arc::new(p.to_string()),
            Some("/data/home/sen/code/projects/ai/zsen-cc-web/".into()),
        );
    }
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
    pub fn add_prompt(&self, content: Arc<String>, work_dir: Option<PathBuf>) {
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
        let home_dir = dirs::home_dir().context("Failed to get home directory")?;
        let niu_code_dir = home_dir.join(".niu-code");

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
