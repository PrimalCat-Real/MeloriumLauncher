// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Deserialize;
use std::process::Stdio;
use std::{path::Path, time::Duration};
use std::{path::PathBuf, sync::Arc};
use tauri::async_runtime::spawn;
use tauri::{window, AppHandle, Emitter, Manager, State, Window};
use tokio::process::Command;
use tokio::time::sleep;
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

#[derive(Deserialize)]
struct GitCloneArgs {
    git_path: String,
    repository_url: String,
    destination_path: String,
}

#[derive(Deserialize)]
struct GitPullArgs {
    git_path: String,
    repo_path: String,
}

// #[tauri::command]
// async fn clone_repo(window: tauri::Window, args: GitCloneArgs) -> Result<(), String> {
//     let mut command = tokio::process::Command::new(&args.git_path);
//     command
//         .arg("clone")
//         .arg("--progress")
//         .arg("--verbose")
//         .arg(&args.repository_url)
//         .arg(&args.destination_path)
//         .stdout(std::process::Stdio::piped())
//         .stderr(std::process::Stdio::piped());

//     let mut child = command.spawn().map_err(|e| format!("Failed to start git: {}", e))?;

//     let stdout = child.stdout.take().unwrap();
//     let stderr = child.stderr.take().unwrap();
//     let window_clone = window.clone();
//     tauri::async_runtime::spawn(async move {
//         use tokio::io::{AsyncBufReadExt, BufReader};
//         let mut reader = BufReader::new(stdout).lines();
//         while let Ok(Some(line)) = reader.next_line().await {
//             let _ = window_clone.emit("git-progress", Some(line));
//         }
//         let mut err_reader = BufReader::new(stderr).lines();
//         while let Ok(Some(line)) = err_reader.next_line().await {
//             let _ = window_clone.emit("git-progress", Some(line));
//         }
//     });

//     let status = child.wait().await.map_err(|e| format!("Git failed: {}", e))?;
//     if !status.success() {
//         return Err(format!("Git exited with code: {}", status.code().unwrap_or(-1)));
//     }
//     Ok(())
// }
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[tauri::command]
async fn clone_repo(window: tauri::Window, args: GitCloneArgs) -> Result<(), String> {
    let mut command = tokio::process::Command::new(&args.git_path);
    command
        .arg("clone")
        .arg("--progress")
        .arg("--verbose")
        .arg(&args.repository_url)
        .arg(&args.destination_path)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW);

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to start git: {}", e))?;

    let mut stderr = child.stderr.take().unwrap();
    let window_clone = window.clone();

    tauri::async_runtime::spawn(async move {
        use tokio::io::AsyncReadExt;

        let mut buffer = [0u8; 1024];
        let mut partial = String::new();

        loop {
            match stderr.read(&mut buffer).await {
                Ok(0) => break,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buffer[..n]);
                    for c in chunk.chars() {
                        if c == '\r' || c == '\n' {
                            if !partial.is_empty() {
                                let _ = window_clone.emit("git-progress", Some(partial.clone()));
                                partial.clear();
                            }
                        } else {
                            partial.push(c);
                        }
                    }
                }
                Err(_) => break,
            }
        }

        if !partial.is_empty() {
            let _ = window_clone.emit("git-progress", Some(partial));
        }
    });

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Git failed: {}", e))?;
    if !status.success() {
        return Err(format!(
            "Git exited with code: {}",
            status.code().unwrap_or(-1)
        ));
    }
    Ok(())
}

#[tauri::command]
async fn pull_repo(window: Window, args: GitPullArgs) -> Result<(), String> {
    let mut reset_cmd = Command::new(&args.git_path);
    reset_cmd
        .current_dir(&args.repo_path)
        .arg("reset")
        .arg("--hard")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW); 
    reset_cmd
        .spawn()
        .map_err(|e| format!("Failed to start git reset: {}", e))?
        .wait()
        .await
        .map_err(|e| format!("Reset failed: {}", e))?;

    let mut command = Command::new(&args.git_path);
    command
        .current_dir(&args.repo_path)
        .arg("pull")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW);

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to start git pull: {}", e))?;
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let window_clone = window.clone();
    spawn(async move {
        use tokio::io::{AsyncBufReadExt, BufReader};
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = window_clone.emit("git-progress", Some(line));
        }
        let mut err_reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = err_reader.next_line().await {
            let _ = window_clone.emit("git-progress", Some(line));
        }
    });

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Git failed: {}", e))?;
    if !status.success() {
        return Err(format!(
            "Git exited with code: {}",
            status.code().unwrap_or(-1)
        ));
    }
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
struct ResetRepoArgs {
    git_path: String,
    repo_path: String,
}

#[tauri::command]
async fn reset_repo(_window: tauri::Window, args: ResetRepoArgs) -> Result<(), String> {
    // 1. Initialize the directory as a Git repository if it isn't already.
    let mut init = tokio::process::Command::new(&args.git_path);
    init
        .current_dir(&args.repo_path)
        .args(["init"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW);

    let init_status = init
        .spawn()
        .map_err(|e| format!("spawn init: {e}"))?
        .wait()
        .await
        .map_err(|e| format!("init failed: {e}"))?;

    if !init_status.success() {
        // You might want to handle this differently, but for now, let's return an error.
        return Err(format!(
            "git init exited with code: {}",
            init_status.code().unwrap_or(-1)
        ));
    }

    // 2. git reset --hard HEAD
    let mut reset = tokio::process::Command::new(&args.git_path);
    reset
        .current_dir(&args.repo_path)
        .args(["reset", "--hard", "HEAD"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW);

    let reset_status = reset
        .spawn()
        .map_err(|e| format!("spawn reset: {e}"))?
        .wait()
        .await
        .map_err(|e| format!("reset failed: {e}"))?;

    if !reset_status.success() {
        return Err(format!(
            "git reset exited with code: {}",
            reset_status.code().unwrap_or(-1)
        ));
    }

    // 3. git clean -fd  (remove untracked files/dirs)
    let mut clean = tokio::process::Command::new(&args.git_path);
    clean
        .current_dir(&args.repo_path)
        .args(["clean", "-fd"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW);

    let clean_status = clean
        .spawn()
        .map_err(|e| format!("spawn clean: {e}"))?
        .wait()
        .await
        .map_err(|e| format!("clean failed: {e}"))?;

    if !clean_status.success() {
        return Err(format!(
            "git clean exited with code: {}",
            clean_status.code().unwrap_or(-1)
        ));
    }

    Ok(())
}

#[derive(Deserialize)]
struct AssumeUnchangedArgs {
    base_dir: String,
    files: Vec<String>,
}

#[tauri::command]
async fn skip_worktree(args: AssumeUnchangedArgs) -> Result<(), String> {
    let mods_dir = Path::new(&args.base_dir);
    if !mods_dir.exists() {
        return Err(format!("Mods dir not found: {:?}", mods_dir));
    }

    for file in &args.files {
        let full_path = {
            let path = Path::new(file);
            if path.is_absolute() {
                path.to_path_buf()
            } else {
                mods_dir.join(path)
            }
        };

        if !full_path.exists() {
            println!("⛔️ Пропущен (не найден): {}", full_path.display());
            continue;
        }

        // Проверка: отслеживается ли файл git'ом
        let ls_output = tokio::process::Command::new("git")
            .current_dir(&args.base_dir)
            .arg("ls-files")
            .arg("--error-unmatch")
            .arg(&full_path)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .await;

        match ls_output {
            Ok(ref output) if !output.status.success() => {
                println!(
                    "⛔️ Файл не отслеживается git'ом, пропущен: {}",
                    full_path.display()
                );
                continue;
            }
            Err(e) => {
                println!(
                    "❌ Ошибка при проверке отслеживания файла {}: {}",
                    full_path.display(),
                    e
                );
                continue;
            }
            _ => {}
        }

        // Retry loop
        let mut success = false;
        for attempt in 1..=3 {
            println!(
                "⏳ Попытка {}: git --skip-worktree {}",
                attempt,
                full_path.display()
            );

            let status = tokio::process::Command::new("git")
                .current_dir(&args.base_dir)
                .arg("update-index")
                .arg("--skip-worktree")
                .arg(&full_path)
                .creation_flags(CREATE_NO_WINDOW)
                .status()
                .await;

            match status {
                Ok(s) if s.success() => {
                    println!("✅ skip-worktree: {}", full_path.display());
                    success = true;
                    break;
                }
                Ok(s) => {
                    println!(
                        "⚠️ Git exited with code {} on attempt {} for {}",
                        s.code().unwrap_or(-1),
                        attempt,
                        full_path.display()
                    );
                }
                Err(e) => {
                    println!(
                        "❌ Git spawn failed on attempt {} for {}: {}",
                        attempt,
                        full_path.display(),
                        e
                    );
                }
            }

            sleep(Duration::from_millis(500)).await;
        }

        if !success {
            return Err(format!(
                "git update-index --skip-worktree failed after 3 attempts for {}",
                full_path.display()
            ));
        }
    }

    Ok(())
}

// #[tauri::command]
// async fn skip_worktree(args: AssumeUnchangedArgs) -> Result<(), String> {
//     let mods_dir = Path::new(&args.base_dir);
//     if !mods_dir.exists() {
//         return Err(format!("Mods dir not found: {:?}", mods_dir));
//     }

//     // for file in &args.files {
//     //     let full_path = mods_dir.join(file);

//     //     if !full_path.exists() {
//     //         continue;
//     //     }

//     //     let mut cmd = tokio::process::Command::new("git");
//     //     cmd.current_dir(&args.base_dir)
//     //         .arg("update-index")
//     //         .arg("--skip-worktree")
//     //         .arg(full_path);

//     //     let status = cmd
//     //         .status()
//     //         .await
//     //         .map_err(|e| format!("git spawn failed: {}", e))?;

//     //     if !status.success() {
//     //         return Err(format!(
//     //             "git exited with code {} for file {}",
//     //             status.code().unwrap_or(-1),
//     //             file
//     //         ));
//     //     }
//     // }
//     for file in &args.files {
//         let full_path = {
//             let path = Path::new(file);
//             if path.is_absolute() {
//                 path.to_path_buf()
//             } else {
//                 mods_dir.join(path)
//             }
//         };

//         if !full_path.exists() {
//             println!("⛔️ Пропущен (не найден): {}", full_path.display());
//             continue;
//         }

//         println!("✅ skip-worktree: {}", full_path.display());

//         let mut cmd = tokio::process::Command::new("git");
//         cmd.current_dir(&args.base_dir)
//             .arg("update-index")
//             .arg("--skip-worktree")
//             .arg(&full_path);

//         let status = cmd
//             .status()
//             .await
//             .map_err(|e| format!("git spawn failed: {}", e))?;

//         if !status.success() {
//             return Err(format!(
//                 "git exited with code {} for file {}",
//                 status.code().unwrap_or(-1),
//                 full_path.display()
//             ));
//         }
//     }

//     Ok(())
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
            clone_repo,
            pull_repo,
            get_local_version_json,
            is_dir_empty,
            launch_minecraft,
            authenticate,
            reset_repo,
            get_total_memory_mb,
            toggle_mod_file,
            list_mod_jar_files,
            skip_worktree,
            check_git_update,
            download_mod_file,
            download_from_drive_api,
            unzip_with_progress,
            download_and_unzip_drive
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}
