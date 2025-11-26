// src/utils.rs
use std::path::{Path, PathBuf};
use sysinfo::System;
use tauri::{Emitter, Window};
use tokio::fs::{self, File};
use tokio::fs::read_to_string;
use tokio::io::AsyncWriteExt;
use tokio_stream::StreamExt;
use walkdir::WalkDir;
use reqwest::{Client, header};
use std::time::Duration;
#[derive(Debug)]
struct DownloadProgress {
    downloaded: u64,
    total: u64,
    speed: f64,
}


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
    let client = reqwest::Client::builder()
        .no_gzip()
        .no_brotli()
        .no_deflate()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| format!("Client build error ({}): {}", url, e))?;
    
    let mut request = client.get(&url);

    if let Some(token) = auth_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }

    request = request.header("Accept-Encoding", "identity");

    let mut response = request
        .send()
        .await
        .map_err(|e| format!("Request failed ({}): {}", url, e))?;

    if !response.status().is_success() {
        return Err(format!("Server returned status {} for {}", response.status(), url));
    }

    response.headers_mut().remove(reqwest::header::CONTENT_ENCODING);
    response.headers_mut().remove(reqwest::header::CONTENT_LENGTH);

    let path_obj = std::path::Path::new(&path);
    if let Some(parent) = path_obj.parent() {
        if !parent.exists() {
            tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
        }
    }

    if let Err(e) = remove_file_with_retry(path_obj).await {
        println!("Warning: Failed to remove old file before download ({}): {}", path, e);
    }

    let mut file = tokio::fs::File::create(&path).await.map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(chunk) => {
                tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
                    .await
                    .map_err(|e| format!("Write error ({}): {}", path, e))?;
            }
            Err(e) => {
                return Err(format!("Stream interrupted ({}): {}", url, e));
            }
        }
    }

    tokio::io::AsyncWriteExt::flush(&mut file)
        .await
        .map_err(|e| format!("Flush error ({}): {}", path, e))?;
    Ok(())
}

// #[tauri::command]
// pub async fn download_file_resilient(
//     url: String,
//     path: String,
//     auth_token: Option<String>
// ) -> Result<(), String> {
//     let config = DownloadConfig::builder()
//         .retry_count(5)
//         .timeout(std::time::Duration::from_secs(300))
//         .build();

//     let mut download = Download::new(&url, &path, config)
//         .map_err(|e| e.to_string())?;

//     if let Some(token) = auth_token {
//         download.add_header("Authorization", &format!("Bearer {}", token));
//     }

//     download.start().await.map_err(|e| e.to_string())?;
//     Ok(())
// }


#[tauri::command]
pub async fn download_file_with_fallbacks(
    window: tauri::Window,
    url: String,
    path: String,
    auth_token: Option<String>,
    task_id: String,
) -> Result<(), String> {
    // Fallback 1: Long timeout + chunked streaming
    let result = download_with_streaming(&window, &url, &path, &auth_token, &task_id, 600).await;
    
    if result.is_ok() {
        return result;
    }
    
    println!("⚠️ Fallback 1 failed, trying Range requests...");
    
    // Fallback 2: Range requests with retries
    let result = download_with_ranges(&window, &url, &path, &auth_token, &task_id).await;
    
    if result.is_ok() {
        return result;
    }
    
    println!("⚠️ Fallback 2 failed, trying minimal config...");
    
    // Fallback 3: Minimal client config with aggressive timeouts
    download_minimal(&window, &url, &path, &auth_token, &task_id).await
}

async fn download_with_streaming(
    window: &tauri::Window,
    url: &str,
    path: &str,
    auth_token: &Option<String>,
    task_id: &str,
    timeout_secs: u64,
) -> Result<(), String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .connect_timeout(Duration::from_secs(60))
        .read_timeout(Duration::from_secs(120))
        .tcp_keepalive(Duration::from_secs(60))
        .pool_idle_timeout(Duration::from_secs(90))
        .build()
        .map_err(|e| e.to_string())?;
    
    let mut request = client.get(url);
    
    if let Some(token) = auth_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }
    
    let mut response = request.send().await.map_err(|e| e.to_string())?;
    
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err("UNAUTHORIZED_401".to_string());
    }


    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }
    
    let total = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let start = std::time::Instant::now();
    
    // Create file
    let path_obj = std::path::Path::new(path);
    if let Some(parent) = path_obj.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }
    
    let mut file = tokio::fs::File::create(path).await.map_err(|e| e.to_string())?;
    
    // Download in chunks
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        
        downloaded += chunk.len() as u64;
        
        // Calculate speed
        let elapsed = start.elapsed().as_secs_f64();
        let speed = if elapsed > 0.0 {
            downloaded as f64 / elapsed / 1024.0 / 1024.0 // MB/s
        } else {
            0.0
        };
        
        // Emit progress with BYTES INFO
        let _ = window.emit(&format!("download-progress-{}", task_id), serde_json::json!({
            "downloaded": downloaded,
            "total": total,
            "percent": if total > 0 { (downloaded as f64 / total as f64 * 100.0) as u8 } else { 0 },
            "speed": format!("{:.2} MB/s", speed),
            "bytes_info": format!("{} / {} bytes", downloaded, total), // DEBUG INFO
        }));
    }
    
    file.flush().await.map_err(|e| e.to_string())?;
    
    println!("✅ Downloaded {} bytes to {}", downloaded, path);
    
    Ok(())
}

async fn download_with_ranges(
    window: &tauri::Window,
    url: &str,
    path: &str,
    auth_token: &Option<String>,
    task_id: &str,
) -> Result<(), String> {
    const CHUNK_SIZE: u64 = 5 * 1024 * 1024; // 5MB chunks
    
    // Налаштування клієнта з агресивними таймаутами для Range-запитів
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(600))      // 10 хв на чанк (з запасом)
        .connect_timeout(Duration::from_secs(60)) // 60 сек на коннект
        .read_timeout(Duration::from_secs(300))   // 5 хв чекаємо дані в потоці
        .tcp_keepalive(Duration::from_secs(60))   // KeepAlive
        .build()
        .map_err(|e| e.to_string())?;
    
    // 1. Отримуємо розмір файлу (HEAD запит)
    let mut head_req = client.head(url);
    if let Some(token) = auth_token {
        head_req = head_req.header("Authorization", format!("Bearer {}", token));
    }
    
    let head_resp = head_req.send().await.map_err(|e| e.to_string())?;
    
    // Перевірка на 401 одразу
    if head_resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err("UNAUTHORIZED_401".to_string());
    }

    let total_size = head_resp
        .headers()
        .get(header::CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok())
        .ok_or("Cannot get file size from HEAD request")?;
    
    println!("📦 [Range] File size: {} bytes, downloading in {} MB chunks", total_size, CHUNK_SIZE / 1024 / 1024);
    
    // Створення директорій та файлу
    let path_obj = std::path::Path::new(path);
    if let Some(parent) = path_obj.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }
    
    let mut file = tokio::fs::File::create(path).await.map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    let start = std::time::Instant::now();
    
    // Цикл завантаження по діапазонах (Ranges)
    while downloaded < total_size {
        let end = std::cmp::min(downloaded + CHUNK_SIZE - 1, total_size - 1);
        let range = format!("bytes={}-{}", downloaded, end);
        
        let mut attempts = 0;
        let max_attempts = 10; // Збільшили кількість спроб для чанка до 10 (для поганої мережі)
        
        loop {
            attempts += 1;
            
            let mut req = client.get(url).header(header::RANGE, &range);
            if let Some(token) = auth_token {
                req = req.header("Authorization", format!("Bearer {}", token));
            }
            
            println!("⬇️ [Range] Requesting {}. Attempt {}/{}", range, attempts, max_attempts);

            let response_result = req.send().await;

            match response_result {
                // Спеціальна обробка 401
                Ok(resp) if resp.status() == reqwest::StatusCode::UNAUTHORIZED => {
                    return Err("UNAUTHORIZED_401".to_string());
                }

                // Успішне з'єднання (200 або 206 Partial Content)
                Ok(resp) if resp.status().is_success() || resp.status() == reqwest::StatusCode::PARTIAL_CONTENT => {
                    
                    // !!! КЛЮЧОВА ЗМІНА: Обережне читання тіла !!!
                    // Замість resp.bytes().await?, який вбиває процес при помилці,
                    // ми обробляємо помилку тут, щоб зробити continue loop.
                    
                    let bytes_result = resp.bytes().await;

                    match bytes_result {
                        Ok(bytes) => {
                            // Успішно скачали чанк - пишемо на диск
                            if let Err(e) = file.write_all(&bytes).await {
                                return Err(format!("File write error at {}: {}", downloaded, e));
                            }
                            
                            downloaded += bytes.len() as u64;
                            
                            // Розрахунок швидкості
                            let elapsed = start.elapsed().as_secs_f64();
                            let speed = if elapsed > 0.0 { downloaded as f64 / elapsed / 1024.0 / 1024.0 } else { 0.0 };
                            
                            // Відправка прогресу в JS
                            let _ = window.emit(&format!("download-progress-{}", task_id), serde_json::json!({
                                "downloaded": downloaded,
                                "total": total_size,
                                "percent": (downloaded as f64 / total_size as f64 * 100.0) as u8,
                                "speed": format!("{:.2} MB/s", speed),
                                "bytes_info": format!("{} / {} bytes (range: {})", downloaded, total_size, range),
                            }));
                            
                            break; // Чанк успішний, виходимо з loop retry і переходимо до наступного чанка
                        },
                        Err(e) => {
                            // Ось тут ловимо "error decoding response body" / "stream interrupted"
                            println!("⚠️ Body read failed (attempt {}/{}): {}", attempts, max_attempts, e);
                            
                            if attempts >= max_attempts {
                                return Err(format!("Failed to read body chunk {} after {} attempts: {}", range, max_attempts, e));
                            }
                            
                            // Пауза перед ретраєм ЦЬОГО Ж чанка
                            tokio::time::sleep(Duration::from_secs(2)).await;
                            continue; 
                        }
                    }
                }

                // Помилки з'єднання (timeout, DNS і т.д.)
                Err(e) if attempts < max_attempts => {
                    println!("⚠️ Connection failed (attempt {}/{}): {}", attempts, max_attempts, e);
                    tokio::time::sleep(Duration::from_secs(2u64.pow(attempts - 1))).await; // Backoff
                    continue;
                }

                // Фатальні помилки після всіх спроб
                Err(e) => {
                    return Err(format!("Range request failed after {} attempts: {}", max_attempts, e));
                }
                
                // Інші HTTP помилки (404, 500...)
                Ok(resp) => {
                    return Err(format!("Unexpected status code: {}", resp.status()));
                }
            }
        }
    }
    
    file.flush().await.map_err(|e| e.to_string())?;
    println!("✅ Downloaded {} bytes with ranges", downloaded);
    
    Ok(())
}

async fn download_minimal(
    window: &tauri::Window,
    url: &str,
    path: &str,
    auth_token: &Option<String>,
    task_id: &str,
) -> Result<(), String> {
    // Minimal config for worst connections
    let client = Client::builder()
        .timeout(Duration::from_secs(600)) // 10 min total
        .connect_timeout(Duration::from_secs(60))
        .pool_max_idle_per_host(0)
        .build()
        .map_err(|e| e.to_string())?;
    
    let mut req = client.get(url);
    if let Some(token) = auth_token {
        req = req.header("Authorization", format!("Bearer {}", token));
    }
    
    let bytes = req.send().await.map_err(|e| e.to_string())?.bytes().await.map_err(|e| e.to_string())?;
    
    let path_obj = std::path::Path::new(path);
    if let Some(parent) = path_obj.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }
    
    tokio::fs::write(path, &bytes).await.map_err(|e| e.to_string())?;
    
    println!("✅ Downloaded {} bytes (minimal fallback)", bytes.len());
    
    Ok(())
}

#[tauri::command]
pub async fn download_file_heavy(
    window: Window,
    url: String,
    path: String,
    auth_token: Option<String>,
    task_id: String,
) -> Result<(), String> {
    println!("🛡️ Starting HEAVY download for: {}", url);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(300)) // 5 хвилин загальний таймаут
        .connect_timeout(Duration::from_secs(60)) // Довге з'єднання
        .read_timeout(Duration::from_secs(120)) // Чекаємо пакети до 2 хвилин
        .tcp_keepalive(Duration::from_secs(30)) // Пінгуємо з'єднання
        .build()
        .map_err(|e| e.to_string())?;

    let mut request = client.get(&url);
    if let Some(token) = auth_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }

    let mut response = request.send().await.map_err(|e| format!("Connection failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP Error: {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    
    // Створення директорій
    if let Some(parent) = std::path::Path::new(&path).parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }

    let mut file = tokio::fs::File::create(&path).await.map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;

    // 2. Стрімінг чанками з детальним логуванням
    while let Some(chunk) = response.chunk().await.map_err(|e| format!("Chunk error: {}", e))? {
        file.write_all(&chunk).await.map_err(|e| format!("Write error: {}", e))?;
        downloaded += chunk.len() as u64;

        // 3. Відправка події з БАЙТАМИ (як ти просив для дебагу)
        let _ = window.emit(&format!("download-progress-{}", task_id), serde_json::json!({
            "downloaded": downloaded,
            "total": total_size,
            "bytes_info": format!("{}/{}", downloaded, total_size), // <--- ДЛЯ ДЕБАГУ
            "percent": if total_size > 0 { (downloaded as f64 / total_size as f64 * 100.0) as u8 } else { 0 }
        }));
    }

    file.flush().await.map_err(|e| e.to_string())?;
    
    println!("✅ Heavy download finished: {} bytes", downloaded);
    Ok(())
}