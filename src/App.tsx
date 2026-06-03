import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { Sidebar } from './components/Sidebar'
import { MilkdownEditor } from './components/Editor'
import { Preview } from './components/Preview'
import { SettingsModal } from './components/SettingsModal'
import { useEditorStore } from './stores/editorStore'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { listen } from '@tauri-apps/api/event'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useAutoSave } from './hooks/useAutoSave'
import { useLanguage } from './i18n'
import { applyThemeOption, getThemeOption, refreshExternalThemes } from './themes'
import { isRunningInTauri } from './utils/tauriRuntime'
import { useAppLogo } from './hooks/useAppLogo'
import './App.css'

export const SIDEBAR_WIDTH_STORAGE_KEY = 'app-sidebar-width'
export const DEFAULT_SIDEBAR_WIDTH = 270
export const MIN_SIDEBAR_WIDTH = 180
export const MAX_SIDEBAR_WIDTH = 520

export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return DEFAULT_SIDEBAR_WIDTH
  }

  return Math.round(Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width)))
}

function getSidebarStorage(): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function getInitialSidebarWidth(storage = getSidebarStorage()): number {
  try {
    const storedWidth = storage?.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
    if (!storedWidth) {
      return DEFAULT_SIDEBAR_WIDTH
    }

    return clampSidebarWidth(Number(storedWidth))
  } catch {
    return DEFAULT_SIDEBAR_WIDTH
  }
}

function persistSidebarWidth(width: number) {
  const storage = getSidebarStorage()
  try {
    storage?.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clampSidebarWidth(width)))
  } catch {
    // localStorage 可能在受限 WebView 中不可用，宽度拖拽本身不应因此中断。
  }
}

function App() {
  const {
    filePath,
    fileName,
    content,
    isModified,
    mode,
    showSettings,
    newFile,
    openFile,
    setShowSettings,
    showSidebar,
    currentTheme,
    setThemeError,
  } = useEditorStore()

  const appLogo = useAppLogo()

  useEffect(() => {
    let cancelled = false

    const syncTheme = async () => {
      try {
        await refreshExternalThemes()
        await applyThemeOption(getThemeOption(currentTheme))
        if (!cancelled) {
          setThemeError(null)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err)
          setThemeError(message)
        }
      }
    }

    syncTheme()

    return () => {
      cancelled = true
    }
  }, [currentTheme, setThemeError])

  const { t } = useLanguage()

  const [isEditingName, setIsEditingName] = useState(false)
  const [tempFileName, setTempFileName] = useState(fileName)

  // 右上角字数/阅读时间等统计显示状态
  const [activeStat, setActiveStat] = useState<'words' | 'chars' | 'lines' | 'readTime'>('words')
  const [showStatMenu, setShowStatMenu] = useState(false)

  // 侧栏宽度需要同步给 Typora 主题变量，保证导入主题和拖拽行为使用同一套尺寸。
  const [sidebarWidth, setSidebarWidth] = useState(() => getInitialSidebarWidth())
  const [isSidebarResizeActive, setIsSidebarResizeActive] = useState(false)
  const appBodyRef = useRef<HTMLDivElement>(null)
  const isSidebarResizing = useRef(false)

  useEffect(() => {
    setTempFileName(fileName)
  }, [fileName])

  // 重命名文件
  const handleRename = useCallback(async () => {
    setIsEditingName(false)
    const trimmed = tempFileName.trim()
    if (!trimmed || trimmed === fileName) {
      setTempFileName(fileName)
      return
    }

    let newName = trimmed
    if (!newName.endsWith('.md') && !newName.endsWith('.markdown')) {
      newName += '.md'
    }

    if (filePath) {
      try {
        const newPath = await invoke<string>('rename_file', {
          oldPath: filePath,
          newName: newName,
        })
        useEditorStore.setState({
          filePath: newPath,
          fileName: newName,
          isModified: false,
        })
      } catch (err) {
        console.error('Rename failed:', err)
        setTempFileName(fileName)
      }
    } else {
      useEditorStore.setState({
        fileName: newName,
      })
    }
  }, [filePath, fileName, tempFileName])

  // 综合计算中文字数 + 英文单词数（排除 Markdown 链接地址和标点符号，对齐 Typora）
  const wordCount = useMemo(() => {
    if (!content) return 0
    // 1. 提取所有中文汉字
    const chineseChars = content.match(/[\u4e00-\u9fa5]/g) || []

    // 2. 清洗文本：移除 Markdown 链接中的 URL 路径 (只保留链接文本)，移除图片标记
    const cleanText = content
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // 移除图片
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 移除链接 URL 路径，只留文本内容

    // 3. 将中文替换为空格，只匹配英文单词
    const noChineseText = cleanText.replace(/[\u4e00-\u9fa5]/g, ' ')
    // 匹配由英文字母或数字构成的真实英文单词
    const englishWords = noChineseText.match(/[a-zA-Z0-9]+(?:'[a-zA-Z0-9]+)?/g) || []

    return chineseChars.length + englishWords.length
  }, [content])

  // 字符数统计
  const charsCount = useMemo(() => {
    return content ? content.length : 0
  }, [content])

  // 行数统计
  const linesCount = useMemo(() => {
    if (!content) return 0
    return content.split('\n').length
  }, [content])

  // 预计阅读时间（按 350 词/分钟估算，基于词数 wordCount 而非字符数 charsCount）
  const readTimeMinutes = useMemo(() => {
    if (wordCount === 0) return 0
    // 中英文混合平均阅读速度约为 350 词/分钟。
    const mins = Math.ceil(wordCount / 350)
    return Math.max(1, mins)
  }, [wordCount])

  // 获取统计显示文本
  const getStatDisplay = useCallback(() => {
    switch (activeStat) {
      case 'readTime':
        return `${readTimeMinutes} 分钟`
      case 'lines':
        return `${linesCount} 行`
      case 'words':
        return `${wordCount} 词`
      case 'chars':
        return `${charsCount} 字符`
    }
  }, [activeStat, readTimeMinutes, linesCount, wordCount, charsCount])

  // 注册全局快捷键
  useKeyboardShortcuts()

  // 启用自动保存
  useAutoSave()

  const hasFile = filePath !== null

  const sidebarLayoutStyle = useMemo(() => ({
    '--sidebar-width': `${sidebarWidth}px`,
  }) as React.CSSProperties, [sidebarWidth])

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`)
    document.body.style.setProperty('--sidebar-width', `${sidebarWidth}px`)
    persistSidebarWidth(sidebarWidth)

    return () => {
      document.documentElement.style.removeProperty('--sidebar-width')
      document.body.style.removeProperty('--sidebar-width')
    }
  }, [sidebarWidth])

  // 解析 URL 参数，加载文件
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fileParam = params.get('file')
    if (fileParam) {
      invoke<string>('read_file', { path: fileParam })
        .then(async (fileContent) => {
          const name = await invoke<string>('get_file_name', { path: fileParam })
          openFile(fileParam, fileContent, name)
        })
        .catch((err) => console.error('Failed to load file from URL:', err))
    }
  }, [openFile])

  // 监听菜单事件
  useEffect(() => {
    if (!isRunningInTauri()) {
      return
    }

    const unlisten = listen('menu-action', async (event) => {
      const action = event.payload as string

      switch (action) {
        case 'new-file':
          newFile()
          break
        case 'open-file':
          try {
            const selected = await open({
              multiple: false,
              filters: [
                { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
                { name: 'All Files', extensions: ['*'] },
              ],
            })
            if (selected) {
              const path = typeof selected === 'string' ? selected : (selected as { path: string }).path
              await invoke('create_window', { filePath: path })
            }
          } catch (err) {
            console.error('Failed to open file:', err)
          }
          break
        case 'save':
          // 由快捷键 hook 处理
          break
        case 'save-as':
          // 由快捷键 hook 处理
          break
        case 'open-settings':
          setShowSettings(true)
          break
      }
    }).catch((err) => {
      console.error('Failed to listen menu action:', err)
      return undefined
    })

    return () => {
      unlisten.then((fn) => fn?.()).catch((err) => {
        console.error('Failed to cleanup menu listener:', err)
      })
    }
  }, [setShowSettings, newFile])

  // 欢迎页打开文件
  const handleWelcomeOpen = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      })
      if (selected) {
        const path = typeof selected === 'string' ? selected : (selected as { path: string }).path
        await invoke('create_window', { filePath: path })
      }
    } catch (err) {
      console.error('Failed to open file:', err)
    }
  }

  // 分栏拖拽
  const splitViewRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const handleSidebarResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isSidebarResizing.current = true
    setIsSidebarResizeActive(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const handleSidebarResizeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
      return
    }

    e.preventDefault()
    const delta = e.key === 'ArrowRight' ? 12 : -12
    setSidebarWidth((currentWidth) => clampSidebarWidth(currentWidth + delta))
  }, [])

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !splitViewRef.current) return
      const rect = splitViewRef.current.getBoundingClientRect()
      const ratio = (e.clientX - rect.left) / rect.width
      const clamped = Math.max(0.2, Math.min(0.8, ratio))
      const panes = splitViewRef.current.querySelectorAll('.split-pane') as NodeListOf<HTMLElement>
      if (panes.length === 2) {
        panes[0].style.flex = `${clamped}`
        panes[1].style.flex = `${1 - clamped}`
      }
    }
    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isSidebarResizing.current || !appBodyRef.current) return

      const rect = appBodyRef.current.getBoundingClientRect()
      setSidebarWidth(clampSidebarWidth(e.clientX - rect.left))
    }

    const handleMouseUp = () => {
      if (isSidebarResizing.current) {
        isSidebarResizing.current = false
        setIsSidebarResizeActive(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // 无文件时：清爽欢迎页
  if (!hasFile) {
    return (
      <div className="app">
        <main className="editor-area">
          <div className="welcome-screen">
            <div className="welcome-content">
              <img src={appLogo} alt="Inkwing" className="welcome-logo" />
              <h1 className="welcome-title">{t('welcome.title')}</h1>
              <p className="welcome-subtitle">{t('welcome.subtitle')}</p>
              <div className="welcome-actions">
                <button className="welcome-btn primary" onClick={newFile}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  {t('welcome.newFile')}
                </button>
                <button className="welcome-btn" onClick={handleWelcomeOpen}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  {t('welcome.openFile')}
                </button>
              </div>
              <div className="welcome-shortcuts">
                <span>{t('welcome.shortcutNew')}</span>
                <span>{t('welcome.shortcutOpen')}</span>
                <span>{t('welcome.shortcutSave')}</span>
              </div>
            </div>
          </div>
        </main>
        {showSettings && <SettingsModal />}
      </div>
    )
  }

  return (
    <div className="app">
      <div className="app-body" ref={appBodyRef}>
        {showSidebar && (
          <div className="sidebar-layout" style={sidebarLayoutStyle}>
            <Sidebar />
            <div
              id="typora-sidebar-resizer"
              className={`sidebar-resizer ${isSidebarResizeActive ? 'dragging' : ''}`}
              role="separator"
              aria-orientation="vertical"
              aria-valuemin={MIN_SIDEBAR_WIDTH}
              aria-valuemax={MAX_SIDEBAR_WIDTH}
              aria-valuenow={sidebarWidth}
              tabIndex={0}
              onMouseDown={handleSidebarResizeMouseDown}
              onKeyDown={handleSidebarResizeKeyDown}
            >
              <div className="typora-sidebar-resizer-bar" />
            </div>
          </div>
        )}
        <main className="editor-area">
          {/* 顶部标题栏/字数统计（Typora 风格） */}
          <div className={`editor-header-bar ${!showSidebar ? 'has-native-buttons' : ''}`} data-tauri-drag-region="true">
            <div
              className="header-center"
              style={{
                left: showSidebar ? `calc(50% - ${sidebarWidth / 2}px)` : '50%'
              }}
            >
              {isEditingName ? (
                <input
                  className="header-filename-input"
                  value={tempFileName}
                  onChange={(e) => setTempFileName(e.target.value)}
                  onBlur={handleRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename()
                    if (e.key === 'Escape') {
                      setIsEditingName(false)
                      setTempFileName(fileName)
                    }
                  }}
                  autoFocus
                />
              ) : (
                <div className="header-filename-display" onClick={() => setIsEditingName(true)}>
                  <svg className="header-file-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="header-filename-text">{fileName}</span>
                  {isModified && <span className="header-modified-dot" title="未保存" />}
                </div>
              )}
            </div>
            <div className="header-right">
              <div className="header-stat-container">
                <div className="header-stat-trigger" onClick={() => setShowStatMenu(!showStatMenu)} title="选择统计指标">
                  <span>{getStatDisplay()}</span>
                  <svg className="header-stat-arrow" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                {showStatMenu && (
                  <>
                    <div className="header-stat-overlay" onClick={() => setShowStatMenu(false)} />
                    <ul className="header-stat-dropdown">
                      <li
                        className={`dropdown-item ${activeStat === 'readTime' ? 'active' : ''}`}
                        onClick={() => { setActiveStat('readTime'); setShowStatMenu(false); }}
                      >
                        {activeStat === 'readTime' && <span className="check-icon">✓</span>}
                        <span>{readTimeMinutes} 分钟</span>
                      </li>
                      <li
                        className={`dropdown-item ${activeStat === 'lines' ? 'active' : ''}`}
                        onClick={() => { setActiveStat('lines'); setShowStatMenu(false); }}
                      >
                        {activeStat === 'lines' && <span className="check-icon">✓</span>}
                        <span>{linesCount} 行</span>
                      </li>
                      <li
                        className={`dropdown-item ${activeStat === 'words' ? 'active' : ''}`}
                        onClick={() => { setActiveStat('words'); setShowStatMenu(false); }}
                      >
                        {activeStat === 'words' && <span className="check-icon">✓</span>}
                        <span>{wordCount} 词</span>
                      </li>
                      <li
                        className={`dropdown-item ${activeStat === 'chars' ? 'active' : ''}`}
                        onClick={() => { setActiveStat('chars'); setShowStatMenu(false); }}
                      >
                        {activeStat === 'chars' && <span className="check-icon">✓</span>}
                        <span>{charsCount} 字符</span>
                      </li>
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>

          {mode === 'wysiwyg' ? (
            <MilkdownEditor />
          ) : (
            <div className="split-view" ref={splitViewRef}>
              <div className="split-pane">
                <div className="pane-header">
                  <span>{t('editor.title')}</span>
                </div>
                <MilkdownEditor />
              </div>
              <div className="split-divider" onMouseDown={handleDividerMouseDown} />
              <div className="split-pane">
                <div className="pane-header">
                  <span>{t('preview.title')}</span>
                </div>
                <Preview />
              </div>
            </div>
          )}
        </main>
      </div>
      {showSettings && <SettingsModal />}
    </div>
  )
}

export default App
