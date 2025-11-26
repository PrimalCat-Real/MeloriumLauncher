// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use globset::{GlobBuilder, GlobSetBuilder};
use serde::Deserialize;
use std::process::Stdio;
use tokio::process::Command;
mod download;

use download::{download_and_unzip_drive, download_from_drive_api, unzip_with_progress, hash_files_batch, get_files_meta_batch};
mod utils;
use utils::{
    get_local_version_json, get_total_memory_mb, is_dir_empty, list_mod_jar_files, toggle_mod_file, write_file_bytes,delete_file,scan_directory_recursive, download_file_direct, download_file_with_fallbacks, download_file_heavy
};

mod rungame;
use rungame::launch_minecraft;

mod git;
use git::{pull_repo, reset_repo, clean_repository, reset_repository_hard, pull_repo_with_fallback };

mod mods;
use mods::{delete_extra_files, download_mod_file, hash_mods};

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
    builder
        .build()
        .map_err(|e| format!("Failed to build globset: {}", e))
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

    let _guard = sentry::init(("https://53be3cae6821c7f9d5be85b59bae678c@o4510413819871232.ingest.de.sentry.io/4510413823737936", sentry::ClientOptions {
        release: sentry::release_name!(),
        sample_rate: 1.0,
        attach_stacktrace: true,
        ..Default::default()
    }));

    std::panic::set_hook(Box::new(|info| {
        let hub = sentry::Hub::current();
        let event_id = hub.capture_message(&format!("Panic: {:?}", info), sentry::Level::Fatal);
        println!("Sentry event sent: {}", event_id);
        hub.client().map(|c| c.close(Some(std::time::Duration::from_secs(2))));
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
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
            delete_extra_files,
            reset_repo,
            clean_repository,
            reset_repository_hard,
            pull_repo_with_fallback,
            delete_file,
            write_file_bytes,
            get_files_meta_batch,
            hash_files_batch,
            scan_directory_recursive,
            download_file_direct,
            download_file_with_fallbacks,
            download_file_heavy
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}
