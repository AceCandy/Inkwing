use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;
use tauri::Manager;
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

#[derive(Debug, Serialize, Deserialize)]
pub struct FileTreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileTreeNode>,
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
fn list_file_tree(file_path: String) -> Result<FileTreeNode, String> {
    build_file_tree_for_file(Path::new(&file_path))
}

fn build_file_tree_for_file(file_path: &Path) -> Result<FileTreeNode, String> {
    let metadata = fs::metadata(file_path).map_err(|_| "File does not exist".to_string())?;

    if !metadata.is_file() {
        return Err("Path is not a file".to_string());
    }

    let parent = file_path
        .parent()
        .ok_or_else(|| "Failed to get parent directory".to_string())?;

    build_file_tree_for_directory(parent)
}

fn build_file_tree_for_directory(dir: &Path) -> Result<FileTreeNode, String> {
    let metadata =
        fs::metadata(dir).map_err(|e| format!("Failed to read directory metadata: {}", e))?;

    if !metadata.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let mut children = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        let metadata =
            fs::metadata(&path).map_err(|e| format!("Failed to read path metadata: {}", e))?;

        if metadata.is_dir() {
            children.push(build_file_tree_for_directory(&path)?);
        } else if metadata.is_file() && is_supported_file_tree_file(&path) {
            children.push(FileTreeNode {
                name: file_tree_name(&path),
                path: path_to_string(&path)?,
                is_dir: false,
                children: Vec::new(),
            });
        }
    }

    children.sort_by(|left, right| {
        right
            .is_dir
            .cmp(&left.is_dir)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });

    Ok(FileTreeNode {
        name: file_tree_name(dir),
        path: path_to_string(dir)?,
        is_dir: true,
        children,
    })
}

fn is_supported_file_tree_file(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
        return false;
    };

    matches!(
        extension.to_ascii_lowercase().as_str(),
        "md" | "markdown" | "mdown" | "mkd" | "txt"
    )
}

fn file_tree_name(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string())
}

fn path_to_string(path: &Path) -> Result<String, String> {
    path.to_str()
        .map(|value| value.to_string())
        .ok_or_else(|| "Failed to convert path to string".to_string())
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

#[cfg(target_os = "macos")]
fn activate_macos_app() {
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSApplication;

    // dev 模式下裸二进制有时只创建窗口但不抢前台，显式激活当前 NSApplication。
    unsafe {
        let mtm = MainThreadMarker::new_unchecked();
        #[allow(deprecated)]
        NSApplication::sharedApplication(mtm).activateIgnoringOtherApps(true);
    }
}

#[cfg(target_os = "macos")]
fn refocus_macos_app(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(300));

        let app_for_main_thread = app.clone();
        let _ = app.run_on_main_thread(move || {
            if let Some(main_window) = app_for_main_thread.get_webview_window("main") {
                let _ = main_window.show();
                let _ = main_window.unminimize();
                let _ = main_window.set_focus();
            }

            activate_macos_app();
        });
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let menu = build_menu(app.handle())?;
            menu.set_as_app_menu()?;

            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Regular);
                app.show()?;
            }

            let main_window = app
                .get_webview_window("main")
                .ok_or(tauri::Error::WindowNotFound)?;
            let _ = main_window.set_menu(menu)?;
            // 主窗口由 Tauri 配置创建；setup 只负责显式显示和聚焦，避免 dev/release 启动后进程存在但窗口不可见。
            main_window.show()?;
            main_window.unminimize()?;
            main_window.set_focus()?;

            #[cfg(target_os = "macos")]
            {
                activate_macos_app();
                refocus_macos_app(app.handle().clone());
            }

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
            list_file_tree,
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn unique_temp_dir(name: &str) -> PathBuf {
        let suffix = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("inkwing-file-tree-{}-{}", name, suffix))
    }

    #[test]
    fn builds_the_open_files_parent_directory_tree() {
        let root = unique_temp_dir("parent-tree");
        let drafts_dir = root.join("drafts");
        fs::create_dir_all(&drafts_dir).unwrap();
        fs::write(root.join("zeta.md"), "# Zeta").unwrap();
        fs::write(root.join("current.md"), "# Current").unwrap();
        fs::write(drafts_dir.join("chapter.md"), "# Chapter").unwrap();

        let tree = build_file_tree_for_file(&root.join("current.md")).unwrap();

        assert_eq!(tree.name, root.file_name().unwrap().to_string_lossy());
        assert_eq!(tree.path, root.to_string_lossy());
        assert!(tree.is_dir);
        assert_eq!(
            tree.children
                .iter()
                .map(|child| child.name.as_str())
                .collect::<Vec<_>>(),
            vec!["drafts", "current.md", "zeta.md"],
        );

        let drafts = tree
            .children
            .iter()
            .find(|child| child.name == "drafts")
            .unwrap();
        assert!(drafts.is_dir);
        assert_eq!(drafts.children[0].name, "chapter.md");

        let current = tree
            .children
            .iter()
            .find(|child| child.name == "current.md")
            .unwrap();
        assert!(!current.is_dir);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn filters_file_tree_to_markdown_and_text_files() {
        let root = unique_temp_dir("filtered-files");
        let assets_dir = root.join("assets");
        fs::create_dir_all(&assets_dir).unwrap();
        fs::write(root.join("current.md"), "# Current").unwrap();
        fs::write(root.join("draft.markdown"), "# Draft").unwrap();
        fs::write(root.join("notes.mdown"), "# Notes").unwrap();
        fs::write(root.join("README.MD"), "# Readme").unwrap();
        fs::write(root.join("plain.txt"), "Plain text").unwrap();
        fs::write(root.join("sketch.mkd"), "# Sketch").unwrap();
        fs::write(root.join("image.png"), "png").unwrap();
        fs::write(root.join("data.json"), "{}").unwrap();
        fs::write(assets_dir.join("chapter.TXT"), "Chapter").unwrap();
        fs::write(assets_dir.join("photo.jpeg"), "jpeg").unwrap();

        let tree = build_file_tree_for_file(&root.join("current.md")).unwrap();

        assert_eq!(
            tree.children
                .iter()
                .map(|child| child.name.as_str())
                .collect::<Vec<_>>(),
            vec![
                "assets",
                "current.md",
                "draft.markdown",
                "notes.mdown",
                "plain.txt",
                "README.MD",
                "sketch.mkd",
            ],
        );

        let assets = tree
            .children
            .iter()
            .find(|child| child.name == "assets")
            .unwrap();
        assert_eq!(
            assets
                .children
                .iter()
                .map(|child| child.name.as_str())
                .collect::<Vec<_>>(),
            vec!["chapter.TXT"],
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn rejects_missing_current_file_when_building_file_tree() {
        let root = unique_temp_dir("missing-file");
        fs::create_dir_all(&root).unwrap();

        let err = build_file_tree_for_file(&root.join("missing.md")).unwrap_err();

        assert!(err.contains("File does not exist"));

        let _ = fs::remove_dir_all(&root);
    }
}
