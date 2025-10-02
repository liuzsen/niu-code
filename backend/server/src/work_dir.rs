use anyhow::Result;
use std::fs;
use std::path::{Path, PathBuf};

pub async fn ls(dir: &Path) -> Result<Vec<String>> {
    let mut entries = Vec::new();

    if !dir.exists() {
        return Err(anyhow::anyhow!("Directory does not exist: {:?}", dir));
    }

    if !dir.is_dir() {
        return Err(anyhow::anyhow!("Path is not a directory: {:?}", dir));
    }

    for entry in fs::read_dir(dir)? {
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
