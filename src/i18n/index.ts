import { useState, useCallback } from 'react'

// 翻译字典类型
type Translations = Record<string, string | Record<string, string>>

// 翻译字典
const translations: Record<string, Translations> = {
  zh: {
    // 欢迎页
    'welcome.title': '墨羽',
    'welcome.subtitle': 'Markdown 编辑器',
    'welcome.newFile': '新建文件',
    'welcome.openFile': '打开文件',
    'welcome.shortcutNew': '⌘N 新建',
    'welcome.shortcutOpen': '⌘O 打开',
    'welcome.shortcutSave': '⌘S 保存',

    // 状态栏
    'status.modified': '● 已修改',
    'status.saved': '已保存',

    // 编辑器区域
    'editor.title': '编辑器',
    'preview.title': '预览',

    // 侧边栏
    'sidebar.title': '文档大纲',
    'sidebar.empty': '未找到标题',

    // 设置页面
    'settings.title': '设置',
    'settings.interface': '界面',
    'settings.shortcuts': '快捷键',
    'settings.language': '语言',
    'settings.theme': '主题',
    'settings.importTyporaTheme': '导入 Typora 主题文件夹',
    'settings.importingTheme': '导入中...',
    'settings.importThemeSuccess': 'Typora 主题导入成功',

    // 快捷键
    'shortcuts.newFile': '新建文件',
    'shortcuts.openFile': '打开文件',
    'shortcuts.save': '保存',
    'shortcuts.saveAs': '另存为',
    'shortcuts.undo': '撤销',
    'shortcuts.redo': '重做',
    'shortcuts.bold': '粗体',
    'shortcuts.italic': '斜体',
    'shortcuts.toggleSidebar': '切换侧边栏',
    'shortcuts.toggleSplitMode': '切换分栏模式',

    // 底部 footer 字数统计（Windows 形态）
    'footer.words': '字数',
    'footer.characters': '字符',
    'footer.lines': '行数',
    'footer.readTime': '阅读时间（分钟）',
    'footer.wordsUnit': '字',  // 「N 字」单位
    'footer.spellCheck': '中文',

    // 文件信息面板（侧栏 file-info）
    'fileInfo.untitled': '未命名',
    'fileInfo.modified': '已修改',
    'fileInfo.saved': '已保存',
    'fileInfo.unsavedChanges': '有未保存的修改',
    'fileInfo.allSaved': '所有修改已保存',
    'fileInfo.newDocument': '这是一个新文档',
    'fileInfo.saveNow': '立即保存',
    'fileInfo.content': '内容',
    'fileInfo.minutes': '分钟',
    'fileInfo.words': '字',
    'fileInfo.characters': '字符',

    // 侧栏 tab 标题
    'sidebar.outline': '大纲',
    'sidebar.files': '文件',
    'sidebar.search': '搜索',
  },
  en: {
    // Welcome page
    'welcome.title': 'Inkwing',
    'welcome.subtitle': 'Markdown Editor',
    'welcome.newFile': 'New File',
    'welcome.openFile': 'Open File',
    'welcome.shortcutNew': '⌘N New',
    'welcome.shortcutOpen': '⌘O Open',
    'welcome.shortcutSave': '⌘S Save',

    // Status bar
    'status.modified': '● Modified',
    'status.saved': 'Saved',

    // Editor area
    'editor.title': 'Editor',
    'preview.title': 'Preview',

    // Sidebar
    'sidebar.title': 'Document Outline',
    'sidebar.empty': 'No headings found',

    // Settings page
    'settings.title': 'Settings',
    'settings.interface': 'Interface',
    'settings.shortcuts': 'Shortcuts',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.importTyporaTheme': 'Import Typora Theme Folder',
    'settings.importingTheme': 'Importing...',
    'settings.importThemeSuccess': 'Typora theme imported successfully',

    // Shortcuts
    'shortcuts.newFile': 'New File',
    'shortcuts.openFile': 'Open File',
    'shortcuts.save': 'Save',
    'shortcuts.saveAs': 'Save As',
    'shortcuts.undo': 'Undo',
    'shortcuts.redo': 'Redo',
    'shortcuts.bold': 'Bold',
    'shortcuts.italic': 'Italic',
    'shortcuts.toggleSidebar': 'Toggle Sidebar',
    'shortcuts.toggleSplitMode': 'Toggle Split Mode',

    // Bottom footer word count (Windows form)
    'footer.words': 'Words',
    'footer.characters': 'Characters',
    'footer.lines': 'Lines',
    'footer.readTime': 'Read Time (min)',
    'footer.wordsUnit': 'Words',
    'footer.spellCheck': 'English',

    // File info panel (sidebar file-info)
    'fileInfo.untitled': 'Untitled',
    'fileInfo.modified': 'Modified',
    'fileInfo.saved': 'Saved',
    'fileInfo.unsavedChanges': 'Unsaved Changes',
    'fileInfo.allSaved': 'All Changes Saved',
    'fileInfo.newDocument': 'This is a New Document',
    'fileInfo.saveNow': 'Save Now',
    'fileInfo.content': 'Content',
    'fileInfo.minutes': 'minutes',
    'fileInfo.words': 'words',
    'fileInfo.characters': 'characters',

    // Sidebar tab titles
    'sidebar.outline': 'Outline',
    'sidebar.files': 'Files',
    'sidebar.search': 'Search',
  },
}

// 获取当前语言
export function getLanguage(): string {
  return localStorage.getItem('app-language') || 'zh'
}

// 设置语言
export function setLanguage(lang: string): void {
  localStorage.setItem('app-language', lang)
}

// 翻译函数
export function t(key: string): string {
  const lang = getLanguage()
  const dict = translations[lang] || translations.zh
  return (dict[key] as string) || key
}

// React Hook: 使用语言
export function useLanguage() {
  const [language, setCurrentLanguage] = useState<string>(getLanguage)

  const changeLanguage = useCallback((lang: string) => {
    setLanguage(lang)
    setCurrentLanguage(lang)
  }, [])

  const translate = useCallback((key: string) => {
    return t(key)
  }, [language])

  return {
    language,
    changeLanguage,
    t: translate,
  }
}
