use rayon::prelude::*;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use tokio::task;

#[derive(Serialize, Clone)]
pub struct ModFileEntry {
    pub path: String,   // relative POSIX path
    pub size: u64,
    pub mtime_ms: i64,  // ms since epoch
    pub sha256: String, // hex
}

fn sha256_file(abs_path: &Path) -> Result<String, String> {
    let file = File::open(abs_path).map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 1024 * 1024];
    loop {
        let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

#[tauri::command]
pub async fn hash_mods(dir: String) -> Result<Vec<ModFileEntry>, String> {
    task::spawn_blocking(move || {
        let base = PathBuf::from(dir);
        if !base.exists() {
            return Ok::<Vec<ModFileEntry>, String>(Vec::new());
        }
        let base_can = base.canonicalize().map_err(|e| e.to_string())?;

        // collect only *.jar / *.jar.disabled
        let mut files: Vec<PathBuf> = Vec::new();
        for entry in WalkDir::new(&base).follow_links(false) {
            let e = entry.map_err(|e| e.to_string())?;
            if !e.file_type().is_file() { continue; }
            let p = e.path();
            let name = p.file_name().and_then(|s| s.to_str()).unwrap_or_default().to_ascii_lowercase();
            if !(name.ends_with(".jar") || name.ends_with(".jar.disabled")) { continue; }
            files.push(p.to_path_buf());
        }

        // limit rayon threads to reduce contention with WebView
        let threads = std::cmp::max(1, num_cpus::get_physical().saturating_sub(1));
        let pool = rayon::ThreadPoolBuilder::new()
            .num_threads(threads)
            .build()
            .map_err(|e| e.to_string())?;

        let result = pool.install(|| {
            files.par_iter().map(|abs| {
                let abs_can = abs.canonicalize().map_err(|e| e.to_string())?;
                if !abs_can.starts_with(&base_can) {
                    return Err("Illegal path traversal detected".to_string());
                }
                let meta = fs::metadata(&abs_can).map_err(|e| e.to_string())?;
                let rel = abs_can
                    .strip_prefix(&base_can).map_err(|e| e.to_string())?
                    .to_slash().ok_or("Path conversion failed")?;

                let sha = sha256_file(&abs_can)?;
                let modified = meta.modified().map_err(|e| e.to_string())?;
                let mtime_ms = modified.duration_since(std::time::UNIX_EPOCH)
                    .map_err(|e| e.to_string())?
                    .as_millis() as i64;

                Ok(ModFileEntry {
                    path: rel,
                    size: meta.len(),
                    mtime_ms,
                    sha256: sha,
                })
            }).collect::<Result<Vec<ModFileEntry>, String>>()
        });

        result
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_extra_files(base_dir: String, relative_paths: Vec<String>) -> Result<usize, String> {
    task::spawn_blocking(move || {
        let base = PathBuf::from(base_dir);
        if !base.exists() { return Ok::<usize, String>(0); }
        let base_can = base.canonicalize().map_err(|e| e.to_string())?;

        let mut deleted = 0usize;
        for rel in relative_paths {
            let sanitized = rel.replace('\\', "/").trim_start_matches('/').to_string();
            if sanitized.contains("..") { return Err("Rejected path with '..'".to_string()); }
            let abs = base_can.join(&sanitized);
            if !abs.starts_with(&base_can) { return Err("Rejected path outside base".to_string()); }
            if abs.exists() && abs.is_file() {
                fs::remove_file(&abs).map_err(|e| e.to_string())?;
                deleted += 1;
            }
        }
        Ok(deleted)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn download_mod_file(
    url: String,
    path: String,
    mod_name: Option<String>,
    modName: Option<String>,
    username: Option<String>,
    password: Option<String>,
) -> Result<(), String> {
    use reqwest::Client;
    use tokio::io::AsyncWriteExt;

    let rel = mod_name.or(modName).ok_or("modName is required")?;
    let user = username.unwrap_or_default();
    let pass = password.unwrap_or_default();

    let sanitized = rel.replace('\\', "/").trim_start_matches('/').to_string();
    if sanitized.contains("..") { return Err("Rejected path with '..'".to_string()); }

    let base = PathBuf::from(&path);
    let abs = base.join(&sanitized);
    if let Some(parent) = abs.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }
    let tmp = abs.with_extension("part");

    let body = serde_json::json!({ "modName": sanitized, "username": user, "password": pass });

    let client = Client::new();
    let mut resp = client.post(url).json(&body).send().await
        .map_err(|e| format!("request failed: {e}"))?
        .error_for_status().map_err(|e| format!("server error: {e}"))?;

    let mut file = tokio::fs::File::create(&tmp).await.map_err(|e| e.to_string())?;
    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }
    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);

    if tokio::fs::metadata(&abs).await.is_ok() {
        tokio::fs::remove_file(&abs).await.map_err(|e| e.to_string())?;
    }
    tokio::fs::rename(&tmp, &abs).await.map_err(|e| e.to_string())?;
    Ok(())
}

// POSIX helper
trait ToSlash { fn to_slash(&self) -> Option<String>; }
impl ToSlash for &Path {
    fn to_slash(&self) -> Option<String> { Some(self.to_string_lossy().replace('\\', "/")) }
}
