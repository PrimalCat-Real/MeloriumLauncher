use serde::Deserialize;
use std::path::Path;
use std::{fs, path::PathBuf, process::Stdio};
use tauri::Emitter;
use tokio::process::Command;

#[derive(Deserialize)]
pub struct MinecraftLaunchArgs {
    java_path: String,
    args_content: String,
    args_file_path: String,
    game_dir: String,
}

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[tauri::command]
pub async fn launch_minecraft(
    window: tauri::Window,
    args: MinecraftLaunchArgs,
) -> Result<(), String> {
    let path = Path::new(&args.args_file_path);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::write(path, &args.args_content).map_err(|e| format!("Failed to write args.txt: {}", e))?;

    let mut command = Command::new(&args.java_path);
    command
        .arg(format!("@{}", &args.args_file_path))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW);

    if let Some(working_dir) = Path::new(&args.game_dir).parent() {
        command.current_dir(working_dir);
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to start java: {}", e))?;
     if let Some(stdout) = child.stdout.take() {
        let window_clone = window.clone();
        tauri::async_runtime::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let mut out_reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = out_reader.next_line().await {
                let _ = window_clone.emit("minecraft-launch-progress", Some(line));
            }
        });
    }

    if let Some(stderr) = child.stderr.take() {
        let window_clone = window.clone();
        tauri::async_runtime::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let mut err_reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = err_reader.next_line().await {
                let _ = window_clone.emit("minecraft-launch-progress", Some(line));
            }
        });
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Java failed: {}", e))?;
    if !status.success() {
        return Err(format!(
            "Java exited with code: {}",
            status.code().unwrap_or(-1)
        ));
    }
    Ok(())
}
