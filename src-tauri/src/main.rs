// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Deserialize;
use tauri::path::BaseDirectory;
use tokio::io::AsyncReadExt;
use std::{fs, path::PathBuf, process::Stdio};
use std::{path::Path, time::Duration};
use std::{sync::Arc};
use tauri::async_runtime::spawn;
use tauri::{window, AppHandle, Emitter, Manager, State, Window};
use tokio::process::Command;
use tokio::time::sleep;
use globset::{GlobBuilder, GlobSetBuilder};
mod download;

use download::{download_from_drive_api, unzip_with_progress, download_and_unzip_drive};
mod utils;
use utils::{
    get_local_version_json, get_total_memory_mb, is_dir_empty, list_mod_jar_files, toggle_mod_file, download_mod_file
};

mod rungame;
use rungame::launch_minecraft;

mod auth;
use auth::authenticate;

mod reset;
use reset::reset_repo_selective;

#[derive(Deserialize)]
struct GitCloneArgs {
    git_path: String,
    repository_url: String,
    destination_path: String,
}

#[derive(Deserialize, Clone)]
struct GitPullArgs {
    git_path: String,
    repo_path: String,
}

const CREATE_NO_WINDOW: u32 = 0x0800_0000;


#[derive(Deserialize)]
struct ResetWithIgnoreArgs {
    git_path: String,
    repo_path: String,
    ignore_patterns: Vec<String>, // паттерны для игнорирования, например "Melorium/mods/*.jar"
}

#[derive(Deserialize)]
struct CleanWithIgnoreArgs {
    git_path: String,
    repo_path: String,
    ignore_patterns: Vec<String>,
}

/// Создаёт GlobSet из паттернов
fn build_globset(patterns: &[String]) -> Result<globset::GlobSet, String> {
    let mut builder = GlobSetBuilder::new();
    for pattern in patterns {
        let glob = GlobBuilder::new(pattern)
            .case_insensitive(true)
            .build()
            .map_err(|e| format!("Failed to build glob pattern '{}': {}", pattern, e))?;
        builder.add(glob);
    }
    builder.build().map_err(|e| format!("Failed to build globset: {}", e))
}

#[derive(serde::Deserialize)]
struct InstallLfsArgs { git_path: String }

#[tauri::command]
async fn install_lfs(args: InstallLfsArgs) -> Result<(), String> {
    // проверим наличие подкоманды
    let ver = Command::new(&args.git_path)
        .args(["lfs", "version"])
        .stdout(Stdio::piped()).stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .output().await
        .map_err(|e| format!("git lfs version: {e}"))?;
    if !ver.status.success() {
        return Err(format!("'git lfs' недоступен: {}", String::from_utf8_lossy(&ver.stderr)));
    }

    // установка фильтров
    let st = Command::new(&args.git_path)
        .args(["lfs", "install", "--force"])
        .stdout(Stdio::null()).stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .status().await
        .map_err(|e| format!("git lfs install: {e}"))?;
    if !st.success() {
        return Err(format!("git lfs install exit {}", st.code().unwrap_or(-1)));
    }
    Ok(())
}

#[tauri::command]
async fn pull_repo(app: tauri::AppHandle, args: GitPullArgs) -> Result<(), String> {
    let emit = |event: &str, payload: &str| {
        let _ = app.emit(event, payload.to_string());
    };

    emit("git-start", "fetch");

    // fetch --progress
    let mut fetch = Command::new(&args.git_path)
        .current_dir(&args.repo_path)
        .env("GIT_FLUSH","1")
        .env("GIT_TERMINAL_PROMPT","0")
        .env("GCM_INTERACTIVE","Never")
        .env("GIT_ASKPASS","")
        .env("SSH_ASKPASS","")
        .args(["-c","credential.helper=","-c","credential.interactive=never"])
        .args(["fetch","--progress"])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("spawn fetch: {e}"))?;

    {
        // stream stderr inline until EOF
        let mut err = fetch.stderr.take().unwrap();
        let mut buf = [0u8; 4096];
        let mut acc = Vec::<u8>::new();
        loop {
            match err.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    for &b in &buf[..n] {
                        if b == b'\n' || b == b'\r' {
                            if !acc.is_empty() {
                                if let Ok(line) = String::from_utf8(acc.clone()) {
                                    emit("git-progress", &format!("[fetch] {line}"));
                                }
                                acc.clear();
                            }
                        } else { acc.push(b); }
                    }
                }
                Err(e) => return Err(format!("read fetch stderr: {e}")),
            }
        }
    }
    let st_fetch = fetch.wait().await.map_err(|e| format!("wait fetch: {e}"))?;
    if !st_fetch.success() {
        emit("git-error", "fetch failed");
        return Err(format!("git fetch exit {}", st_fetch.code().unwrap_or(-1)));
    }

    emit("git-start", "pull");

    // pull --rebase --autostash
    let mut pull = Command::new(&args.git_path)
        .current_dir(&args.repo_path)
        .env("GIT_FLUSH","1")
        .env("GIT_TERMINAL_PROMPT","0")
        .env("GCM_INTERACTIVE","Never")
        .env("GIT_ASKPASS","")
        .env("SSH_ASKPASS","")
        .args([
            "-c","credential.helper=",
            "-c","credential.interactive=never",
            "-c","user.name=Auto",
            "-c","user.email=auto@example.invalid",
        ])
        .args(["pull","--progress","--rebase","--autostash","--strategy-option=theirs"])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("spawn pull: {e}"))?;

    {
        let mut err = pull.stderr.take().unwrap();
        let mut buf = [0u8; 4096];
        let mut acc = Vec::<u8>::new();
        loop {
            match err.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    for &b in &buf[..n] {
                        if b == b'\n' || b == b'\r' {
                            if !acc.is_empty() {
                                if let Ok(line) = String::from_utf8(acc.clone()) {
                                    emit("git-progress", &line);
                                }
                                acc.clear();
                            }
                        } else { acc.push(b); }
                    }
                }
                Err(e) => return Err(format!("read pull stderr: {e}")),
            }
        }
    }
    let st_pull = pull.wait().await.map_err(|e| format!("wait pull: {e}"))?;
    if !st_pull.success() {
        emit("git-error", "pull failed");
        return Err(format!("git pull exit {}", st_pull.code().unwrap_or(-1)));
    }

    emit("git-start", "lfs");

    // lfs pull --progress
    let mut lfs = Command::new(&args.git_path)
        .current_dir(&args.repo_path)
        .env("GIT_FLUSH","1")
        .env("GIT_TERMINAL_PROMPT","0")
        .env("GCM_INTERACTIVE","Never")
        .env("GIT_ASKPASS","")
        .env("SSH_ASKPASS","")
        .args(["-c","credential.helper=","-c","credential.interactive=never"])
        .args(["lfs","pull"])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("spawn lfs pull: {e}"))?;

    {
        let mut err = lfs.stderr.take().unwrap();
        let mut buf = [0u8; 4096];
        let mut acc = Vec::<u8>::new();
        loop {
            match err.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    for &b in &buf[..n] {
                        if b == b'\n' || b == b'\r' {
                            if !acc.is_empty() {
                                if let Ok(line) = String::from_utf8(acc.clone()) {
                                    emit("git-progress", &format!("[lfs] {line}"));
                                }
                                acc.clear();
                            }
                        } else { acc.push(b); }
                    }
                }
                Err(e) => return Err(format!("read lfs stderr: {e}")),
            }
        }
    }
    let st_lfs = lfs.wait().await.map_err(|e| format!("wait lfs: {e}"))?;
    if !st_lfs.success() {
        emit("git-error", "lfs failed");
        return Err(format!("git lfs pull exit {}", st_lfs.code().unwrap_or(-1)));
    }

    emit("git-complete", "ok");
    Ok(())
}
// fn sync_disabled_mods(mods_dir: &str, disabled_file: &str) {
//     // 1. Прочитать список отключённых модов
//     let disabled = std::fs::read_to_string(disabled_file)
//         .unwrap()
//         .lines()
//         .map(|l| l.trim())
//         .filter(|l| !l.is_empty())
//         .collect::<Vec<_>>();

//     for mod_name in disabled {
//         let mod_path = Path::new(mods_dir).join(mod_name);
//         let disabled_path = Path::new(mods_dir).join(format!("{}.disabled", mod_name));
//         // Если есть обновлённая версия включённого мода — переименовать
//         if mod_path.exists() {
//             // Удалить старый .disabled если вдруг есть
//             if disabled_path.exists() {
//                 let _ = fs::remove_file(&disabled_path);
//             }
//             // Переименовать включённый в отключённый
//             let _ = fs::rename(&mod_path, &disabled_path);
//         }
//     }
// }



#[derive(Deserialize)]
struct GitCheckUpdateArgs {
    git_path: String,
    repo_path: String,
}

#[tauri::command]
async fn check_git_update(args: GitCheckUpdateArgs) -> Result<bool, String> {
    // Step 1: git fetch
    let fetch_status = Command::new(&args.git_path)
        .current_dir(&args.repo_path)
        .arg("fetch")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .await
        .map_err(|e| format!("Failed to fetch: {}", e))?;

    if !fetch_status.success() {
        return Err(format!(
            "git fetch exited with code: {}",
            fetch_status.code().unwrap_or(-1)
        ));
    }

    // Step 2: git rev-parse HEAD
    let local_output = Command::new(&args.git_path)
        .current_dir(&args.repo_path)
        .args(["rev-parse", "HEAD"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .await
        .map_err(|e| format!("Failed to get local hash: {}", e))?;

    // Step 3: git rev-parse origin/main
    let remote_output = Command::new(&args.git_path)
        .current_dir(&args.repo_path)
        .args(["rev-parse", "origin/main"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .await
        .map_err(|e| format!("Failed to get remote hash: {}", e))?;

    let local_hash = String::from_utf8_lossy(&local_output.stdout)
        .trim()
        .to_string();
    let remote_hash = String::from_utf8_lossy(&remote_output.stdout)
        .trim()
        .to_string();

    // println!("Local hash: {}", local_hash);
    // println!("Remote hash: {}", remote_hash);

    // if local_hash == remote_hash {
    //     println!("✅ Repository is up to date");
    // } else {
    //     println!("⬆️  Update available");
    // }

    Ok(local_hash != remote_hash)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_hwinfo::init())
        .invoke_handler(tauri::generate_handler![
            pull_repo,
            get_local_version_json,
            is_dir_empty,
            launch_minecraft,
            authenticate,
            get_total_memory_mb,
            toggle_mod_file,
            list_mod_jar_files,
            check_git_update,
            download_mod_file,
            download_from_drive_api,
            unzip_with_progress,
            download_and_unzip_drive,
            reset_repo_selective,
            install_lfs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}
