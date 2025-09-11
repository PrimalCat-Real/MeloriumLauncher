#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::process::Stdio;

use serde::Deserialize;
use tauri::{Window, Emitter};
use tauri::async_runtime::spawn;

use tokio::process::Command;

#[cfg(windows)]

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Deserialize, Clone)]
pub struct GitPullArgs {
    git_path: String,
    repo_path: String,
}

#[tauri::command]
pub async fn pull_repo(window: Window, args: GitPullArgs) -> Result<(), String> {
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