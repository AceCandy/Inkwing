import { create } from 'zustand'

export type EditorMode = 'wysiwyg' | 'split'

const APP_THEME_STORAGE_KEY = 'app-theme'

function getStoredTheme(): string {
  try {
    return localStorage.getItem(APP_THEME_STORAGE_KEY) || 'default'
  } catch {
    return 'default'
  }
}

function persistTheme(theme: string) {
  try {
    localStorage.setItem(APP_THEME_STORAGE_KEY, theme)
  } catch {
    // localStorage 不可用时只保留当前运行态，避免阻断编辑器使用。
  }
}

interface EditorState {
  // 单文档状态
  filePath: string | null
  fileName: string
  content: string
  isModified: boolean
  lastSavedContent: string

  // 编辑器状态
  mode: EditorMode
  showSidebar: boolean
  showLineNumbers: boolean

  // 主题
  currentTheme: string
  themeError: string | null

  // 设置弹窗
  showSettings: boolean

  // 自动保存
  autoSaveEnabled: boolean
  isSaving: boolean

  // Actions
  newFile: () => void
  openFile: (path: string, content: string, name: string) => void
  setContent: (content: string) => void
  setModified: (modified: boolean) => void
  setFilePath: (path: string) => void
  setFileName: (name: string) => void
  resetDocument: () => void

  setMode: (mode: EditorMode) => void
  toggleSidebar: () => void
  toggleLineNumbers: () => void
  setTheme: (theme: string) => void
  setThemeError: (error: string | null) => void
  setAutoSaveEnabled: (enabled: boolean) => void
  setIsSaving: (saving: boolean) => void
  setShowSettings: (show: boolean) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  // 初始状态
  filePath: null,
  fileName: 'Untitled',
  content: '',
  isModified: false,
  lastSavedContent: '',

  mode: 'wysiwyg',
  showSidebar: true,
  showLineNumbers: true,

  currentTheme: getStoredTheme(),
  themeError: null,

  showSettings: false,

  autoSaveEnabled: true,
  isSaving: false,

  // 新建文件（在当前窗口进入编辑器）
  newFile: () => set({
    filePath: '',
    fileName: 'Untitled',
    content: '',
    isModified: false,
    lastSavedContent: '',
  }),

  // 打开文件
  openFile: (path, content, name) => set({
    filePath: path,
    fileName: name,
    content,
    lastSavedContent: content,
    isModified: false,
  }),

  // 更新内容
  setContent: (content) => set((state) => ({
    content,
    isModified: content !== state.lastSavedContent,
  })),

  // 设置修改状态
  setModified: (isModified) => set({ isModified }),

  // 设置文件路径
  setFilePath: (filePath) => set({ filePath }),

  // 设置文件名
  setFileName: (fileName) => set({ fileName }),

  // 重置文档状态
  resetDocument: () => set({
    filePath: null,
    fileName: 'Untitled',
    content: '',
    isModified: false,
    lastSavedContent: '',
  }),

  // 编辑器 Actions
  setMode: (mode) => set({ mode }),
  toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),
  toggleLineNumbers: () => set((state) => ({ showLineNumbers: !state.showLineNumbers })),
  setTheme: (theme) => {
    persistTheme(theme)
    set({ currentTheme: theme })
  },
  setThemeError: (themeError) => set({ themeError }),
  setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
  setIsSaving: (saving) => set({ isSaving: saving }),
  setShowSettings: (show) => set({ showSettings: show }),
}))
