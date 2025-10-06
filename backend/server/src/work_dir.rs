use anyhow::Result;
use ignore::{Walk, WalkBuilder};
use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::LazyLock;
use std::sync::RwLock;
use tracing::{debug, info, warn};

pub async fn ls(dir: &Path) -> Result<Vec<String>> {
    let mut entries = Vec::new();

    if !dir.exists() {
        return Err(anyhow::anyhow!("Directory does not exist: {:?}", dir));
    }

    if !dir.is_dir() {
        return Err(anyhow::anyhow!("Path is not a directory: {:?}", dir));
    }

    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        // Only include directories
        if path.is_dir() {
            if let Some(file_name) = path.file_name() {
                if let Some(name_str) = file_name.to_str() {
                    entries.push(name_str.to_string());
                }
            }
        }
    }

    entries.sort();
    Ok(entries)
}

pub async fn home() -> Result<PathBuf> {
    match dirs::home_dir() {
        Some(home) => Ok(home),
        None => Err(anyhow::anyhow!("Failed to get home directory")),
    }
}

// 文件变动事件类型
#[derive(Debug, Clone, Serialize)]
pub enum FileChange {
    Created(PathBuf),
    Removed(PathBuf),
}

// 文件变动通知 trait
pub trait FileChangeNotifier: Send + Sync {
    fn file_changed(&self, work_dir: &Path, change: FileChange) -> Result<(), ()>;
    fn notify_error(&self, work_dir: &Path, error: &str) -> Result<(), ()>;
}

// 用于依赖注入的通知器类型
pub type DynFileChangeNotifier = Arc<dyn FileChangeNotifier>;

// 文件监听器管理器 - 简单的通知器管理，不缓存文件列表
pub struct FileWatcher {
    work_dir: PathBuf,
    notifiers: Vec<DynFileChangeNotifier>,
    watcher: Option<RecommendedWatcher>,
    ignore_matcher: ignore::gitignore::Gitignore,
}

fn build_gitignore(work_dir: &Path) -> Result<ignore::gitignore::Gitignore> {
    let walk = WalkBuilder::new(work_dir)
        .max_depth(Some(5))
        .hidden(false)
        .build();
    let mut ignore = ignore::gitignore::GitignoreBuilder::new(work_dir);
    ignore.add_line(None, ".gitignore").unwrap();
    ignore.add_line(None, ".git").unwrap();
    for entry in walk {
        let entry = entry?;
        let path = entry.path();
        let Some(filename) = path.file_name() else {
            continue;
        };
        if path.is_file() && filename == ".gitignore" {
            debug!("Found .gitignore file: {}", path.display());
            ignore.add(path);
        }
    }

    Ok(ignore.build()?)
}

impl FileWatcher {
    fn new(work_dir: PathBuf) -> Result<Self> {
        let ignore_matcher = build_gitignore(&work_dir)?;

        Ok(Self {
            work_dir,
            notifiers: Vec::new(),
            watcher: None,
            ignore_matcher,
        })
    }

    fn add_notifier(&mut self, notifier: DynFileChangeNotifier) {
        self.notifiers.push(notifier);
    }

    fn should_ignore_path(&self, path: &Path) -> bool {
        self.ignore_matcher
            .matched_path_or_any_parents(path, path.is_dir())
            .is_ignore()
    }

    fn notify_change(&mut self, change: FileChange) -> bool {
        // 使用简单的 retain 清理失败的通知器，错误只代表连接关闭
        self.notifiers.retain(|notifier| {
            notifier
                .file_changed(&self.work_dir, change.clone())
                .is_ok()
        });

        // 返回是否还有通知器
        !self.notifiers.is_empty()
    }

    fn start_watching(&mut self) -> Result<()> {
        if self.watcher.is_some() {
            return Ok(());
        }

        let work_dir = self.work_dir.clone();
        let mut watcher = notify::recommended_watcher(move |res: Result<Event, _>| match res {
            Ok(event) => handle_fs_event(work_dir.clone(), event),
            Err(e) => {
                warn!("File watcher error for work_dir {:?}: {:?}", work_dir, e);
                // 通知所有注册的通知器发生了错误
                FILE_WATCHER_REGISTRY
                    .notify_error(&work_dir, &format!("File watcher error: {:?}", e));
            }
        })?;

        watcher.watch(&self.work_dir, RecursiveMode::Recursive)?;
        self.watcher = Some(watcher);

        info!(
            "File watcher started successfully for work_dir: {:?}",
            self.work_dir
        );
        Ok(())
    }

    pub fn stop_watching(&mut self) {
        if let Some(mut watcher) = self.watcher.take() {
            let _ = watcher.unwatch(&self.work_dir);
            info!("File watcher stopped for work_dir: {:?}", self.work_dir);
        }
    }
}

// 全局文件监听器管理器
pub struct FileWatcherRegistry {
    watchers: Arc<RwLock<HashMap<PathBuf, Arc<RwLock<FileWatcher>>>>>,
}

impl FileWatcherRegistry {
    fn new() -> Self {
        info!("Initializing FileWatcherRegistry");
        Self {
            watchers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    fn add_notifier(&self, work_dir: PathBuf, notifier: DynFileChangeNotifier) -> Result<()> {
        let mut watchers = self.watchers.write().unwrap();

        if let Some(watcher) = watchers.get(&work_dir) {
            let mut watcher = watcher.write().unwrap();
            watcher.add_notifier(notifier);
        } else {
            // 创建新的监听器管理器
            info!("Creating new file watcher for work_dir: {:?}", work_dir);
            let mut manager = FileWatcher::new(work_dir.clone())?;
            manager.add_notifier(notifier);
            manager.start_watching()?;

            watchers.insert(work_dir.clone(), Arc::new(RwLock::new(manager)));
        }

        Ok(())
    }

    fn notify_change(&self, work_dir: &Path, change: FileChange) {
        let mut watchers = self.watchers.write().unwrap();

        if let Some(watcher_arc) = watchers.get(work_dir) {
            let mut watcher = watcher_arc.write().unwrap();

            // 检查是否应该忽略这个文件变更
            let path = match &change {
                FileChange::Created(p) | FileChange::Removed(p) => p,
            };

            if watcher.should_ignore_path(path) {
                return; // 忽略这个变更
            }

            // 通知变更，检查是否需要清理
            let has_remaining_notifiers = watcher.notify_change(change);

            // 如果没有剩余的通知器，清理整个 FileWatcherManager
            if !has_remaining_notifiers {
                watcher.stop_watching();
                drop(watcher); // 释放写锁
                watchers.remove(work_dir);
                info!(
                    "Auto-removed file watcher for work_dir: {:?} (no remaining notifiers)",
                    work_dir
                );
            }
        }
    }

    fn notify_error(&self, work_dir: &Path, error: &str) {
        let mut watchers = self.watchers.write().unwrap();

        if let Some(watcher_arc) = watchers.get(work_dir) {
            let mut watcher = watcher_arc.write().unwrap();

            // 通知所有注册的通知器
            watcher
                .notifiers
                .retain(|notifier| notifier.notify_error(work_dir, error).is_ok());

            // 如果没有剩余的通知器，清理整个 FileWatcherManager
            if watcher.notifiers.is_empty() {
                watcher.stop_watching();
                drop(watcher); // 释放写锁
                watchers.remove(work_dir);
                info!(
                    "Auto-removed file watcher for work_dir: {:?} (no remaining notifiers after error)",
                    work_dir
                );
            }
        }
    }
}

// 使用 ignore crate 的独立文件扫描函数
fn scan_workspace_files(work_dir: &Path) -> Result<Vec<PathBuf>> {
    debug!("Scanning workspace files for: {:?}", work_dir);

    if !work_dir.exists() {
        return Err(anyhow::anyhow!(
            "Work directory does not exist: {:?}",
            work_dir
        ));
    }

    let files: Vec<PathBuf> = Walk::new(work_dir)
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().map(|ft| ft.is_file()).unwrap_or(false))
        .filter_map(|e| e.path().strip_prefix(work_dir).ok().map(ToOwned::to_owned))
        .collect();

    debug!("Found {} files in work_dir: {:?}", files.len(), work_dir);
    Ok(files)
}

fn handle_fs_event(work_dir: PathBuf, event: Event) {
    // 处理具体的文件变动事件
    for change in extract_file_changes(&work_dir, &event) {
        FILE_WATCHER_REGISTRY.notify_change(&work_dir, change);
    }
}

// 从文件系统事件中提取文件变动（可能返回多个变动）
fn extract_file_changes(work_dir: &Path, event: &Event) -> Vec<FileChange> {
    match event.kind {
        notify::EventKind::Create(_) => event
            .paths
            .iter()
            .map(|path| {
                let relative_path = path.strip_prefix(work_dir).unwrap_or(path);
                FileChange::Created(relative_path.to_path_buf())
            })
            .collect(),
        notify::EventKind::Remove(_) => event
            .paths
            .iter()
            .map(|path| {
                let relative_path = path.strip_prefix(work_dir).unwrap_or(path);
                FileChange::Removed(relative_path.to_path_buf())
            })
            .collect(),
        notify::EventKind::Modify(notify::event::ModifyKind::Name(rename_mode)) => {
            // 处理重命名事件，转换为删除+创建
            match rename_mode {
                notify::event::RenameMode::Both => {
                    // 完整的重命名事件（from + to），转换为删除+创建
                    if let (Some(from), Some(to)) = (event.paths.first(), event.paths.get(1)) {
                        let from_relative = from.strip_prefix(work_dir).unwrap_or(from);
                        let to_relative = to.strip_prefix(work_dir).unwrap_or(to);
                        vec![
                            FileChange::Removed(from_relative.to_path_buf()),
                            FileChange::Created(to_relative.to_path_buf()),
                        ]
                    } else {
                        Vec::new()
                    }
                }
                notify::event::RenameMode::Any => {
                    vec![]
                }
                notify::event::RenameMode::To => event
                    .paths
                    .first()
                    .map(|path| {
                        let relative_path = path.strip_prefix(work_dir).unwrap_or(path);
                        FileChange::Created(relative_path.to_path_buf())
                    })
                    .into_iter()
                    .collect(),
                notify::event::RenameMode::From => event
                    .paths
                    .first()
                    .map(|path| {
                        let relative_path = path.strip_prefix(work_dir).unwrap_or(path);
                        FileChange::Removed(relative_path.to_path_buf())
                    })
                    .into_iter()
                    .collect(),
                notify::event::RenameMode::Other => vec![],
            }
        }
        _ => Vec::new(),
    }
}

// 全局文件监听器注册表实例
static FILE_WATCHER_REGISTRY: LazyLock<FileWatcherRegistry> =
    LazyLock::new(|| FileWatcherRegistry::new());

// 公共 API 函数 - 实时扫描文件
pub fn scan_workspace_files_realtime(work_dir: &Path) -> Result<Vec<PathBuf>> {
    info!("Scanning workspace files for: {:?}", work_dir);
    let files = scan_workspace_files(work_dir)?;
    info!("Found {} files in work_dir: {:?}", files.len(), work_dir);
    Ok(files)
}

// 公共 API 函数 - 文件变动通知器管理
pub fn add_file_change_notifier(work_dir: PathBuf, notifier: DynFileChangeNotifier) -> Result<()> {
    info!("Adding file change notifier for work_dir: {:?}", work_dir);
    FILE_WATCHER_REGISTRY.add_notifier(work_dir, notifier)
}
