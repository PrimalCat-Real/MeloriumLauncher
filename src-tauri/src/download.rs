#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use reqwest::Client;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::Instant;
use std::{fs, io};
use tauri::{Emitter, Manager};
use tokio::{fs::File, io::AsyncWriteExt};
use tokio_stream::StreamExt;
use zip::ZipArchive;

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

    let reader = std::fs::File::open(&source).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(reader).map_err(|e| e.to_string())?;
    let total_entries = archive.len();

    let _ = window.emit(
        "unzip:start",
        UnzipStartPayload {
            totalEntries: total_entries,
            taskId: task_id.clone(),
        },
    );

    for i in 0..total_entries {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => Path::new(&destination).join(path),
            None => continue,
        };

        if file.is_dir() {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            if outpath.exists() {
                fs::remove_file(&outpath).map_err(|e| e.to_string())?;
            }
            let mut outfile = std::fs::File::create(&outpath).map_err(|e| e.to_string())?;
            io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }

        let percent = ((i + 1) as f64 / total_entries as f64) * 100.0;
        let _ = window.emit(
            "unzip:progress",
            UnzipProgressPayload {
                entriesDone: i + 1,
                percent,
                taskId: task_id.clone(),
            },
        );
    }

    if remove_source {
        let _ = fs::remove_file(&source);
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
