use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use base64::Engine;

// ── File I/O commands ────────────────────────────────────────────────────────

#[tauri::command]
fn read_project(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Lecture impossible: {}", e))
}

#[tauri::command]
fn write_project(path: String, data: String) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Création dossier impossible: {}", e))?;
    }
    fs::write(&path, data).map_err(|e| format!("Écriture impossible: {}", e))
}

#[tauri::command]
fn write_file_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = PathBuf::from(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Création dossier impossible: {}", e))?;
    }
    fs::write(&path, bytes).map_err(|e| format!("Écriture impossible: {}", e))
}

// ── Daily backup (one per day, stored in Backup/ sibling folder) ─────────────

fn unix_to_date_str(secs: u64) -> String {
    let mut days = secs / 86400;
    let mut year = 1970u32;
    loop {
        let days_in_year = if is_leap_year(year) { 366 } else { 365 };
        if days < days_in_year { break; }
        days -= days_in_year;
        year += 1;
    }
    let months = if is_leap_year(year) {
        [31u64,29,31,30,31,30,31,31,30,31,30,31]
    } else {
        [31u64,28,31,30,31,30,31,31,30,31,30,31]
    };
    let mut month = 1u32;
    for &m in &months {
        if days < m { break; }
        days -= m;
        month += 1;
    }
    let day = days as u32 + 1;
    format!("{}{:02}{:02}", year, month, day)
}

fn is_leap_year(year: u32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

#[tauri::command]
fn write_daily_backup(path: String) -> Result<(), String> {
    let src = PathBuf::from(&path);
    if !src.exists() { return Ok(()); }

    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("backup")
        .to_string();

    let backup_dir = src
        .parent()
        .unwrap_or_else(|| std::path::Path::new("."))
        .join("Backup");

    fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Création dossier Backup impossible: {}", e))?;

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let date_str = unix_to_date_str(ts);

    let backup_path = backup_dir.join(format!("{}_{}.wmsplan", stem, date_str));
    fs::copy(&src, &backup_path)
        .map_err(|e| format!("Backup journalier impossible: {}", e))?;

    // Keep last 30 daily backups
    let mut entries: Vec<_> = fs::read_dir(&backup_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|x| x == "wmsplan").unwrap_or(false))
        .collect();
    entries.sort_by_key(|e| e.file_name());
    if entries.len() > 30 {
        for old in &entries[..entries.len() - 30] {
            fs::remove_file(old.path()).ok();
        }
    }

    Ok(())
}

// ── Versioned backup (keeps last 10, stored in app data dir) ─────────────────

#[tauri::command]
fn write_project_backup(app: AppHandle, path: String) -> Result<(), String> {
    let src = PathBuf::from(&path);
    if !src.exists() {
        return Ok(());
    }
    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("backup")
        .to_string();

    let backups_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("backups")
        .join(&stem);

    fs::create_dir_all(&backups_dir)
        .map_err(|e| format!("Création dossier backups impossible: {}", e))?;

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let backup_path = backups_dir.join(format!("{}_{}.wmsplan", stem, ts));
    fs::copy(&src, &backup_path)
        .map_err(|e| format!("Backup impossible: {}", e))?;

    // Keep only last 10 backups
    let mut entries: Vec<_> = fs::read_dir(&backups_dir)
        .map_err(|e| format!("Lecture backups impossible: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|x| x == "wmsplan").unwrap_or(false))
        .collect();

    entries.sort_by_key(|e| e.file_name());
    if entries.len() > 10 {
        for old in &entries[..entries.len() - 10] {
            fs::remove_file(old.path()).ok();
        }
    }

    Ok(())
}

// ── App projects directory ────────────────────────────────────────────────────

#[tauri::command]
fn get_new_project_path(app: AppHandle, name: String, folder: Option<String>) -> Result<String, String> {
    let dir = match folder.as_deref().filter(|f| !f.is_empty()) {
        Some(f) => {
            let p = PathBuf::from(f);
            fs::create_dir_all(&p)
                .map_err(|e| format!("Création dossier impossible: {}", e))?;
            p
        }
        None => {
            let p = app
                .path()
                .app_data_dir()
                .map_err(|e| e.to_string())?
                .join("projects");
            fs::create_dir_all(&p)
                .map_err(|e| format!("Création dossier projets impossible: {}", e))?;
            p
        }
    };

    let safe: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let safe = if safe.is_empty() { "projet".to_string() } else { safe };

    let base = dir.join(format!("{}.wmsplan", safe));
    if !base.exists() {
        return Ok(base.to_string_lossy().to_string());
    }
    for i in 2..=99 {
        let candidate = dir.join(format!("{}_{}.wmsplan", safe, i));
        if !candidate.exists() {
            return Ok(candidate.to_string_lossy().to_string());
        }
    }
    Err("Impossible de trouver un nom de fichier disponible".to_string())
}

// ── App settings ─────────────────────────────────────────────────────────────

fn settings_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("settings.json")
}

#[tauri::command]
fn read_settings(app: AppHandle) -> String {
    let path = settings_path(&app);
    fs::read_to_string(path).unwrap_or_else(|_| "{}".to_string())
}

#[tauri::command]
fn write_settings(app: AppHandle, data: String) -> Result<(), String> {
    let path = settings_path(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Création dossier impossible: {}", e))?;
    }
    fs::write(path, data).map_err(|e| format!("Écriture settings.json impossible: {}", e))
}

// ── Recent projects list (stored in app data directory) ──────────────────────

fn recent_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("recent.json")
}

#[tauri::command]
fn read_recent(app: AppHandle) -> String {
    let path = recent_path(&app);
    fs::read_to_string(path).unwrap_or_else(|_| "[]".to_string())
}

#[tauri::command]
fn write_recent(app: AppHandle, data: String) -> Result<(), String> {
    let path = recent_path(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Création dossier impossible: {}", e))?;
    }
    fs::write(path, data).map_err(|e| format!("Écriture recent.json impossible: {}", e))
}

// ── File dialogs ─────────────────────────────────────────────────────────────

fn file_path_to_string(fp: tauri_plugin_dialog::FilePath) -> Option<String> {
    fp.into_path().ok().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
async fn open_dialog(app: AppHandle) -> Option<String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_focus();
    }
    app.dialog()
        .file()
        .add_filter("WMS Plan", &["wmsplan", "json"])
        .blocking_pick_file()
        .and_then(file_path_to_string)
}

#[tauri::command]
async fn save_dialog(app: AppHandle, name: String) -> Option<String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_focus();
    }
    app.dialog()
        .file()
        .set_file_name(format!("{}.wmsplan", name))
        .add_filter("WMS Plan", &["wmsplan"])
        .blocking_save_file()
        .and_then(file_path_to_string)
}

#[tauri::command]
async fn export_html_dialog(app: AppHandle, name: String) -> Option<String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_focus();
    }
    app.dialog()
        .file()
        .set_file_name(format!("{}_export.html", name))
        .add_filter("HTML", &["html"])
        .blocking_save_file()
        .and_then(file_path_to_string)
}

#[tauri::command]
fn export_html_write(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Export HTML impossible: {}", e))
}

#[tauri::command]
async fn save_md_dialog(app: AppHandle, name: String) -> Option<String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_focus();
    }
    app.dialog()
        .file()
        .set_file_name(format!("{}.md", name))
        .add_filter("Markdown", &["md"])
        .blocking_save_file()
        .and_then(file_path_to_string)
}

#[tauri::command]
async fn pick_folder(app: AppHandle) -> Option<String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_focus();
    }
    app.dialog()
        .file()
        .blocking_pick_folder()
        .and_then(file_path_to_string)
}

#[tauri::command]
async fn save_pdf_dialog(app: AppHandle, name: String) -> Option<String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_focus();
    }
    app.dialog()
        .file()
        .set_file_name(name)
        .add_filter("PDF", &["pdf"])
        .blocking_save_file()
        .and_then(file_path_to_string)
}

#[tauri::command]
fn delete_project(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.exists() {
        fs::remove_file(&p).map_err(|e| format!("Suppression impossible: {}", e))?;
    }
    // Also remove .bak if present
    let bak = PathBuf::from(format!("{}.bak", &path));
    if bak.exists() { fs::remove_file(bak).ok(); }
    Ok(())
}

// ── Reveal file in Explorer ───────────────────────────────────────────────────

#[tauri::command]
fn reveal_file(path: String) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(format!("/select,{}", path))
        .spawn()
        .map_err(|e| format!("Impossible d'ouvrir l'explorateur: {}", e))?;
    Ok(())
}

// ── Window title ─────────────────────────────────────────────────────────────

#[tauri::command]
fn set_window_title(app: AppHandle, title: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_title(&title).map_err(|e| e.to_string())
    } else {
        Err("Fenêtre introuvable".to_string())
    }
}

// ── App version ──────────────────────────────────────────────────────────────

#[tauri::command]
fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// ── JIRA proxy (avoids CORS — called from renderer) ──────────────────────────

#[tauri::command]
async fn jira_fetch(url: String, email: String, token: String, body: Option<String>) -> Result<String, String> {
    let creds = base64::engine::general_purpose::STANDARD.encode(format!("{}:{}", email, token));
    let client = reqwest::Client::new();
    let resp = match body {
        Some(json_body) => client
            .post(&url)
            .header("Authorization", format!("Basic {}", creds))
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .body(json_body)
            .send()
            .await,
        None => client
            .get(&url)
            .header("Authorization", format!("Basic {}", creds))
            .header("Accept", "application/json")
            .send()
            .await,
    }
    .map_err(|e| format!("Réseau: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!("JIRA {}", status.as_u16()));
    }

    resp.text().await.map_err(|e| format!("Lecture réponse: {}", e))
}

// ── App entry point ──────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_project,
            write_project,
            write_file_bytes,
            write_project_backup,
            write_daily_backup,
            get_new_project_path,
            read_recent,
            write_recent,
            read_settings,
            write_settings,
            open_dialog,
            save_dialog,
            export_html_dialog,
            export_html_write,
            save_pdf_dialog,
            set_window_title,
            reveal_file,
            delete_project,
            save_md_dialog,
            pick_folder,
            get_version,
            jira_fetch,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur au démarrage de l'application");
}
