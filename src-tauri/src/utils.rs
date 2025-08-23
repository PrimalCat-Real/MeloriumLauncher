use std::path::Path;
use std::path::PathBuf;
use sysinfo::System;
use tokio::fs;
use tokio::fs::read_to_string;
use tokio_stream::StreamExt;
use reqwest::Client;
use std::fs::File;
use std::io::copy;

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

// #[tauri::command]
// pub async fn toggle_mod_file(path: String, enable: bool) -> Result<(), String> {
//     let stem = Path::new(&path)
//         .file_stem()
//         .and_then(|s| s.to_str())
//         .unwrap_or(&path);

//     let jar      = Path::new(stem).with_extension("jar");
//     let disabled = Path::new(stem).with_extension("jar.disabled");

//     let (src, dst) = if enable {
//         (&disabled, &jar)
//     } else {
//         (&jar, &disabled)
//     };

//     if !src.exists() {
//         return Ok(());
//     }

// fs::rename(src, dst).await
//     .map_err(|e| format!("Не удалось переименовать мод: {}", e))
// }

#[tauri::command]
pub async fn toggle_mod_file(path: String, enable: bool) -> Result<(), String> {
    // Err(format!("Путь: {}", path))
    let jar_path = Path::new(&path).with_extension("jar");

    let disabled_path = Path::new(&path).with_extension("jar.disabled");
    // println!(
    //     "Проверка пути:\n  jar_path: {:?} (exists: {})\n  disabled_path: {:?} (exists: {})\n  enable: {}",
    //     jar_path,
    //     Path::new(&jar_path).exists(),
    //     disabled_path,
    //     Path::new(&disabled_path).exists(),
    //     enable
    // );
    let (current, target) = if enable {
        (&disabled_path, &jar_path)
    } else {
        (&jar_path, &disabled_path)
    };

    if current == target {
        return Ok(());
    }

    // fs::rename(current, target).await
    //     .map_err(|e| format!("Не удалось переименовать мод: {}", e))
    match fs::rename(current, target).await {
        Ok(_) => Ok(()),
        Err(e) => {
            println!(
                "Ошибка при отключения мода: {}\nFROM: {}\nTO: {}",
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
        return Err("Указанный путь не существует".to_string());
    }

    if !path.is_dir() {
        return Err("Указанный путь не является директорией".to_string());
    }

    let mut jar_files = Vec::new();

    let mut entries = match fs::read_dir(&path).await {
        Ok(entries) => entries,
        Err(err) => return Err(format!("Ошибка при чтении директории: {}", err)),
    };

    while let Some(entry) = entries.next_entry().await.transpose() {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if let Some(path_str) = path.to_str() {
                        jar_files.push(path_str.to_string());
                    }
                }
            }
        }
    }
    Ok(jar_files)
}


#[tauri::command]
pub async fn download_mod_file(
    url: String,
    path: String,
    mod_name: String,
    username: String,
    password: String,
) -> Result<(), String> {
    let client = Client::new();

    let resp = client
        .post(&url)
        .json(&serde_json::json!({
            "modName": mod_name,
            "username": username,
            "password": password
        }))
        .send()
        .await
        .map_err(|e| format!("Ошибка при запросе: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Сервер вернул ошибку: {}", resp.status()));
    }

    let mut file_path = PathBuf::from(path);
    file_path.push(&mod_name);

    let mut file = File::create(&file_path)
        .map_err(|e| format!("Не удалось создать файл: {}", e))?;

    let mut content = resp
        .bytes_stream();

    while let Some(chunk) = content.next().await {
        let data = chunk.map_err(|e| format!("Ошибка чтения данных: {}", e))?;
        copy(&mut data.as_ref(), &mut file)
            .map_err(|e| format!("Ошибка записи файла: {}", e))?;
    }

    Ok(())
}