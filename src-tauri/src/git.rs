#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::process::Stdio;

use serde::Deserialize;
use tauri::async_runtime::spawn;
use tauri::{Emitter, Window};

use tokio::process::Command;

#[cfg(windows)]

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(serde::Deserialize)]
pub struct GitPullArgs {
  pub git_path: String,
  pub repo_path: String,
}

#[tauri::command]
pub async fn pull_repo(window: Window, args: GitPullArgs) -> Result<(), String> {
  let _ = window.emit("git-start", Some("pull"));

  let mut cmd = Command::new(&args.git_path);
  cmd.current_dir(&args.repo_path)
    .env("GIT_TERMINAL_PROMPT", "0")
    .env("GCM_INTERACTIVE", "Never")
    .env("GIT_ASKPASS", "")
    .args(["pull", "--progress", "--ff-only", "--no-rebase"])
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

  #[cfg(windows)]
  {
    use tokio::process::Command as _;
    cmd.creation_flags(CREATE_NO_WINDOW);
  }

  let mut child = cmd.spawn().map_err(|e| format!("failed to start git pull: {e}"))?;
  let stdout = child.stdout.take().ok_or("no stdout")?;
  let stderr = child.stderr.take().ok_or("no stderr")?;

  tauri::async_runtime::spawn({
    let window = window.clone();
    async move {
      use tokio::io::{AsyncBufReadExt, BufReader};
      let mut reader = BufReader::new(stdout).lines();
      while let Ok(Some(line)) = reader.next_line().await {
        let _ = window.emit("git-progress", Some(line));
      }
    }
  });

  tauri::async_runtime::spawn({
    let window = window.clone();
    async move {
      use tokio::io::{AsyncBufReadExt, BufReader};
      let mut reader = BufReader::new(stderr).lines();
      while let Ok(Some(line)) = reader.next_line().await {
        let _ = window.emit("git-progress", Some(line));
      }
    }
  });

  let status = child.wait().await.map_err(|e| format!("git pull wait failed: {e}"))?;
  if !status.success() {
    let code = status.code().unwrap_or(-1);
    let msg = format!("git pull exited with code {code}");
    let _ = window.emit("git-error", Some(msg.clone()));
    return Err(msg);
  }

  let _ = window.emit("git-complete", Some("pull"));
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
    init.current_dir(&args.repo_path)
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


#[derive(serde::Deserialize)]
pub struct ResetRepositoryArgs {
    pub git_path: String,
    pub repository_path: String,
    /// Defaults to "HEAD" if None
    pub hard_target: Option<String>,
}

#[tauri::command]
pub async fn reset_repository_hard(
    _window: tauri::Window,
    args: ResetRepositoryArgs,
) -> Result<(), String> {
    let hard_target = args.hard_target.as_deref().unwrap_or("HEAD");

    let mut git_reset = Command::new(&args.git_path);
    git_reset
        .current_dir(&args.repository_path)
        .args(["reset", "--hard", hard_target])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW);

    let mut child = git_reset.spawn().map_err(|e| format!("spawn reset: {e}"))?;
    let output = child
        .wait_with_output()
        .await
        .map_err(|e| format!("reset failed: {e}"))?;

    if !output.status.success() {
        let stderr_text = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "git reset exited with code {}: {}",
            output.status.code().unwrap_or(-1),
            stderr_text.trim()
        ));
    }

    Ok(())
}


#[derive(serde::Deserialize)]
pub struct CleanRepositoryArgs {
    pub git_path: String,
    pub repository_path: String,
    /// If true -> `git clean -fdx` (also removes ignored). If false -> `git clean -fd`.
    pub include_ignored: bool,
    /// Optional pathspecs to clean only specific paths. If empty -> clean whole worktree.
    pub pathspecs: Option<Vec<String>>,
}

#[tauri::command]
pub async fn clean_repository(
    _window: tauri::Window,
    args: CleanRepositoryArgs,
) -> Result<(), String> {
    let mut git_clean = Command::new(&args.git_path);
    git_clean
        .current_dir(&args.repository_path)
        .arg("clean")
        .arg("-fd"); // remove untracked files and directories

    if args.include_ignored {
        git_clean.arg("-x"); // also remove ignored files
    }

    if let Some(pathspecs) = args.pathspecs.as_ref() {
        for pathspec in pathspecs {
            git_clean.arg(pathspec);
        }
    }

    git_clean
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW);

    let mut child = git_clean.spawn().map_err(|e| format!("spawn clean: {e}"))?;
    let output = child
        .wait_with_output()
        .await
        .map_err(|e| format!("clean failed: {e}"))?;

    if !output.status.success() {
        let stderr_text = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "git clean exited with code {}: {}",
            output.status.code().unwrap_or(-1),
            stderr_text.trim()
        ));
    }

    Ok(())
}