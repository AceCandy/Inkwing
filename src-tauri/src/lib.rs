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

/// 单次全文搜索命中。对齐 Typora 的 ty-search-item 渲染所需字段：
/// 文件路径/文件名/父目录/命中行号(1-based)/整行文本/首个匹配子串。
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct SearchHit {
    pub path: String,
    pub name: String,
    pub parent_dir: String,
    pub line_number: usize,
    pub line_text: String,
    pub match_text: String,
    /// 是否为「文件名命中」：对齐 Typora rpTask2（`--iglob "*query*"`）——文件名含
    /// 关键字但内容未必命中时，仍算一条命中，前端按 count=0 + 首行摘要渲染。
    /// true 时 line_text 取该文件首行内容作为摘要，match_text 为 query 本身。
    pub is_filename_hit: bool,
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

/// 搜索专用文件类型判断：比文件树展示白名单更宽，对齐 Typora `rg -g !.*` 搜所有
/// 非隐藏文本文件的行为。Typora 用 ripgrep 自带的二进制/编码检测兜底；这里改为
/// 维护一份常见文本扩展名白名单（含 md/笔记 + 配置/数据/代码/日志），既贴近 Typora
/// 的"搜得到更多"，又避免把 .png/.pdf 等二进制当文本硬读。
///
/// 注意：与 is_supported_file_tree_file 分离——后者只决定侧栏文件树显示哪些文件，
/// 不应因搜索范围扩大而把 json/log 也塞进文件树。
fn is_searchable_text_file(path: &Path) -> bool {
    // 跳过隐藏文件/目录（. 开头），对齐 Typora `-g !.*`。
    let is_hidden = path
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.starts_with('.'))
        .unwrap_or(true);
    if is_hidden {
        return false;
    }

    let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
        // 无扩展名：Typora 会尝试读取（ripgrep 自动判二进制）。这里默认不搜无扩展名，
        // 避免误读大量无后缀二进制（如编译产物）。可按需放开。
        return false;
    };

    matches!(
        extension.to_ascii_lowercase().as_str(),
        // 笔记 / 文档
        "md" | "markdown" | "mdown" | "mkd" | "txt" | "text" | "rst" | "org" | "tex"
        // 数据 / 配置
        | "json" | "csv" | "tsv" | "xml" | "yaml" | "yml" | "toml" | "ini" | "conf" | "config" | "properties" | "env"
        // 网页 / 样式
        | "html" | "htm" | "css" | "scss" | "sass" | "less"
        // 脚本 / 代码（常见）
        | "js" | "jsx" | "ts" | "tsx" | "vue" | "py" | "rb" | "php" | "sh" | "bash" | "zsh" | "bat" | "ps1"
        | "c" | "h" | "cpp" | "cc" | "hpp" | "java" | "kt" | "go" | "rs" | "swift" | "lua" | "pl"
        // 日志
        | "log"
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

/// 在打开文件夹（当前文件所在目录）下做全文内容搜索，对齐 Typora 侧栏文件搜索：
/// 同时跑「文件名搜索」(rpTask2) 和「内容搜索」(rpTask1)。文件名命中在内容未命中时
/// 也算一条命中；内容命中按行返回。
#[tauri::command]
fn search_in_files(
    folder_path: String,
    query: String,
    case_sensitive: bool,
    whole_word: bool,
) -> Result<Vec<SearchHit>, String> {
    search_folder_content(&folder_path, &query, case_sensitive, whole_word)
}

/// 每个文件最多返回的命中行数（对齐 Typora `rg -m 21`）。
const MAX_HITS_PER_FILE: usize = 21;
/// 全局最多返回的命中行数（对齐 Typora 渲染上限 l=30，避免大目录拖慢）。
const MAX_HITS_TOTAL: usize = 30;
/// 命中行文本截断长度，避免超长行撑爆前端。
const MAX_LINE_TEXT_LEN: usize = 200;

fn search_folder_content(
    folder_path: &str,
    query: &str,
    case_sensitive: bool,
    whole_word: bool,
) -> Result<Vec<SearchHit>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let root = Path::new(folder_path);
    let metadata = fs::metadata(root).map_err(|e| format!("Failed to read folder: {}", e))?;
    if !metadata.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let needle = if case_sensitive {
        query.to_string()
    } else {
        query.to_lowercase()
    };
    let matcher = LineMatcher::new(&needle, case_sensitive, whole_word);
    // 文件名匹配用同一 needle（大小写按 case_sensitive），whole_word 对文件名无意义
    // （Typora --iglob 用的是子串通配 "*query*"），故文件名只做子串包含。
    let filename_needle = needle.clone();

    let mut hits: Vec<SearchHit> = Vec::new();
    collect_search_hits(root, &matcher, &filename_needle, case_sensitive, &mut hits);
    Ok(hits)
}

fn collect_search_hits(
    dir: &Path,
    matcher: &LineMatcher,
    filename_needle: &str,
    case_sensitive: bool,
    hits: &mut Vec<SearchHit>,
) {
    if hits.len() >= MAX_HITS_TOTAL {
        return;
    }

    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    let mut children: Vec<_> = entries.flatten().collect();
    children.sort_by_key(|entry| {
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        (!is_dir, entry.file_name())
    });

    for entry in children {
        if hits.len() >= MAX_HITS_TOTAL {
            return;
        }

        let path = entry.path();
        let metadata = match fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };

        if metadata.is_dir() {
            collect_search_hits(&path, matcher, filename_needle, case_sensitive, hits);
            continue;
        }

        // 跳过 >2MB 文件，对齐 Typora `--max-filesize 2M`。
        if !metadata.is_file() || metadata.len() > 2 * 1024 * 1024 || !is_searchable_text_file(&path) {
            continue;
        }

        let Some(file_name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };

        // 文件名匹配（对齐 Typora rpTask2 --iglob "*query*"）：子串包含即算命中。
        // 大小写按 case_sensitive，whole_word 不影响文件名。
        let name_match = if case_sensitive {
            file_name.contains(filename_needle)
        } else {
            file_name.to_lowercase().contains(filename_needle)
        };

        let Ok(content) = fs::read_to_string(&path) else {
            // 非 UTF-8 / 不可读：跳过（等价于 ripgrep 跳过二进制）。
            // 但若文件名命中，仍作为文件名命中返回（Typora rpTask2 独立于内容读取）。
            // 此时无摘要，match_text 与 line_text 同为空串（对齐 Typora 整行高亮，空行不高亮）。
            if name_match {
                push_filename_hit(&path, "", "", hits);
            }
            continue;
        };

        // 先收集内容命中。
        let file_hits_start = hits.len();
        let mut file_hits = 0;
        let mut first_line: Option<String> = None;
        for (index, line) in content.lines().enumerate() {
            if first_line.is_none() && !line.trim().is_empty() {
                first_line = Some(truncate_line(line, MAX_LINE_TEXT_LEN));
            }
            if file_hits >= MAX_HITS_PER_FILE || hits.len() >= MAX_HITS_TOTAL {
                break;
            }
            let Some(match_text) = matcher.find(line) else {
                continue;
            };

            let truncated = truncate_line(line, MAX_LINE_TEXT_LEN);
            hits.push(SearchHit {
                path: path_to_string_or_lossy(&path),
                name: file_tree_name(&path),
                parent_dir: parent_dir_display(&path),
                line_number: index + 1,
                line_text: truncated,
                match_text,
                is_filename_hit: false,
            });
            file_hits += 1;
        }
        let _ = file_hits_start; // 保留以便后续按文件聚合优化

        // 文件名命中：仅当该文件没有内容命中时才补一条（避免与内容命中重复占位）。
        // 对齐 Typora rpTask2：内容命中的文件不会再显示文件名摘要行；文件名命中是"内容搜不到
        // 但文件名匹配"的兜底。摘要取该文件首个非空行（Typora 取 matches[0]）。
        // match_text 设为摘要本身：Typora 在文件名命中时用 m(n,0,n.length,line) 把整行
        // 当作匹配段高亮（query 出现在文件名里、不在摘要行里，故无法只高亮 query）。
        if name_match && file_hits == 0 {
            let summary = first_line.unwrap_or_default();
            push_filename_hit(&path, &summary, &summary, hits);
        }
    }
}

/// 文件名命中：count 在前端按 group 聚合时为 0（is_filename_hit=true 的 group 不累加）。
/// line_text 为摘要（首行），match_text 与 line_text 相同（对齐 Typora 整行高亮），
/// line_number 固定 1。
fn push_filename_hit(path: &Path, summary: &str, query_text: &str, hits: &mut Vec<SearchHit>) {
    if hits.len() >= MAX_HITS_TOTAL {
        return;
    }
    hits.push(SearchHit {
        path: path_to_string_or_lossy(path),
        name: file_tree_name(path),
        parent_dir: parent_dir_display(path),
        line_number: 1,
        line_text: summary.to_string(),
        // 对齐 Typora：文件名命中时 match_text = 摘要全文（整行高亮）。
        match_text: query_text.to_string(),
        is_filename_hit: true,
    });
}

fn truncate_line(line: &str, max_len: usize) -> String {
    if line.chars().count() <= max_len {
        return line.to_string();
    }

    let trimmed = line.trim_start();
    let chars: Vec<char> = trimmed.chars().take(max_len).collect();
    let mut result: String = chars.iter().collect();
    result.push('…');
    result
}

fn parent_dir_display(path: &Path) -> String {
    let Some(parent) = path.parent() else {
        return String::new();
    };
    let Some(name) = parent.file_name().and_then(|n| n.to_str()) else {
        return String::new();
    };
    name.to_string()
}

fn path_to_string_or_lossy(path: &Path) -> String {
    path.to_str()
        .map(|value| value.to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string())
}

/// 行级匹配器：判断一行是否命中 query，命中则返回首个匹配子串。
struct LineMatcher {
    needle: String,
    case_sensitive: bool,
    whole_word: bool,
}

impl LineMatcher {
    fn new(needle: &str, case_sensitive: bool, whole_word: bool) -> Self {
        Self {
            needle: needle.to_string(),
            case_sensitive,
            whole_word,
        }
    }

    /// 返回该行首个命中的子串（已按大小写设置还原为原文）。
    fn find(&self, line: &str) -> Option<String> {
        let (haystack, needle) = if self.case_sensitive {
            (line.to_string(), self.needle.clone())
        } else {
            (line.to_lowercase(), self.needle.clone())
        };

        let mut start = 0;
        while let Some(relative) = haystack[start..].find(&needle) {
            let begin = start + relative;
            let end = begin + needle.len();
            if !self.whole_word || self.is_whole_word(&haystack, begin, end) {
                let match_text = line[begin..end].to_string();
                return Some(match_text);
            }
            start = end.max(begin + 1);
        }

        None
    }

    fn is_whole_word(&self, haystack: &str, begin: usize, end: usize) -> bool {
        let bytes = haystack.as_bytes();
        let before_ok = begin == 0 || !is_word_byte(bytes[begin - 1]);
        let after_ok = end >= bytes.len() || !is_word_byte(bytes[end]);
        before_ok && after_ok
    }
}

fn is_word_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_'
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
            search_in_files,
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

    #[test]
    fn searches_file_contents_across_the_folder() {
        let root = unique_temp_dir("search-content");
        let notes_dir = root.join("notes");
        fs::create_dir_all(&notes_dir).unwrap();
        fs::write(notes_dir.join("intro.md"), "# Architecture\n## 职责\nDetail line.\n").unwrap();
        fs::write(root.join("readme.md"), "职责 overview\nARCHITECTURE notes\n").unwrap();
        fs::write(root.join("binary.png"), "职责").unwrap();

        let hits =
            search_folder_content(root.to_str().unwrap(), "职责", false, false).unwrap();

        assert_eq!(hits.len(), 2);

        let intro_line = hits.iter().find(|h| h.name == "intro.md").unwrap();
        assert_eq!(intro_line.line_number, 2);
        assert_eq!(intro_line.line_text, "## 职责");
        assert_eq!(intro_line.match_text, "职责");
        assert_eq!(intro_line.parent_dir, "notes");

        let readme_line = hits.iter().find(|h| h.name == "readme.md").unwrap();
        assert_eq!(readme_line.line_number, 1);
        assert_eq!(readme_line.match_text, "职责");
        assert_eq!(readme_line.parent_dir, root.file_name().unwrap().to_string_lossy());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn respects_case_sensitive_and_whole_word_options() {
        let root = unique_temp_dir("search-options");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("a.md"), "Todo TODO todont\n").unwrap();

        // 默认大小写不敏感：Todo / TODO / todont 都命中同一行 → 单条命中。
        let insensitive = search_folder_content(root.to_str().unwrap(), "todo", false, false).unwrap();
        assert_eq!(insensitive.len(), 1);
        assert_eq!(insensitive[0].line_number, 1);

        // 大小写敏感：只有 Todo 命中（首个匹配）。
        let sensitive = search_folder_content(root.to_str().unwrap(), "Todo", true, false).unwrap();
        assert_eq!(sensitive.len(), 1);
        assert_eq!(sensitive[0].match_text, "Todo");

        // 整词：todont 不算命中 → 仍命中 Todo / TODO 同一行。
        let whole = search_folder_content(root.to_str().unwrap(), "todo", false, true).unwrap();
        assert_eq!(whole.len(), 1);
        assert_eq!(whole[0].match_text, "Todo");

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn skips_non_text_and_binary_files_during_content_search() {
        let root = unique_temp_dir("search-types");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("doc.md"), "target keyword\n").unwrap();
        // .png 不在搜索白名单内（二进制），应跳过。
        fs::write(root.join("image.png"), "target\n").unwrap();
        // .json 现在属于常见文本白名单，应可搜到（对齐 Typora 搜所有非隐藏文本文件）。
        fs::write(root.join("data.json"), "target value\n").unwrap();

        let hits = search_folder_content(root.to_str().unwrap(), "target", false, false).unwrap();
        let mut names: Vec<&str> = hits.iter().map(|h| h.name.as_str()).collect();
        names.sort();
        assert_eq!(names, vec!["data.json", "doc.md"]);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn matches_filenames_when_content_does_not_hit() {
        // 文件名命中：文件名含 query 但内容不含时，仍算一条命中（对齐 Typora rpTask2 --iglob）。
        let root = unique_temp_dir("search-filename");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("职责笔记.md"), "# Architecture\njust some notes\n").unwrap();
        // 文件名和内容都命中：只出内容命中，不重复出文件名摘要行。
        fs::write(root.join("职责.md"), "这里讨论职责\n").unwrap();

        let hits = search_folder_content(root.to_str().unwrap(), "职责", false, false).unwrap();

        let filename_hit = hits
            .iter()
            .find(|h| h.name == "职责笔记.md")
            .expect("filename-only hit should be present");
        assert!(filename_hit.is_filename_hit);
        // count 在前端按 group 聚合为 0；后端单条 is_filename_hit=true。
        // 摘要取首个非空行。
        assert_eq!(filename_hit.line_text, "# Architecture");
        // 对齐 Typora：文件名命中时 match_text = 摘要全文（整行高亮），而非 query。
        assert_eq!(filename_hit.match_text, "# Architecture");

        // 内容命中的文件 is_filename_hit=false。
        let content_hit = hits.iter().find(|h| h.name == "职责.md").unwrap();
        assert!(!content_hit.is_filename_hit);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn returns_empty_for_blank_query_or_missing_folder() {
        assert!(search_folder_content("/no/such/dir", "x", false, false).is_err());
        let root = unique_temp_dir("search-blank");
        fs::create_dir_all(&root).unwrap();
        assert_eq!(
            search_folder_content(root.to_str().unwrap(), "   ", false, false).unwrap(),
            Vec::<SearchHit>::new()
        );
        let _ = fs::remove_dir_all(&root);
    }
}
