use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

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
fn get_new_project_path(app: AppHandle, name: String) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("projects");

    fs::create_dir_all(&dir)
        .map_err(|e| format!("Création dossier projets impossible: {}", e))?;

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

#[tauri::command]
async fn open_dialog(app: AppHandle) -> Option<String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_focus();
    }
    app.dialog()
        .file()
        .add_filter("WMS Plan", &["wmsplan", "json"])
        .blocking_pick_file()
        .map(|p| p.to_string())
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
        .map(|p| p.to_string())
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
        .map(|p| p.to_string())
}

#[tauri::command]
fn export_html_write(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Export HTML impossible: {}", e))
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
        .map(|p| p.to_string())
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
            get_new_project_path,
            read_recent,
            write_recent,
            open_dialog,
            save_dialog,
            export_html_dialog,
            export_html_write,
            save_pdf_dialog,
            set_window_title,
            reveal_file,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur au démarrage de l'application");
}
