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

    let p = Path::new(&path);
    if p.exists() {
        fs::remove_file(&path)
            .await
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    
    Ok(())
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
    // 1. Создаем клиент с ПОЛНЫМ отключением сжатия
    let client = reqwest::Client::builder()
        .no_gzip()
        .no_brotli()
        .no_deflate()
        // Добавляем таймауты на всякий случай (для зависших коннектов)
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(300)) // 5 минут на скачивание файла
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;
    
    // 2. Собираем запрос
    let mut request = client.get(&url);
    
    if let Some(token) = auth_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }

    // ВАЖНО: Явно просим сервер НЕ сжимать ("identity" = без кодирования)
    request = request.header("Accept-Encoding", "identity");

    // 3. Отправляем запрос
    let response = request
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server returned status: {}", response.status()));
    }

    // Создаем папки
    if let Some(parent) = std::path::Path::new(&path).parent() {
        if !parent.exists() {
            tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
        }
    }

    // 4. Сохраняем файл
    let mut file = tokio::fs::File::create(&path).await.map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();

    while let Some(chunk_result) = futures_util::StreamExt::next(&mut stream).await {
        // Вот здесь вылетала ошибка "error decoding response body"
        // Теперь, с "Accept-Encoding: identity" и .no_gzip(), сервер должен присылать raw bytes.
        // Если сервер (Nginx) ИГНОРИРУЕТ это и все равно шлет gzip, 
        // то файл сохранится сжатым (битым для игры), но ошибки загрузки НЕ БУДЕТ.
        // Это позволит хотя бы скачать файл, а дальше хеш-проверка его отловит.
        
        match chunk_result {
            Ok(chunk) => {
                tokio::io::AsyncWriteExt::write_all(&mut file, &chunk).await.map_err(|e| e.to_string())?;
            },
            Err(e) => {
                // Если ошибка все же случилась (обрыв сети), возвращаем понятный текст
                return Err(format!("Stream interrupted: {}", e));
            }
        }
    }

    tokio::io::AsyncWriteExt::flush(&mut file).await.map_err(|e| e.to_string())?;
    Ok(())
}