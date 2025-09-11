// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Deserialize;
use std::{process::Stdio};
use tokio::process::Command;
use globset::{GlobBuilder, GlobSetBuilder};
mod download;

use download::{download_from_drive_api, unzip_with_progress, download_and_unzip_drive};
mod utils;
use utils::{
    get_local_version_json, get_total_memory_mb, is_dir_empty, list_mod_jar_files, toggle_mod_file
};

mod rungame;
use rungame::launch_minecraft;

mod git;
use git::{pull_repo};

mod mods;
use mods::{hash_mods, delete_extra_files, download_mod_file};


const CREATE_NO_WINDOW: u32 = 0x0800_0000;


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
            get_local_version_json,
            is_dir_empty,
            launch_minecraft,
            get_total_memory_mb,
            toggle_mod_file,
            list_mod_jar_files,
            check_git_update,
            download_mod_file,
            download_from_drive_api,
            unzip_with_progress,
            download_and_unzip_drive,
            pull_repo,
            hash_mods,
            delete_extra_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}
