use std::path::PathBuf;
use std::sync::{Arc, OnceLock};
use std::time::Duration;

use arc_swap::ArcSwap;
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::mpsc;
use tokio::time::sleep;

#[derive(Deserialize, Serialize, Clone, PartialEq)]
pub struct Setting {
    claude_settings: Vec<ClaudeSetting>,
}

#[derive(Deserialize, Serialize, Clone, PartialEq)]
pub struct ClaudeSetting {
    pub name: String,
    pub setting: Value,
}

impl ClaudeSetting {
    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn setting(&self) -> &Value {
        &self.setting
    }
}

impl Setting {
    pub fn get_claude_settings(&self) -> &[ClaudeSetting] {
        &self.claude_settings
    }

    pub fn get_claude_setting(&self, name: &str) -> Option<&ClaudeSetting> {
        self.claude_settings
            .iter()
            .find(|setting| setting.name == name)
    }
}

impl Default for Setting {
    fn default() -> Self {
        let ccr = serde_json::json!({
            "env": {
                "ANTHROPIC_AUTH_TOKEN": "your-secret-key",
                "ANTHROPIC_BASE_URL": "http://127.0.0.1:3456"
            }
        });
        Self {
            claude_settings: vec![ClaudeSetting {
                name: "ccr".to_string(),
                setting: ccr,
            }],
        }
    }
}

static GLOBAL_SETTING: OnceLock<ArcSwap<Setting>> = OnceLock::new();

pub fn get_global_setting() -> &'static ArcSwap<Setting> {
    GLOBAL_SETTING.get_or_init(|| ArcSwap::new(Arc::new(Setting::default())))
}

pub fn get_config_dir() -> PathBuf {
    dirs::home_dir()
        .expect("expect home dir")
        .join(".config")
        .join(".niu-code")
}

pub fn get_config_path() -> PathBuf {
    get_config_dir().join("settings.json")
}

async fn load_from_file_or_default() -> Setting {
    let config_path = get_config_path();

    if !config_path.exists() {
        tracing::info!(
            "Config file {:?} not found, using default configuration",
            config_path
        );
        return Setting::default();
    }

    match tokio::fs::read_to_string(&config_path).await {
        Ok(content) => match serde_json::from_str::<Setting>(&content) {
            Ok(setting) => {
                tracing::info!("Successfully loaded config file {:?}", config_path);
                setting
            }
            Err(e) => {
                tracing::error!(
                    "Failed to parse config file {:?}: {}, using default configuration",
                    config_path,
                    e
                );
                Setting::default()
            }
        },
        Err(e) => {
            tracing::error!(
                "Failed to read config file {:?}: {}, using default configuration",
                config_path,
                e
            );
            Setting::default()
        }
    }
}

async fn create_file_watcher() -> anyhow::Result<()> {
    let config_path = get_config_path();
    let config_dir = config_path.parent().unwrap();

    let (event_tx, mut event_rx) = mpsc::channel(32);
    let config_path_for_watcher = config_path.clone();

    let mut watcher: RecommendedWatcher = Watcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                if let Err(e) = event_tx.blocking_send(event) {
                    tracing::error!("Failed to send file event: {}", e);
                }
            }
        },
        Config::default(),
    )?;

    watcher.watch(config_dir, RecursiveMode::NonRecursive)?;

    let mut debounce_timer: Option<tokio::task::JoinHandle<()>> = None;

    while let Some(event) = event_rx.recv().await {
        if event.paths.contains(&config_path_for_watcher) {
            match event.kind {
                EventKind::Modify(_) | EventKind::Create(_) => {
                    if let Some(timer) = debounce_timer {
                        timer.abort();
                    }

                    let task = async move {
                        sleep(Duration::from_millis(500)).await;

                        match load_from_file_or_default().await {
                            new_setting if new_setting != *get_global_setting().load().as_ref() => {
                                get_global_setting().store(Arc::new(new_setting));
                                tracing::info!("Configuration hot reloaded");
                            }
                            _ => {}
                        }
                    };
                    debounce_timer = Some(tokio::spawn(task));
                }
                EventKind::Remove(_) => {
                    tracing::warn!("Config file was deleted, using default configuration");
                    let default_setting = Setting::default();
                    get_global_setting().store(Arc::new(default_setting));
                }
                _ => {}
            }
        }
    }

    Ok(())
}

pub fn spawn_watcher() {
    tokio::spawn(async {
        tracing::info!(
            "Config watcher started, monitoring file: {:?}",
            get_config_path()
        );

        loop {
            match create_file_watcher().await {
                Ok(_) => {
                    tracing::error!("File watcher unexpectedly exited, restarting...");
                    sleep(Duration::from_secs(5)).await;
                }
                Err(e) => {
                    tracing::error!("Failed to start file watcher: {}, retrying in 5 seconds", e);
                    sleep(Duration::from_secs(5)).await;
                }
            }
        }
    });
}

pub async fn init() {
    let setting = load_from_file_or_default().await;
    get_global_setting().store(Arc::new(setting));

    spawn_watcher();
}

pub fn get_current_setting() -> Arc<Setting> {
    get_global_setting().load_full()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_current_setting() {
        let _setting = get_current_setting();
        assert!(_setting.claude_settings.len() > 0);
    }

    #[tokio::test]
    async fn test_get_claude_setting_by_name() {
        let setting = Setting::default();
        let ccr_setting = setting.get_claude_setting("ccr");
        assert!(ccr_setting.is_some());

        let non_existent = setting.get_claude_setting("non_existent");
        assert!(non_existent.is_none());
    }

    #[tokio::test]
    async fn test_hot_reload() {
        super::init().await;

        loop {
            println!(
                "current setting:\n{}",
                serde_json::to_string(&get_current_setting()).unwrap()
            );
            sleep(Duration::from_millis(2000)).await;
        }
    }
}
