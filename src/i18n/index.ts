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
