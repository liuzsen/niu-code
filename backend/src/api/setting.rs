use actix_web::web::Json;
use anyhow::Context;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::api::{ApiError, ApiOkResponse};

#[derive(Deserialize, Serialize, Clone)]
pub struct Setting {
    claude_settings: Vec<ClaudeSetting>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct ClaudeSetting {
    name: String,
    setting: Value,
}

pub async fn get_setting() -> Result<ApiOkResponse<Setting>, ApiError> {
    let current_setting = server::setting::get_current_setting();

    // Convert server::setting::Setting to api::setting::Setting
    let claude_settings: Vec<ClaudeSetting> = current_setting
        .get_claude_settings()
        .iter()
        .map(|cs| ClaudeSetting {
            name: cs.name().to_string(),
            setting: cs.setting().clone(),
        })
        .collect();

    let setting = Setting { claude_settings };

    Ok(ApiOkResponse::new(setting))
}

pub async fn update_setting(Json(setting): Json<Setting>) -> Result<ApiOkResponse<()>, ApiError> {
    let config_path = server::setting::get_config_path();

    // Ensure the config directory exists
    if let Some(parent) = config_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .context("Failed to create config directory")?;
    }

    // Serialize and write to file
    let json_content =
        serde_json::to_string_pretty(&setting).context("Failed to serialize settings")?;
    tokio::fs::write(&config_path, json_content)
        .await
        .context("Failed to write config file")?;

    tracing::info!("Configuration updated at {:?}", config_path);

    Ok(ApiOkResponse::new(()))
}
