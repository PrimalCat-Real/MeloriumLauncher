// src/utils.rs
use std::path::{Path, PathBuf};
use sysinfo::System;
use tokio::fs::{self, File};
use tokio::fs::read_to_string;
use tokio::io::AsyncWriteExt;
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
    use std::time::Duration;

    let p = Path::new(&path);
    
    if !p.exists() {
        return Ok(());
    }

    // Пробуем удалить файл с повторами (до 5 попыток)
    let mut attempts = 0;
    loop {
        attempts += 1;
        match fs::remove_file(&path).await {
            Ok(_) => return Ok(()),
            Err(e) => {
                // Коды ошибок Windows: 
                // 5 = Access Denied
                // 32 = Sharing Violation (занят другим процессом)
                let raw_os_error = e.raw_os_error().unwrap_or(0);
                let is_lock_error = raw_os_error == 5 || raw_os_error == 32; 

                if is_lock_error && attempts < 5 {
                    // Ждем с экспоненциальной задержкой: 200ms, 400ms, 600ms...
                    tokio::time::sleep(Duration::from_millis(200 * attempts)).await;
                    continue;
                }
                
                // Если не вышло после 5 попыток или ошибка другая — сдаемся
                return Err(format!("Failed to delete file '{}': {} (code: {})", path, e, raw_os_error));
            }
        }
    }
}

async fn remove_file_with_retry(path: &Path) -> std::io::Result<()> {
    if !path.exists() { return Ok(()); }
    
    let mut attempts = 0;
    loop {
        attempts += 1;
        match tokio::fs::remove_file(path).await {
            Ok(_) => return Ok(()),
            Err(e) => {
                let code = e.raw_os_error().unwrap_or(0);
                if (code == 5 || code == 32) && attempts < 5 {
                    tokio::time::sleep(std::time::Duration::from_millis(200 * attempts)).await;
                    continue;
                }
                return Err(e);
            }
        }
    }
}

#[tauri::command]
pub async fn scan_directory_recursive(root_path: String) -> Result<Vec<String>, String> {
    let files = tokio::task::spawn_blocking(move || {
        let mut files = Vec::new();
        for entry in WalkDir::new(&root_path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                if let Some(path_str) = entry.path().to_str() {
                    files.push(path_str.to_string());
                }
            }
        }
        files
    }).await.map_err(|e| e.to_string())?;
    
    Ok(files)
}


#[tauri::command]
pub async fn download_file_direct(
    url: String, 
    path: String, 
    auth_token: Option<String>
) -> Result<(), String> {
    // 1. Создаем клиент (максимально "тупой")
    let client = reqwest::Client::builder()
        .no_gzip()
        .no_brotli()
        .no_deflate()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;
    
    let mut request = client.get(&url);
    
    if let Some(token) = auth_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }

    // Просим Identity
    request = request.header("Accept-Encoding", "identity");

    // 2. Отправляем запрос
    let mut response = request.send().await.map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server returned status: {}", response.status()));
    }

    // === УБИВАЕМ ЗАГОЛОВКИ СЖАТИЯ ===
    // Это ключевой момент. Если заголовка нет, reqwest не будет пытаться разжать тело.
    response.headers_mut().remove(reqwest::header::CONTENT_ENCODING);
    response.headers_mut().remove(reqwest::header::CONTENT_LENGTH); // Длина тоже может врать при сжатии
    // ================================

    // Создаем папки
    let path_obj = std::path::Path::new(&path);
    if let Some(parent) = path_obj.parent() {
        if !parent.exists() {
            tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
        }
    }

    // Удаляем старый файл с retry (от os error 5)
    if let Err(e) = remove_file_with_retry(path_obj).await {
        println!("Warning: Failed to remove old file: {}", e);
    }

    // 3. Сохраняем
    let mut file = tokio::fs::File::create(&path).await.map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();

    while let Some(chunk_result) = futures_util::StreamExt::next(&mut stream).await {
        match chunk_result {
            Ok(chunk) => {
                tokio::io::AsyncWriteExt::write_all(&mut file, &chunk).await.map_err(|e| e.to_string())?;
            },
            Err(e) => {
                // Если ошибка все же вылетит тут, значит это РЕАЛЬНЫЙ обрыв TCP соединения,
                // а не ошибка декодера gzip.
                return Err(format!("Stream interrupted: {}", e));
            }
        }
    }

    tokio::io::AsyncWriteExt::flush(&mut file).await.map_err(|e| e.to_string())?;
    Ok(())
}