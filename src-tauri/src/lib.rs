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
fn write_project_backup(path: String) -> Result<(), String> {
    let bak = format!("{}.bak", &path);
    if PathBuf::from(&path).exists() {
        fs::copy(&path, &bak).map_err(|e| format!("Backup impossible: {}", e))?;
    }
    Ok(())
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
    app.dialog()
        .file()
        .add_filter("WMS Plan", &["wmsplan"])
        .blocking_pick_file()
        .map(|p| p.to_string())
}

#[tauri::command]
async fn save_dialog(app: AppHandle, name: String) -> Option<String> {
    app.dialog()
        .file()
        .set_file_name(format!("{}.wmsplan", name))
        .add_filter("WMS Plan", &["wmsplan"])
        .blocking_save_file()
        .map(|p| p.to_string())
}

#[tauri::command]
async fn export_html_dialog(app: AppHandle, name: String) -> Option<String> {
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
            write_project_backup,
            read_recent,
            write_recent,
            open_dialog,
            save_dialog,
            export_html_dialog,
            export_html_write,
            set_window_title,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur au démarrage de l'application");
}
