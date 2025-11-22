#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use reqwest::Client;
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Instant;
use std::{fs, io};
use tauri::{Emitter, Manager, command};
use tokio::{fs::File, io::AsyncWriteExt};
use tokio_stream::StreamExt;
use zip::ZipArchive;
use std::time::UNIX_EPOCH;
use sha2::{Sha256, Digest};
#[derive(Serialize, Clone)]
pub struct StagePayload<'a> {
    label: &'a str,
    taskId: String,
}
#[derive(Serialize, Clone)]
pub struct DownloadStartPayload {
    name: String,
    totalBytes: u64,
    taskId: String,
}
#[derive(Serialize, Clone)]
pub struct DownloadProgressPayload {
    downloadedBytes: u64,
    totalBytes: u64,
    speedBps: f64,
    etaSec: u64,
    taskId: String,
}
#[derive(Serialize, Clone)]
pub struct DownloadDonePayload {
    path: String,
    taskId: String,
}
#[derive(Serialize, Clone)]
pub struct UnzipStartPayload {
    totalEntries: usize,
    taskId: String,
}
#[derive(Serialize, Clone)]
pub struct UnzipProgressPayload {
    entriesDone: usize,
    percent: f64,
    taskId: String,
}
#[derive(Serialize, Clone)]
pub struct UnzipDonePayload {
    destination: String,
    taskId: String,
}
#[derive(Serialize, Clone)]
pub struct TaskErrorPayload {
    message: String,
    taskId: String,
}

fn emit_stage(window: &tauri::Window, task_id: &str, label: &str) {
    let _ = window.emit(
        "stage",
        StagePayload {
            label,
            taskId: task_id.to_string(),
        },
    );
}

#[tauri::command]
pub async fn download_from_drive_api(
    window: tauri::Window,
    file_id: String,
    api_key: String,
    destination: String,
    display_name: String,
    task_id: String,
) -> Result<(), String> {
    emit_stage(&window, &task_id, "Инициализация");

    let url = format!(
        "https://www.googleapis.com/drive/v3/files/{}?alt=media&key={}",
        file_id, api_key
    );

    let client = Client::new();
    let res = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let total = res.content_length().unwrap_or(0);
    let mut file = File::create(&destination)
        .await
        .map_err(|e| format!("Create file error: {}", e))?;
    let mut stream = res.bytes_stream();

    let _ = window.emit(
        "download:start",
        DownloadStartPayload {
            name: display_name.clone(),
            totalBytes: total,
            taskId: task_id.clone(),
        },
    );

    emit_stage(&window, &task_id, "Загрузка");

    let start = Instant::now();
    let mut downloaded: u64 = 0;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Write error: {}", e))?;
        downloaded += chunk.len() as u64;

        let elapsed = start.elapsed().as_secs_f64().max(0.001);
        let speed_bps = (downloaded as f64) / elapsed;
        let eta_sec = if total > 0 && speed_bps > 0.0 {
            ((total - downloaded) as f64 / speed_bps).round() as u64
        } else {
            0
        };

        let _ = window.emit(
            "download:progress",
            DownloadProgressPayload {
                downloadedBytes: downloaded,
                totalBytes: total,
                speedBps: speed_bps,
                etaSec: eta_sec,
                taskId: task_id.clone(),
            },
        );
    }

    file.flush()
        .await
        .map_err(|e| format!("Flush error: {}", e))?;
    file.sync_all()
        .await
        .map_err(|e| format!("Sync error: {}", e))?;

    let _ = window.emit(
        "download:done",
        DownloadDonePayload {
            path: destination.clone(),
            taskId: task_id.clone(),
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn unzip_with_progress(
    window: tauri::Window,
    source: String,
    destination: String,
    remove_source: bool,
    task_id: String,
) -> Result<(), String> {
    emit_stage(&window, &task_id, "Распаковка");

    // Открываем zip-файл
    let reader_file = std::fs::File::open(&source).map_err(|e| e.to_string())?;
    let mut zip_archive = ZipArchive::new(reader_file).map_err(|e| e.to_string())?;
    let total_entries = zip_archive.len();

    let _ = window.emit(
        "unzip:start",
        UnzipStartPayload {
            totalEntries: total_entries,
            taskId: task_id.clone(),
        },
    );

    for entry_index in 0..total_entries {
        let mut zip_file = zip_archive.by_index(entry_index).map_err(|e| e.to_string())?;
        let output_path = match zip_file.enclosed_name() {
            Some(path) => Path::new(&destination).join(path),
            None => continue,
        };

        if zip_file.is_dir() {
            fs::create_dir_all(&output_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = output_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            if output_path.exists() {
                fs::remove_file(&output_path).map_err(|e| e.to_string())?;
            }
            let mut outfile = std::fs::File::create(&output_path).map_err(|e| e.to_string())?;
            io::copy(&mut zip_file, &mut outfile).map_err(|e| e.to_string())?;
        }

        let percent = ((entry_index + 1) as f64 / total_entries as f64) * 100.0;
        let _ = window.emit(
            "unzip:progress",
            UnzipProgressPayload {
                entriesDone: entry_index + 1,
                percent,
                taskId: task_id.clone(),
            },
        );
    }

    // Критично: закрыть дескрипторы архива перед удалением исходника.
    drop(zip_archive);

    // Удаляем исходный архив после успешной распаковки.
    if remove_source {
        // Небольшой устойчивый ретрай для Windows, где файл мог ещё удерживаться антивирусом/индексатором.
        let mut last_err: Option<std::io::Error> = None;
        for _ in 0..5 {
            match fs::remove_file(&source) {
                Ok(_) => {
                    last_err = None;
                    break;
                }
                Err(err) => {
                    last_err = Some(err);
                    std::thread::sleep(std::time::Duration::from_millis(200));
                }
            }
        }
        if let Some(err) = last_err {
            return Err(format!("Failed to remove source archive: {}", err));
        }
    }

    let _ = window.emit(
        "unzip:done",
        UnzipDonePayload {
            destination: destination.clone(),
            taskId: task_id.clone(),
        },
    );

    emit_stage(&window, &task_id, "Готово");
    Ok(())
}


#[tauri::command]
pub async fn download_and_unzip_drive(
    window: tauri::Window,
    file_id: String,
    api_key: String,
    temp_zip_path: String,
    extract_to: String,
    display_name: String,
    remove_zip: bool,
    task_id: String,
) -> Result<(), String> {
    // Stage: Инициализация
    emit_stage(&window, &task_id, "Инициализация");

    // Ensure dirs
    if let Some(parent) = PathBuf::from(&temp_zip_path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    if !Path::new(&extract_to).exists() {
        fs::create_dir_all(&extract_to).map_err(|e| e.to_string())?;
    }

    // Download
    if let Err(e) = download_from_drive_api(
        window.clone(),
        file_id,
        api_key,
        temp_zip_path.clone(),
        display_name,
        task_id.clone(),
    )
    .await
    {
        let _ = window.emit(
            "task:error",
            TaskErrorPayload {
                message: e.clone(),
                taskId: task_id.clone(),
            },
        );
        return Err(e);
    }

    // Unzip
    if let Err(e) = unzip_with_progress(
        window.clone(),
        temp_zip_path,
        extract_to.clone(),
        remove_zip,
        task_id.clone(),
    )
    .await
    {
        let _ = window.emit(
            "task:error",
            TaskErrorPayload {
                message: e.clone(),
                taskId: task_id.clone(),
            },
        );
        return Err(e);
    }

    Ok(())
}


#[derive(serde::Serialize)]
pub struct FileMeta {
    size: u64,
    last_modified: u64,
    exists: bool,
}

#[command]
pub async fn get_files_meta_batch(paths: Vec<String>) -> Result<HashMap<String, FileMeta>, String> {
    let mut results = HashMap::new();

    for path_str in paths {
        let path_buf = PathBuf::from(&path_str);
        
        if let Ok(metadata) = tokio::fs::metadata(&path_buf).await {
            let modified_ms = metadata.modified()
                .unwrap_or(UNIX_EPOCH)
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;

            results.insert(path_str, FileMeta {
                size: metadata.len(),
                last_modified: modified_ms,
                exists: true,
            });
        } else {
            results.insert(path_str, FileMeta {
                size: 0,
                last_modified: 0,
                exists: false,
            });
        }
    }

    Ok(results)
}

#[command]
pub async fn hash_files_batch(paths: Vec<String>) -> Result<HashMap<String, String>, String> {
    let result = tokio::task::spawn_blocking(move || {
        let mut results = HashMap::new();
        for path_str in paths {
            let path = Path::new(&path_str);
            if let Ok(bytes) = std::fs::read(path) {
                let mut hasher = Sha256::new();
                hasher.update(&bytes);
                let result = hasher.finalize();
                let hash_hex = format!("{:x}", result);
                results.insert(path_str, hash_hex);
            }
        }
        results
    }).await.map_err(|e| format!("Hashing task failed: {}", e))?;

    Ok(result)
}