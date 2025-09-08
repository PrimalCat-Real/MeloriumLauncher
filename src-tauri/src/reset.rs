use serde::Serialize;
use std::{ffi::OsStr, fs, io::Write, path::{Path, PathBuf}, process::Command};
use tauri::Emitter;
use ignore::gitignore::GitignoreBuilder;

#[derive(Serialize, Clone)]
struct StagePayload { label: String, taskId: String }
#[derive(Serialize, Clone)]
struct ResetProgressPayload { done: usize, total: usize, phase: String, taskId: String }
#[derive(Serialize, Clone)]
struct TaskErrorPayload { message: String, taskId: String }

fn emit_stage(window: &tauri::Window, task_id: &str, label: &str) {
  let _ = window.emit("stage", StagePayload { label: label.to_string(), taskId: task_id.to_string() });
}
fn emit_progress(window: &tauri::Window, task_id: &str, done: usize, total: usize, phase: &str) {
  let _ = window.emit("reset:progress", ResetProgressPayload { done, total, phase: phase.to_string(), taskId: task_id.to_string() });
}
fn emit_error(window: &tauri::Window, task_id: &str, msg: String) {
  let _ = window.emit("task:error", TaskErrorPayload { message: msg, taskId: task_id.to_string() });
}

#[derive(Debug)]
enum Change {
  Add(String),
  Modify(String),
  Delete(String),
  Rename { from: String, to: String },
}

fn run_git<S: AsRef<OsStr>>(git: &str, repo: &Path, args: &[S]) -> Result<Vec<u8>, String> {
  let out = Command::new(git)
    .arg("-C").arg(repo)
    .args(args)
    .output()
    .map_err(|e| format!("Failed to run git: {}", e))?;
  if out.status.success() { Ok(out.stdout) } else {
    Err(String::from_utf8_lossy(&out.stderr).to_string())
  }
}

fn ensure_within(base: &Path, target: &Path) -> Result<(), String> {
  let base = base
    .canonicalize()
    .map_err(|e| format!("canonicalize base: {}", e))?;

  let target = target
    .canonicalize()
    .or_else(|_| Ok::<PathBuf, std::io::Error>(target.to_path_buf()))
    .map_err(|e| format!("canonicalize target: {}", e))?;

  if target.starts_with(&base) {
    Ok(())
  } else {
    Err("Path escapes repo root".into())
  }
}

fn join_repo(repo: &Path, rel: &str) -> PathBuf {
  let mut p = PathBuf::from(repo);
  for seg in Path::new(rel).components() { p.push(seg.as_os_str()); }
  p
}

fn parse_name_status_z(data: &[u8]) -> Result<Vec<Change>, String> {
  let mut res = Vec::new();
  let parts: Vec<&[u8]> = data.split(|b| *b == 0u8).filter(|s| !s.is_empty()).collect();
  let mut i = 0usize;
  while i < parts.len() {
    let line = parts[i];
    let mut it = line.splitn(2, |b| *b == b'\t');
    let status = String::from_utf8(it.next().unwrap_or_default().to_vec()).map_err(|_| "utf8 status".to_string())?;
    let code = status.chars().next().unwrap_or(' ');
    match code {
      'A' | 'M' | 'D' => {
        let path = String::from_utf8(it.next().unwrap_or_default().to_vec()).map_err(|_| "utf8 path".to_string())?;
        match code {
          'A' => res.push(Change::Add(path)),
          'M' => res.push(Change::Modify(path)),
          'D' => res.push(Change::Delete(path)),
          _ => {}
        }
        i += 1;
      }
      'R' => {
        // next entry is "to" path
        let from = String::from_utf8(it.next().unwrap_or_default().to_vec()).map_err(|_| "utf8 from".to_string())?;
        let to = String::from_utf8(parts.get(i + 1).ok_or("rename missing 'to'")?.to_vec()).map_err(|_| "utf8 to".to_string())?;
        res.push(Change::Rename { from, to });
        i += 2;
      }
      _ => { return Err(format!("Unsupported status: {}", status)); }
    }
  }
  Ok(res)
}

fn build_gitignore(repo: &Path) -> Result<ignore::gitignore::Gitignore, String> {
  let gi_path = repo.join(".gitignore");
  let mut builder = GitignoreBuilder::new(repo);
  if gi_path.exists() {
    let content = fs::read_to_string(&gi_path).map_err(|e| format!("read .gitignore: {}", e))?;
    for line in content.lines() {
      // ignore errors from invalid lines
      let _ = builder.add_line(None, line);
    }
  }
  builder.build().map_err(|e| format!("build gitignore: {}", e))
}

fn is_ignored(gi: &ignore::gitignore::Gitignore, repo: &Path, rel: &str) -> bool {
  gi.matched_path_or_any_parents(repo.join(rel), false).is_ignore()
}

fn write_from_ref(git: &str, repo: &Path, target_ref: &str, rel: &str) -> Result<(), String> {
  let spec = format!("{}:{}", target_ref, rel);
  let bytes = run_git(git, repo, &[OsStr::new("show"), OsStr::new(&spec)])?;
  let full = join_repo(repo, rel);
  if let Some(parent) = full.parent() { fs::create_dir_all(parent).map_err(|e| format!("mk parent: {}", e))?; }
  let mut f = fs::OpenOptions::new().create(true).write(true).truncate(true).open(&full).map_err(|e| format!("open {}: {}", full.display(), e))?;
  f.write_all(&bytes).map_err(|e| format!("write {}: {}", full.display(), e))?;
  Ok(())
}

fn delete_path(repo: &Path, rel: &str) -> Result<(), String> {
  let full = join_repo(repo, rel);
  if !full.exists() { return Ok(()); }
  ensure_within(repo, &full)?;
  match fs::metadata(&full) {
    Ok(meta) if meta.is_dir() => fs::remove_dir_all(&full).map_err(|e| format!("remove_dir {}: {}", full.display(), e))?,
    _ => fs::remove_file(&full).map_err(|e| format!("remove_file {}: {}", full.display(), e))?,
  }
  Ok(())
}

#[tauri::command]
pub async fn reset_repo_selective(
  window: tauri::Window,
  git_path: String,
  repo_path: String,
  task_id: String,
) -> Result<(), String> {
  let repo = PathBuf::from(&repo_path);
  let target_ref = "origin/main";

  emit_stage(&window, &task_id, "Анализ");
  // fetch and verify target
  let _ = run_git(&git_path, &repo, &[OsStr::new("fetch"), OsStr::new("-p")])
    .map_err(|e| { emit_error(&window, &task_id, e.clone()); e })?;
  let _ = run_git(&git_path, &repo, &[OsStr::new("rev-parse"), OsStr::new("--verify"), OsStr::new(target_ref)])
    .map_err(|e| { emit_error(&window, &task_id, e.clone()); e })?;

  // diff list
  let diff = run_git(&git_path, &repo, &[OsStr::new("diff"), OsStr::new("--name-status"), OsStr::new("-z"), OsStr::new("HEAD"), OsStr::new(target_ref)])
    .map_err(|e| { emit_error(&window, &task_id, e.clone()); e })?;
  let mut changes = parse_name_status_z(&diff)
    .map_err(|e| { emit_error(&window, &task_id, e.clone()); e })?;

  // ensure .gitignore restored if changed
  let gitignore_changed = changes.iter().any(|c| match c {
    Change::Add(p) | Change::Modify(p) | Change::Delete(p) => p == ".gitignore",
    Change::Rename { from, to } => from == ".gitignore" || to == ".gitignore",
  });
  if gitignore_changed {
    emit_stage(&window, &task_id, "Восстановление .gitignore");
    write_from_ref(&git_path, &repo, target_ref, ".gitignore")
      .map_err(|e| { emit_error(&window, &task_id, e.clone()); e })?;
    // удалим все записи про .gitignore из списка, мы его уже восстановили
    changes.retain(|c| match c {
      Change::Add(p) | Change::Modify(p) | Change::Delete(p) => p != ".gitignore",
      Change::Rename { from, to } => !(from == ".gitignore" || to == ".gitignore"),
    });
  }

  // build ignore matcher from restored .gitignore
  emit_stage(&window, &task_id, "Фильтрация");
  let gi = build_gitignore(&repo)
    .map_err(|e| { emit_error(&window, &task_id, e.clone()); e })?;

  // filter out blacklisted paths
  let mut effective: Vec<Change> = Vec::new();
  for ch in changes.into_iter() {
    let keep = match &ch {
      Change::Add(p) | Change::Modify(p) | Change::Delete(p) => !is_ignored(&gi, &repo, p),
      Change::Rename { from, to } => !is_ignored(&gi, &repo, from) && !is_ignored(&gi, &repo, to),
    };
    if keep { effective.push(ch); }
  }

  // split actions
  let mut to_delete: Vec<String> = Vec::new();
  let mut to_write: Vec<String> = Vec::new();
  for ch in effective.into_iter() {
    match ch {
      Change::Delete(p) => to_delete.push(p),
      Change::Add(p) | Change::Modify(p) => to_write.push(p),
      Change::Rename { from, to } => {
        to_delete.push(from);
        to_write.push(to);
      }
    }
  }

  // apply deletes
  emit_stage(&window, &task_id, "Удаление");
  let total_del = to_delete.len();
  for (i, rel) in to_delete.iter().enumerate() {
    if let Err(e) = delete_path(&repo, rel) {
      emit_error(&window, &task_id, format!("delete {}: {}", rel, e));
      return Err(e);
    }
    emit_progress(&window, &task_id, i + 1, total_del, "delete");
  }

  // apply writes
  emit_stage(&window, &task_id, "Запись");
  let total_wr = to_write.len();
  for (i, rel) in to_write.iter().enumerate() {
    if let Err(e) = write_from_ref(&git_path, &repo, target_ref, rel) {
      emit_error(&window, &task_id, format!("write {}: {}", rel, e));
      return Err(e);
    }
    emit_progress(&window, &task_id, i + 1, total_wr, "write");
  }

  emit_stage(&window, &task_id, "Готово");
  Ok(())
}
