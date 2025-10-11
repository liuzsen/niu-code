use std::{fmt::Debug, sync::Arc};

use derive_more::From;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, From, Clone)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
pub enum ContentBlockParam {
    Text(TextBlockParam),
    #[serde(untagged)]
    Other(serde_json::Value),
}

impl Debug for ContentBlockParam {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Text(arg0) => f.debug_tuple("Text").field(arg0).finish(),
            Self::Other(arg0) => {
                let Some(ty) = arg0["type"].as_str() else {
                    return write!(f, "Unknown ContentBlockParam");
                };
                if ty == "image" {
                    return write!(f, "Image(..)");
                }

                f.debug_tuple("Other").field(arg0).finish()
            }
        }
    }
}

#[derive(Serialize, Deserialize, Debug, From, Clone)]
pub struct TextBlockParam {
    pub text: Arc<String>,
    pub cache_control: Option<CacheControlEphemeral>,
    pub citations: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CacheControlEphemeral {
    r#type: CacheControlEphemeralType,
    ttl: TTL,
}

#[derive(Debug, Clone, Copy)]
pub struct CacheControlEphemeralType;

impl Serialize for CacheControlEphemeralType {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str("ephemeral")
    }
}

impl<'de> Deserialize<'de> for CacheControlEphemeralType {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s: &str = Deserialize::deserialize(deserializer)?;
        if s == "ephemeral" {
            return Ok(CacheControlEphemeralType);
        }

        return Err(serde::de::Error::custom(
            "unkown CacheControlEphemeral type",
        ));
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
pub enum TTL {
    #[serde(rename = "5m")]
    _5M,
    #[serde(rename = "1h")]
    _1H,
}
