use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const MANIFEST_FILE: &str = "inkwing-theme.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TyporaThemeVariant {
    pub id: String,
    pub name: String,
    pub css_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TyporaThemePackage {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub theme_type: String,
    pub base_path: String,
    pub variants: Vec<TyporaThemeVariant>,
    pub imported_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TyporaThemeCss {
    pub css: String,
    pub base_path: String,
}

fn timestamp_millis() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string()
}

fn manifest_path(theme_dir: &Path) -> PathBuf {
    theme_dir.join(MANIFEST_FILE)
}

pub(crate) fn normalize_theme_id(input: &str) -> String {
    let mut result = String::new();
    let mut last_was_dash = false;

    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() {
            result.push(ch.to_ascii_lowercase());
            last_was_dash = false;
        } else if !last_was_dash {
            result.push('-');
            last_was_dash = true;
        }
    }

    result.trim_matches('-').to_string()
}

pub(crate) fn variant_name_from_css_file(css_file: &str) -> String {
    let stem = Path::new(css_file)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(css_file);

    stem.split(|ch: char| !ch.is_ascii_alphanumeric())
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => {
                    let mut name = String::new();
                    name.push(first.to_ascii_uppercase());
                    name.push_str(chars.as_str().to_ascii_lowercase().as_str());
                    name
                }
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub(crate) fn is_safe_path_segment(value: &str) -> Result<(), String> {
    if value.is_empty() {
        return Err("Path segment cannot be empty".to_string());
    }
    if value.starts_with('.') {
        return Err("Path segment cannot start with dot".to_string());
    }
    if value == "." || value == ".." {
        return Err("Path segment cannot be relative navigation".to_string());
    }
    if value.contains('/') || value.contains('\\') {
        return Err("Path segment cannot contain path separators".to_string());
    }

    Ok(())
}

fn validate_css_file(css_file: &str) -> Result<(), String> {
    is_safe_path_segment(css_file)?;
    if !css_file.ends_with(".css") {
        return Err("css_file must end with .css".to_string());
    }

    Ok(())
}

fn is_typora_user_css_file(file_name: &str) -> bool {
    file_name == "base.user.css" || file_name.ends_with(".user.css")
}

pub(crate) fn scan_css_files(dir: &Path) -> Result<Vec<TyporaThemeVariant>, String> {
    let mut entries = Vec::new();
    let read_dir = fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let file_name = match path.file_name().and_then(|value| value.to_str()) {
            Some(value) => value.to_string(),
            None => continue,
        };

        if !file_name.ends_with(".css") {
            continue;
        }

        if is_typora_user_css_file(&file_name) {
            continue;
        }

        if is_safe_path_segment(&file_name).is_err() {
            continue;
        }

        let stem = path
            .file_stem()
            .and_then(|value| value.to_str())
            .ok_or_else(|| format!("Invalid CSS file name: {}", file_name))?;

        entries.push(TyporaThemeVariant {
            id: normalize_theme_id(stem),
            name: variant_name_from_css_file(&file_name),
            css_file: file_name,
        });
    }

    entries.sort_by(|left, right| left.css_file.cmp(&right.css_file));

    if entries.is_empty() {
        return Err("No Typora CSS files found".to_string());
    }

    Ok(entries)
}

fn package_name_from_source_dir(source_dir: &Path) -> String {
    source_dir
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Typora Theme".to_string())
}

fn typora_themes_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))
        .map(|path| path.join("themes").join("typora"))
}

fn bundled_typora_themes_root(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let resource_themes = resource_dir.join("themes");
        if resource_themes.exists() {
            return Some(resource_themes);
        }
    }

    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|workspace_root| workspace_root.join("themes"))
        .filter(|themes_root| themes_root.exists())
}

fn typora_theme_roots_for_list(app: &AppHandle) -> Result<Vec<PathBuf>, String> {
    let mut roots = Vec::new();

    if let Some(bundled_root) = bundled_typora_themes_root(app) {
        roots.push(bundled_root);
    }
    roots.push(typora_themes_root(app)?);

    Ok(roots)
}

fn typora_theme_roots_for_read(app: &AppHandle) -> Result<Vec<PathBuf>, String> {
    let mut roots = vec![typora_themes_root(app)?];

    if let Some(bundled_root) = bundled_typora_themes_root(app) {
        roots.push(bundled_root);
    }

    Ok(roots)
}

fn cleanup_dir(path: &Path) {
    let _ = fs::remove_dir_all(path);
}

fn copy_dir_recursive(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(|e| {
        format!(
            "Failed to create directory {}: {}",
            destination.display(),
            e
        )
    })?;

    for entry in fs::read_dir(source)
        .map_err(|e| format!("Failed to read directory {}: {}", source.display(), e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let source_path = entry.path();
        let target_path = destination.join(entry.file_name());
        let metadata = fs::symlink_metadata(&source_path)
            .map_err(|e| format!("Failed to inspect source {}: {}", source_path.display(), e))?;

        if metadata.file_type().is_symlink() {
            return Err(format!(
                "Symlink entries are not allowed in Typora themes: {}",
                source_path.display()
            ));
        }

        if metadata.is_dir() {
            copy_dir_recursive(&source_path, &target_path)?;
            continue;
        }

        if !metadata.is_file() {
            return Err(format!(
                "Unsupported file type in Typora theme: {}",
                source_path.display()
            ));
        }

        fs::copy(&source_path, &target_path).map_err(|e| {
            format!(
                "Failed to copy {} to {}: {}",
                source_path.display(),
                target_path.display(),
                e
            )
        })?;
    }

    Ok(())
}

fn read_manifest(theme_dir: &Path) -> Result<TyporaThemePackage, String> {
    let manifest = manifest_path(theme_dir);
    let content = fs::read_to_string(&manifest)
        .map_err(|e| format!("Failed to read manifest {}: {}", manifest.display(), e))?;

    let mut package: TyporaThemePackage = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse manifest {}: {}", manifest.display(), e))?;

    if Path::new(&package.base_path).is_relative() {
        package.base_path = theme_dir.to_string_lossy().to_string();
    }

    Ok(package)
}

fn write_manifest(theme_dir: &Path, package: &TyporaThemePackage) -> Result<(), String> {
    let manifest = manifest_path(theme_dir);
    let content = serde_json::to_string_pretty(package)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

    fs::write(&manifest, content)
        .map_err(|e| format!("Failed to write manifest {}: {}", manifest.display(), e))
}

fn find_theme_dir(root: &Path, theme_id: &str) -> Result<PathBuf, String> {
    is_safe_path_segment(theme_id)?;
    Ok(root.join(theme_id))
}

fn ensure_variant_exists(package: &TyporaThemePackage, css_file: &str) -> Result<(), String> {
    validate_css_file(css_file)?;

    if package
        .variants
        .iter()
        .any(|variant| variant.css_file == css_file)
    {
        Ok(())
    } else {
        Err(format!("CSS file {} is not declared in manifest", css_file))
    }
}

fn optional_css_file(theme_dir: &Path, css_file: &str) -> Result<Option<String>, String> {
    validate_css_file(css_file)?;

    let css_path = theme_dir.join(css_file);
    if !css_path.exists() {
        return Ok(None);
    }

    let metadata = fs::symlink_metadata(&css_path)
        .map_err(|e| format!("Failed to inspect CSS {}: {}", css_path.display(), e))?;
    if metadata.file_type().is_symlink() {
        return Err(format!(
            "Symlink CSS file is not allowed: {}",
            css_path.display()
        ));
    }
    if !metadata.is_file() {
        return Err(format!("CSS path is not a file: {}", css_path.display()));
    }

    fs::read_to_string(&css_path)
        .map(Some)
        .map_err(|e| format!("Failed to read CSS {}: {}", css_path.display(), e))
}

fn theme_user_css_file(css_file: &str) -> Result<String, String> {
    validate_css_file(css_file)?;
    let stem = Path::new(css_file)
        .file_stem()
        .and_then(|value| value.to_str())
        .ok_or_else(|| format!("Invalid CSS file name: {}", css_file))?;

    Ok(format!("{}.user.css", stem))
}

fn resolve_import_paths(root: &Path, normalized_id: &str) -> Result<(PathBuf, PathBuf), String> {
    let mut suffix = 1usize;
    let mut final_dir_name = normalized_id.to_string();
    let mut final_dir = root.join(&final_dir_name);

    while final_dir.exists() {
        suffix += 1;
        final_dir_name = format!("{}-{}", normalized_id, suffix);
        final_dir = root.join(&final_dir_name);
    }

    let mut staging_counter = 1usize;
    let mut staging_dir = root.join(format!(
        ".{}-staging-{}-{}",
        final_dir_name,
        std::process::id(),
        timestamp_millis()
    ));
    while staging_dir.exists() {
        staging_counter += 1;
        staging_dir = root.join(format!(
            ".{}-staging-{}-{}-{}",
            final_dir_name,
            std::process::id(),
            timestamp_millis(),
            staging_counter
        ));
    }

    Ok((final_dir, staging_dir))
}

pub(crate) fn import_typora_theme_into_root(
    root: &Path,
    source_path: &Path,
) -> Result<TyporaThemePackage, String> {
    let source_meta = fs::symlink_metadata(source_path)
        .map_err(|e| format!("Failed to inspect source {}: {}", source_path.display(), e))?;
    if source_meta.file_type().is_symlink() {
        return Err(format!(
            "Source directory cannot be a symlink: {}",
            source_path.display()
        ));
    }
    if !source_meta.is_dir() {
        return Err(format!(
            "Source directory does not exist: {}",
            source_path.display()
        ));
    }

    fs::create_dir_all(root)
        .map_err(|e| format!("Failed to create themes root {}: {}", root.display(), e))?;

    let variants = scan_css_files(source_path)?;
    let package_name = package_name_from_source_dir(source_path);
    let normalized_id = normalize_theme_id(&package_name);
    if normalized_id.is_empty() {
        return Err("Theme id cannot be empty".to_string());
    }

    let (final_dir, staging_dir) = resolve_import_paths(root, &normalized_id)?;
    let mut staged_dir: Option<PathBuf> = Some(staging_dir.clone());
    let result = (|| {
        copy_dir_recursive(source_path, &staging_dir)?;

        let package = TyporaThemePackage {
            id: final_dir
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or(&normalized_id)
                .to_string(),
            name: package_name,
            theme_type: "typora".to_string(),
            base_path: final_dir.to_string_lossy().to_string(),
            variants,
            imported_at: timestamp_millis(),
        };

        write_manifest(&staging_dir, &package)?;

        fs::rename(&staging_dir, &final_dir).map_err(|e| {
            format!(
                "Failed to finalize Typora theme {} -> {}: {}",
                staging_dir.display(),
                final_dir.display(),
                e
            )
        })?;

        staged_dir = None;
        Ok(package)
    })();

    if result.is_err() {
        if let Some(path) = staged_dir {
            cleanup_dir(&path);
        }
    }

    result
}

#[tauri::command]
pub fn import_typora_theme(
    app: AppHandle,
    source_dir: String,
) -> Result<TyporaThemePackage, String> {
    let root = typora_themes_root(&app)?;
    import_typora_theme_into_root(&root, Path::new(&source_dir))
}

#[tauri::command]
pub fn list_typora_themes(app: AppHandle) -> Result<Vec<TyporaThemePackage>, String> {
    let roots = typora_theme_roots_for_list(&app)?;
    list_typora_theme_packages_from_roots(&roots)
}

#[tauri::command]
pub fn read_typora_theme_css(
    app: AppHandle,
    theme_id: String,
    css_file: String,
) -> Result<TyporaThemeCss, String> {
    let roots = typora_theme_roots_for_read(&app)?;
    read_typora_theme_css_from_roots(&roots, &theme_id, &css_file)
}

pub(crate) fn list_typora_theme_packages(root: &Path) -> Result<Vec<TyporaThemePackage>, String> {
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut packages = Vec::new();
    for entry in fs::read_dir(root)
        .map_err(|e| format!("Failed to read themes root {}: {}", root.display(), e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let theme_dir = entry.path();
        let metadata = fs::symlink_metadata(&theme_dir).map_err(|e| {
            format!(
                "Failed to inspect theme directory {}: {}",
                theme_dir.display(),
                e
            )
        })?;

        if metadata.file_type().is_symlink() {
            return Err(format!(
                "Symlink theme directory is not allowed: {}",
                theme_dir.display()
            ));
        }

        if !metadata.is_dir() {
            continue;
        }

        let manifest = manifest_path(&theme_dir);
        if !manifest.exists() {
            return Err(format!(
                "Missing Typora theme manifest: {}",
                manifest.display()
            ));
        }

        packages.push(read_manifest(&theme_dir)?);
    }

    packages.sort_by(|left, right| left.name.cmp(&right.name).then(left.id.cmp(&right.id)));
    Ok(packages)
}

pub(crate) fn list_typora_theme_packages_from_roots<P: AsRef<Path>>(
    roots: &[P],
) -> Result<Vec<TyporaThemePackage>, String> {
    let mut packages = Vec::new();

    for root in roots {
        let root = root.as_ref();
        if !root.exists() {
            continue;
        }
        packages.extend(list_typora_theme_packages(root)?);
    }

    packages.sort_by(|left, right| left.name.cmp(&right.name).then(left.id.cmp(&right.id)));
    Ok(packages)
}

pub(crate) fn read_typora_theme_css_from_root(
    root: &Path,
    theme_id: &str,
    css_file: &str,
) -> Result<TyporaThemeCss, String> {
    validate_css_file(css_file)?;

    let theme_dir = find_theme_dir(root, theme_id)?;
    let metadata = fs::symlink_metadata(&theme_dir).map_err(|e| {
        format!(
            "Failed to inspect theme directory {}: {}",
            theme_dir.display(),
            e
        )
    })?;

    if metadata.file_type().is_symlink() {
        return Err(format!(
            "Symlink theme directory is not allowed: {}",
            theme_dir.display()
        ));
    }

    if !metadata.is_dir() {
        return Err(format!(
            "Theme directory is not a directory: {}",
            theme_dir.display()
        ));
    }

    let package = read_manifest(&theme_dir)?;
    ensure_variant_exists(&package, css_file)?;

    let css_path = theme_dir.join(css_file);
    let main_css = fs::read_to_string(&css_path)
        .map_err(|e| format!("Failed to read CSS {}: {}", css_path.display(), e))?;

    let mut css_parts = vec![main_css];
    if let Some(base_user_css) = optional_css_file(&theme_dir, "base.user.css")? {
        css_parts.push(base_user_css);
    }
    let theme_user_file_name = theme_user_css_file(css_file)?;
    if theme_user_file_name != "base.user.css" {
        if let Some(theme_user_css) = optional_css_file(&theme_dir, &theme_user_file_name)? {
            css_parts.push(theme_user_css);
        }
    }

    Ok(TyporaThemeCss {
        css: css_parts.join("\n"),
        base_path: package.base_path,
    })
}

pub(crate) fn read_typora_theme_css_from_roots<P: AsRef<Path>>(
    roots: &[P],
    theme_id: &str,
    css_file: &str,
) -> Result<TyporaThemeCss, String> {
    is_safe_path_segment(theme_id)?;
    validate_css_file(css_file)?;

    let mut errors = Vec::new();
    for root in roots {
        let root = root.as_ref();
        if !root.exists() {
            continue;
        }

        match read_typora_theme_css_from_root(root, theme_id, css_file) {
            Ok(css) => return Ok(css),
            Err(error) => errors.push(error),
        }
    }

    Err(if errors.is_empty() {
        format!("Typora theme {} was not found", theme_id)
    } else {
        format!(
            "Typora theme {} was not found: {}",
            theme_id,
            errors.join("; ")
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn unique_temp_dir(name: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("inkwing-{}-{}", name, suffix))
    }

    fn create_basic_theme_source(dir: &Path) {
        fs::create_dir_all(dir).unwrap();
        fs::write(dir.join("a.css"), "body {}").unwrap();
    }

    fn create_symlink_dir(target: &Path, link: &Path) {
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(target, link).unwrap();
        }

        #[cfg(windows)]
        {
            std::os::windows::fs::symlink_dir(target, link).unwrap();
        }
    }

    fn write_theme_package(root: &Path, id: &str, name: &str, css: &str) -> PathBuf {
        let theme_dir = root.join(id);
        fs::create_dir_all(&theme_dir).unwrap();
        fs::write(theme_dir.join("theme.css"), css).unwrap();

        let package = TyporaThemePackage {
            id: id.to_string(),
            name: name.to_string(),
            theme_type: "typora".to_string(),
            base_path: theme_dir.to_string_lossy().to_string(),
            variants: vec![TyporaThemeVariant {
                id: "theme".to_string(),
                name: "Theme".to_string(),
                css_file: "theme.css".to_string(),
            }],
            imported_at: "bundled".to_string(),
        };
        fs::write(
            manifest_path(&theme_dir),
            serde_json::to_string_pretty(&package).unwrap(),
        )
        .unwrap();

        theme_dir
    }

    #[test]
    fn normalize_theme_id_collapses_ascii_and_unicode() {
        assert_eq!(
            normalize_theme_id("Claude Typora Theme v1.0.0"),
            "claude-typora-theme-v1-0-0"
        );
    }

    #[test]
    fn scan_css_files_sorts_root_css_and_ignores_readme() {
        let dir = unique_temp_dir("scan-css-files");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("b.css"), "body {}").unwrap();
        fs::write(dir.join("a.css"), "body {}").unwrap();
        fs::write(dir.join("README.md"), "# ignore").unwrap();

        let variants = scan_css_files(&dir).unwrap();

        assert_eq!(variants.len(), 2);
        assert_eq!(variants[0].css_file, "a.css");
        assert_eq!(variants[1].css_file, "b.css");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn scan_css_files_ignores_typora_user_css_overrides() {
        let dir = unique_temp_dir("scan-css-user-overrides");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("claude.css"), "body {}").unwrap();
        fs::write(dir.join("base.user.css"), "body { color: red; }").unwrap();
        fs::write(dir.join("claude.user.css"), "body { color: blue; }").unwrap();

        let variants = scan_css_files(&dir).unwrap();

        assert_eq!(variants.len(), 1);
        assert_eq!(variants[0].css_file, "claude.css");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn scan_css_files_errors_when_no_css_exists() {
        let dir = unique_temp_dir("scan-css-empty");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("README.md"), "# ignore").unwrap();

        let err = scan_css_files(&dir).unwrap_err();

        assert!(err.contains("No Typora CSS files found"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn safe_path_segment_rejects_parent_and_nested_and_hidden_paths() {
        assert!(is_safe_path_segment("..").is_err());
        assert!(is_safe_path_segment("a/b.css").is_err());
        assert!(is_safe_path_segment(".hidden.css").is_err());
    }

    #[test]
    fn list_helper_errors_when_manifest_is_missing() {
        let root = unique_temp_dir("list-missing-manifest");
        let theme_dir = root.join("theme-a");
        fs::create_dir_all(&theme_dir).unwrap();

        let err = list_typora_theme_packages(&root).unwrap_err();

        assert!(err.contains("Missing Typora theme manifest"));

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn list_roots_merges_bundled_and_imported_typora_css_packages() {
        let bundled_root = unique_temp_dir("list-roots-bundled");
        let imported_root = unique_temp_dir("list-roots-imported");
        write_theme_package(
            &bundled_root,
            "catppuccin-mocha",
            "Catppuccin Mocha",
            "body {}",
        );
        write_theme_package(&imported_root, "claude", "Claude", "body {}");

        let packages =
            list_typora_theme_packages_from_roots(&[&bundled_root, &imported_root]).unwrap();

        assert_eq!(
            packages
                .iter()
                .map(|package| package.id.as_str())
                .collect::<Vec<_>>(),
            vec!["catppuccin-mocha", "claude"],
        );
        assert!(packages
            .iter()
            .all(|package| package.theme_type == "typora"));

        let _ = fs::remove_dir_all(&bundled_root);
        let _ = fs::remove_dir_all(&imported_root);
    }

    #[test]
    fn read_roots_can_load_bundled_typora_css_when_not_imported() {
        let bundled_root = unique_temp_dir("read-roots-bundled");
        let imported_root = unique_temp_dir("read-roots-imported");
        write_theme_package(
            &bundled_root,
            "catppuccin-mocha",
            "Catppuccin Mocha",
            "#write { color: var(--font-color); }",
        );

        let css = read_typora_theme_css_from_roots(
            &[&imported_root, &bundled_root],
            "catppuccin-mocha",
            "theme.css",
        )
        .unwrap();

        assert!(css.css.contains("#write { color: var(--font-color); }"));
        assert!(css.base_path.ends_with("catppuccin-mocha"));

        let _ = fs::remove_dir_all(&bundled_root);
        let _ = fs::remove_dir_all(&imported_root);
    }

    #[test]
    fn read_helper_rejects_illegal_css_file() {
        let root = unique_temp_dir("read-illegal-css");
        let err = read_typora_theme_css_from_root(&root, "theme-a", "../x.css").unwrap_err();

        assert!(err.contains("Path segment cannot"));

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn list_helper_rejects_root_package_symlink() {
        let root = unique_temp_dir("list-root-symlink");
        let target_dir = unique_temp_dir("list-root-symlink-target");
        let link_dir = root.join("theme-a");
        create_basic_theme_source(&target_dir);
        fs::write(manifest_path(&target_dir), "{}").unwrap();
        fs::create_dir_all(&root).unwrap();
        create_symlink_dir(&target_dir, &link_dir);

        let err = list_typora_theme_packages(&root).unwrap_err();

        assert!(err.contains("symlink"));

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&target_dir);
    }

    #[test]
    fn read_helper_rejects_root_package_symlink() {
        let root = unique_temp_dir("read-root-symlink-root");
        let target_dir = unique_temp_dir("read-root-symlink-target");
        let link_dir = root.join("theme-a");
        create_basic_theme_source(&target_dir);
        let package = TyporaThemePackage {
            id: "theme-a".to_string(),
            name: "Theme A".to_string(),
            theme_type: "typora".to_string(),
            base_path: target_dir.to_string_lossy().to_string(),
            variants: vec![TyporaThemeVariant {
                id: "a".to_string(),
                name: "A".to_string(),
                css_file: "a.css".to_string(),
            }],
            imported_at: "1".to_string(),
        };
        fs::write(
            manifest_path(&target_dir),
            serde_json::to_string_pretty(&package).unwrap(),
        )
        .unwrap();
        fs::create_dir_all(&root).unwrap();
        create_symlink_dir(&target_dir, &link_dir);

        let err = read_typora_theme_css_from_root(&root, "theme-a", "a.css").unwrap_err();

        assert!(err.contains("symlink"));

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&target_dir);
    }

    #[test]
    fn read_helper_appends_typora_user_css_in_runtime_order() {
        let root = unique_temp_dir("read-user-css-root");
        let theme_dir = root.join("theme-a");
        fs::create_dir_all(&theme_dir).unwrap();
        fs::write(
            theme_dir.join("claude.css"),
            "/* main */\n#write { color: black; }",
        )
        .unwrap();
        fs::write(
            theme_dir.join("base.user.css"),
            "/* base user */\n#write { color: red; }",
        )
        .unwrap();
        fs::write(
            theme_dir.join("claude.user.css"),
            "/* theme user */\n#write { color: blue; }",
        )
        .unwrap();

        let package = TyporaThemePackage {
            id: "theme-a".to_string(),
            name: "Theme A".to_string(),
            theme_type: "typora".to_string(),
            base_path: theme_dir.to_string_lossy().to_string(),
            variants: vec![TyporaThemeVariant {
                id: "claude".to_string(),
                name: "Claude".to_string(),
                css_file: "claude.css".to_string(),
            }],
            imported_at: "1".to_string(),
        };
        fs::write(
            manifest_path(&theme_dir),
            serde_json::to_string_pretty(&package).unwrap(),
        )
        .unwrap();

        let css = read_typora_theme_css_from_root(&root, "theme-a", "claude.css")
            .unwrap()
            .css;

        let main_index = css.find("/* main */").unwrap();
        let base_user_index = css.find("/* base user */").unwrap();
        let theme_user_index = css.find("/* theme user */").unwrap();

        assert!(main_index < base_user_index);
        assert!(base_user_index < theme_user_index);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn import_rejects_source_symlink() {
        let root = unique_temp_dir("import-source-symlink-root");
        let source_dir = unique_temp_dir("import-source-symlink-source");
        let target_dir = unique_temp_dir("import-source-symlink-target");
        create_basic_theme_source(&target_dir);

        #[cfg(unix)]
        std::os::unix::fs::symlink(&target_dir, &source_dir).unwrap();
        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(&target_dir, &source_dir).unwrap();

        let err = import_typora_theme_into_root(&root, &source_dir).unwrap_err();

        assert!(err.contains("symlink"));
        assert!(!root.exists() || fs::read_dir(&root).unwrap().next().is_none());

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&source_dir);
        let _ = fs::remove_dir_all(&target_dir);
    }

    #[test]
    fn import_rejects_nested_symlink_and_cleans_staging() {
        let root = unique_temp_dir("import-nested-symlink-root");
        let source_dir = unique_temp_dir("import-nested-symlink-source");
        let linked_dir = source_dir.join("nested");
        create_basic_theme_source(&source_dir);
        fs::create_dir_all(&linked_dir).unwrap();
        fs::write(linked_dir.join("inner.css"), "body {}").unwrap();

        #[cfg(unix)]
        std::os::unix::fs::symlink(&linked_dir, source_dir.join("nested-link")).unwrap();
        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(&linked_dir, source_dir.join("nested-link")).unwrap();

        let err = import_typora_theme_into_root(&root, &source_dir).unwrap_err();

        assert!(err.contains("Symlink entries are not allowed"));
        if root.exists() {
            let entries: Vec<_> = fs::read_dir(&root).unwrap().collect();
            assert!(
                entries.is_empty(),
                "staging or final directories were left behind"
            );
        }

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&source_dir);
    }
}
