use std::{fmt::Debug, sync::Arc};

use serde::{Deserialize, Serialize};

use crate::types::{PermissionMode, ToolUseParams, UntaggedToolUseParams};

#[derive(Deserialize, Serialize, Debug)]
#[serde(tag = "behavior")]
#[serde(rename_all = "snake_case")]
pub enum PermissionResult {
    Allow(PermissionAllow),
    Deny(PermissionDeny),
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PermissionDeny {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interrupt: Option<bool>,
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PermissionAllow {
    pub updated_input: UntaggedToolUseParams,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_permissions: Option<Vec<PermissionUpdate>>,
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(tag = "type")]
#[serde(rename_all = "camelCase")]
pub enum PermissionUpdate {
    AddRules {
        rules: Vec<PermissionRuleValue>,
        behavior: PermissionBehavior,
        destination: PermissionUpdateDestination,
    },
    ReplaceRules {
        rules: Vec<PermissionRuleValue>,
        behavior: PermissionBehavior,
        destination: PermissionUpdateDestination,
    },
    RemoveRules {
        rules: Vec<PermissionRuleValue>,
        behavior: PermissionBehavior,
        destination: PermissionUpdateDestination,
    },
    SetMode {
        mode: PermissionMode,
        destination: PermissionUpdateDestination,
    },
    AddDirectories {
        directories: Vec<String>,
        destination: PermissionUpdateDestination,
    },
    RemoveDirectories {
        directories: Vec<String>,
        destination: PermissionUpdateDestination,
    },
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PermissionRuleValue {
    pub tool_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_content: Option<String>,
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub enum PermissionBehavior {
    Allow,
    Deny,
    Ask,
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub enum PermissionUpdateDestination {
    UserSettings,
    ProjectSettings,
    LocalSettings,
    Session,
}

pub trait CanUseToolCallBack: Send + Sync + Debug + 'static + Sized {
    fn call(
        &mut self,
        tool_use: ToolUseParams,
        suggestions: Option<Vec<PermissionUpdate>>,
    ) -> impl Future<Output = anyhow::Result<Arc<PermissionResult>>> + Send;

    fn boxed(self) -> BoxedCanUseTollCallback {
        Box::new(self)
    }
}

#[async_trait::async_trait]
pub trait CanUseToolCallBackDyn: Send + Sync + Debug + 'static {
    async fn call(
        &mut self,
        tool_use: ToolUseParams,
        suggestions: Option<Vec<PermissionUpdate>>,
    ) -> anyhow::Result<Arc<PermissionResult>>;
}

#[async_trait::async_trait]
impl<T> CanUseToolCallBackDyn for T
where
    T: CanUseToolCallBack,
{
    async fn call(
        &mut self,
        tool_use: ToolUseParams,
        suggestions: Option<Vec<PermissionUpdate>>,
    ) -> anyhow::Result<Arc<PermissionResult>> {
        CanUseToolCallBack::call(self, tool_use, suggestions).await
    }
}

pub type BoxedCanUseTollCallback = Box<dyn CanUseToolCallBackDyn>;
