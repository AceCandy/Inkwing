import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { Sidebar } from './components/Sidebar'
import { MilkdownEditor } from './components/Editor'
import { SettingsModal } from './components/SettingsModal'
import { useEditorStore } from './stores/editorStore'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useAutoSave } from './hooks/useAutoSave'
import { applyThemeOption, getThemeOption, refreshExternalThemes } from './themes'
import { isRunningInTauri } from './utils/tauriRuntime'
import { openMarkdownFileForEditorState } from './utils/openMarkdownFile'
import './App.css'

export const SIDEBAR_WIDTH_STORAGE_KEY = 'app-sidebar-width'
export const DEFAULT_SIDEBAR_WIDTH = 245
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

    const parsedWidth = Number(storedWidth)
    return clampSidebarWidth(parsedWidth)
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
    showSettings,
    newFile,
    openFile,
    setShowSettings,
    showSidebar,
    currentTheme,
    setThemeError,
  } = useEditorStore()

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

  // 侧栏宽度需要同步给 Typora 主题变量，保证导入主题和拖拽行为使用同一套尺寸。
  const [sidebarWidth, setSidebarWidth] = useState(() => getInitialSidebarWidth())
  const [isSidebarResizeActive, setIsSidebarResizeActive] = useState(false)
  const appBodyRef = useRef<HTMLDivElement>(null)
  const isSidebarResizing = useRef(false)

  // 注册全局快捷键
  useKeyboardShortcuts()

  // 启用自动保存
  useAutoSave()

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
            await openMarkdownFileForEditorState()
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

  return (
    <div className="app">
      <div
        className={`app-body ${!showSidebar ? 'without-sidebar' : ''}`}
        ref={appBodyRef}
        style={sidebarLayoutStyle}
      >
        {showSidebar && (
          <>
            <div className="sidebar-header-drag" data-tauri-drag-region="true" />
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
          </>
        )}
        <titlebar data-tauri-drag-region="true" />
        <content>
          <MilkdownEditor />
        </content>
      </div>
      {showSettings && <SettingsModal />}
    </div>
  )
}

export default App
