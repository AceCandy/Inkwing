use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;
use tauri::TitleBarStyle;

pub mod typora_themes;
use crate::typora_themes::{import_typora_theme, list_typora_themes, read_typora_theme_css};

#[derive(Debug, Serialize, Deserialize)]
pub struct ThemeInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub path: String,
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn save_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Failed to save file: {}", e))
}

#[tauri::command]
fn get_file_name(path: String) -> String {
    Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled")
        .to_string()
}

#[tauri::command]
fn list_themes(themes_dir: String) -> Result<Vec<ThemeInfo>, String> {
    let dir = Path::new(&themes_dir);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut themes = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read themes dir: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            let theme_json = path.join("theme.json");
            if theme_json.exists() {
                let content = fs::read_to_string(&theme_json)
                    .map_err(|e| format!("Failed to read theme.json: {}", e))?;
                if let Ok(info) = serde_json::from_str::<ThemeInfo>(&content) {
                    themes.push(info);
                }
            }
        }
    }

    Ok(themes)
}

#[tauri::command]
fn rename_file(old_path: String, new_name: String) -> Result<String, String> {
    let old_path_obj = Path::new(&old_path);
    if !old_path_obj.exists() {
        return Err("File does not exist".to_string());
    }
    let parent = old_path_obj
        .parent()
        .ok_or("Failed to get parent directory")?;
    let new_path_obj = parent.join(new_name);

    fs::rename(&old_path_obj, &new_path_obj)
        .map_err(|e| format!("Failed to rename file: {}", e))?;

    new_path_obj
        .to_str()
        .map(|s| s.to_string())
        .ok_or("Failed to convert path to string".to_string())
}

#[tauri::command]
fn export_html(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Failed to export HTML: {}", e))
}

#[tauri::command]
fn read_theme_css(theme_path: String) -> Result<String, String> {
    let css_path = Path::new(&theme_path).join("theme.css");
    fs::read_to_string(&css_path).map_err(|e| format!("Failed to read theme CSS: {}", e))
}

/// 构建原生菜单
fn build_menu(app: &tauri::AppHandle) -> Result<Menu<tauri::Wry>, String> {
    // 文件菜单项
    let new_file = MenuItem::with_id(app, "new_file", "New File", true, Some("CmdOrCtrl+N"))
        .map_err(|e| format!("Failed to create menu item: {}", e))?;
    let open_file = MenuItem::with_id(app, "open_file", "Open File", true, Some("CmdOrCtrl+O"))
        .map_err(|e| format!("Failed to create menu item: {}", e))?;
    let save = MenuItem::with_id(app, "save", "Save", true, Some("CmdOrCtrl+S"))
        .map_err(|e| format!("Failed to create menu item: {}", e))?;
    let save_as = MenuItem::with_id(app, "save_as", "Save As", true, Some("CmdOrCtrl+Shift+S"))
        .map_err(|e| format!("Failed to create menu item: {}", e))?;

    let file_submenu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &new_file,
            &open_file,
            &PredefinedMenuItem::separator(app)
                .map_err(|e| format!("Failed to create separator: {}", e))?,
            &save,
            &save_as,
            &PredefinedMenuItem::separator(app)
                .map_err(|e| format!("Failed to create separator: {}", e))?,
            &PredefinedMenuItem::quit(app, Some("Quit"))
                .map_err(|e| format!("Failed to create quit item: {}", e))?,
        ],
    )
    .map_err(|e| format!("Failed to create file submenu: {}", e))?;

    // 设置菜单项
    let settings = MenuItem::with_id(app, "settings", "Settings...", true, Some("CmdOrCtrl+,"))
        .map_err(|e| format!("Failed to create menu item: {}", e))?;

    let settings_submenu = Submenu::with_items(app, "Settings", true, &[&settings])
        .map_err(|e| format!("Failed to create settings submenu: {}", e))?;

    let menu = Menu::with_items(app, &[&file_submenu, &settings_submenu])
        .map_err(|e| format!("Failed to create menu: {}", e))?;

    Ok(menu)
}

/// 创建新窗口
#[tauri::command]
async fn create_window(app: tauri::AppHandle, file_path: Option<String>) -> Result<String, String> {
    let label = format!(
        "editor-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()
    );

    let url = match &file_path {
        Some(path) => format!("index.html?file={}", urlencoding::encode(path)),
        None => "index.html".to_string(),
    };

    let menu = build_menu(&app)?;

    let _window =
        tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::App(url.into()))
            .title("")
            .title_bar_style(TitleBarStyle::Overlay)
            .inner_size(1200.0, 800.0)
            .min_inner_size(800.0, 600.0)
            .menu(menu)
            .build()
            .map_err(|e| format!("Failed to create window: {}", e))?;

    Ok(label)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let menu = build_menu(app.handle())?;
            menu.set_as_app_menu()?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let action = match event.id().as_ref() {
                "new_file" => "new-file",
                "open_file" => "open-file",
                "save" => "save",
                "save_as" => "save-as",
                "settings" => "open-settings",
                _ => return,
            };
            let _ = app.emit("menu-action", action);
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            save_file,
            get_file_name,
            list_themes,
            read_theme_css,
            import_typora_theme,
            list_typora_themes,
            read_typora_theme_css,
            export_html,
            create_window,
            rename_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
