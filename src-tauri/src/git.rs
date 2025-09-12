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
    let branch_name = {
       let output = tokio::process::Command::new(&args.git_path)
        .current_dir(&args.repo_path)
        .arg("rev-parse").arg("--abbrev-ref").arg("HEAD")
        .stdout(Stdio::piped()).stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .await
        .map_err(|e| format!("Failed to get branch name: {}", e))?;
        if !output.status.success() {
            return Err(format!("git rev-parse failed: {}", String::from_utf8_lossy(&output.stderr)));
        }
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    };

    let mut run_and_stream = |label: &'static str, git_args: Vec<&str>| {
        let window_clone = window.clone();
        let mut cmd = Command::new(&args.git_path);
        cmd.current_dir(&args.repo_path)
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("GCM_INTERACTIVE", "Never")
            .env("GIT_ASKPASS", "")
            .args(git_args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .creation_flags(CREATE_NO_WINDOW);
        async move {
            let mut child = cmd.spawn().map_err(|e| format!("Failed to start {}: {}", label, e))?;
            let stdout = child.stdout.take().unwrap();
            let stderr = child.stderr.take().unwrap();
            tauri::async_runtime::spawn(async move {
                use tokio::io::{AsyncBufReadExt, BufReader};
                let mut out_reader = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = out_reader.next_line().await {
                    let _ = window_clone.emit("git-progress", Some(format!("[{}] {}", label, line)));
                }
                let mut err_reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = err_reader.next_line().await {
                    let _ = window_clone.emit("git-progress", Some(format!("[{}] {}", label, line)));
                }
            });
            let status = child.wait().await.map_err(|e| format!("{} failed: {}", label, e))?;
            if !status.success() {
                return Err(format!("{} exited with code: {}", label, status.code().unwrap_or(-1)));
            }
            Ok::<(), String>(())
        }
    };

    // fetch + жесткое выравнивание по удаленной ветке
    run_and_stream("fetch", vec!["fetch", "--prune", "origin"]).await?;
    run_and_stream("reset", vec!["reset", "--hard", &format!("origin/{}", branch_name)]).await?;

    // показать, что будет удалено среди НЕотслеживаемых (игнорируемые НЕ трогаем)
    let _ = run_and_stream("clean-dry", vec!["clean", "-nd"]).await;
    // удалить только неотслеживаемые и неигнорируемые
    run_and_stream("clean", vec!["clean", "-fd"]).await?;

    Ok(())
}



#[derive(Deserialize)]
pub struct ResetRepoArgs {
    git_path: String,
    repo_path: String,
}

#[tauri::command]
pub async fn reset_repo(_window: tauri::Window, args: ResetRepoArgs) -> Result<(), String> {
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