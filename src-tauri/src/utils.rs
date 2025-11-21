// src/utils.rs
use std::path::{Path, PathBuf};
use sysinfo::System;
use tokio::fs;
use tokio::fs::read_to_string;
use tokio_stream::StreamExt;
use walkdir::WalkDir;

#[tauri::command]
pub async fn get_local_version_json(path: String) -> Result<String, String> {
    read_to_string(path)
        .await
        .map_err(|e| format!("Failed to read local version: {}", e))
}

#[tauri::command]
pub async fn is_dir_empty(path: String) -> Result<bool, String> {
    let mut entries = fs::read_dir(&path).await.map_err(|e| e.to_string())?;
    let mut count = 0;
    while let Some(_) = entries.next_entry().await.transpose() {
        count += 1;
        if count > 0 {
            return Ok(false);
        }
    }
    Ok(true)
}

#[tauri::command]
pub fn get_total_memory_mb() -> Result<u64, String> {
    let mut sys = System::new();
    sys.refresh_memory();
    Ok(sys.total_memory() / 1024 / 1024)
}

#[tauri::command]
pub async fn toggle_mod_file(path: String, enable: bool) -> Result<(), String> {
    let jar_path = Path::new(&path).with_extension("jar");
    let disabled_path = Path::new(&path).with_extension("jar.disabled");

    let (current, target) = if enable {
        (&disabled_path, &jar_path)
    } else {
        (&jar_path, &disabled_path)
    };

    if current == target {
        return Ok(());
    }

    match fs::rename(current, target).await {
        Ok(_) => Ok(()),
        Err(e) => {
            println!(
                "Toggle mod failed: {}\nFROM: {}\nTO: {}",
                e,
                current.display(),
                target.display()
            );
            Ok(())
        }
    }
}

#[tauri::command]
pub async fn list_mod_jar_files(mods_path: String) -> Result<Vec<String>, String> {
    let path = PathBuf::from(mods_path);
    if !path.exists() {
        return Err("Path does not exist".to_string());
    }
    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let mut jar_files = Vec::new();
    let mut entries = fs::read_dir(&path).await.map_err(|e| e.to_string())?;
    while let Some(entry) = entries.next_entry().await.transpose() {
        if let Ok(entry) = entry {
            let p = entry.path();
            if !p.is_file() {
                continue;
            }
            let name = match p.file_name().and_then(|s| s.to_str()) {
                Some(v) => v,
                None => continue,
            };
            let lower = name.to_ascii_lowercase();
            if lower.ends_with(".jar") || lower.ends_with(".jar.disabled") {
                if let Some(s) = p.to_str() {
                    jar_files.push(s.to_string());
                }
            }
        }
    }
    Ok(jar_files)
}


#[tauri::command]
pub async fn write_file_bytes(path: String, data: Vec<u8>) -> Result<(), String> {
    use tokio::fs;
    use std::path::Path;

    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    
    fs::write(&path, data)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(())
}
#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    use tokio::fs;
    use std::path::Path;

    let p = Path::new(&path);
    if p.exists() {
        fs::remove_file(&path)
            .await
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn scan_directory_recursive(root_path: String) -> Vec<String> {
    let mut files = Vec::new();
    
    for entry in WalkDir::new(&root_path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {

            if let Some(path_str) = entry.path().to_str() {
                files.push(path_str.to_string());
            }
        }
    }
    files
}