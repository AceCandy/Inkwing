import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { TyporaShell } from './components/TyporaShell'
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
// 对齐 Typora base-control.css 的默认 --sidebar-width:270px，避免侧栏宽度与 Typora 不一致。
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

// 字数统计：逐字复刻 Typora main.js 的口径，不自己编算法。
//   - 字数：CJK 逐字（\u3040-\uABFF、\uD7A4-\uFAFF 范围每个字符算一词）+ 剩余文本按
//     标点/空白拆词，撇号连字（'s 'll 're）按一词。对应 main.js 的 s=function(e){...}。
//   - 字符数：getMarkdown().length（原始 markdown 长度，不 trim）。
//   - 行数：getMarkdown().split(/\n/g).length。
//   - 阅读时间：Math.round(wordCount / File.option.wordsPerMinute)，默认 wordsPerMinute=382。
const TYPORA_WORDS_PER_MINUTE = 382

function countTyporaWords(markdown: string): { words: number; characters: number; lines: number; minutes: number } {
  // === 字数（CJK 逐字 + 标点拆词），逐字取自 main.js 的 s= 函数 ===
  let cjkCount = 0
  const withoutCjk = markdown.replace(/[\u3040-\uABFF\uD7A4-\uFAFF]/gi, () => {
    cjkCount += 1
    return ' '
  })
  // 撇号连字（'s 'll 're 've 'd 'm）视为一词
  const withoutApostrophes = withoutCjk.replace(/['’]\w+/g, 'b')
  // 行首/空白后的标点（含全角符号 \u3000-\u303F、半角 !-/ :-@ [-` {-~）当分隔
  const dePunctuated = withoutApostrophes.replace(/(^|\s+)[(\u3000-\u303F)!-/:-@[-`{-~]+(\s+|$)/gm, ' ')
  const tokens = ['d', dePunctuated, 'd'].join(' ').split(/[(\u3000-\u303F)\s!-,\\:-@[-`{-~]+/g)
  const words = cjkCount + tokens.length - 2

  // === 字符数：原始 markdown 长度（main.js updateCharCount: e.length）===
  const characters = markdown.length
  // === 行数：按 \n 拆（main.js updateLineCount: split(/\n/g).length）===
  const lines = markdown.split(/\n/g).length
  // === 阅读时间（main.js updateReadTime: Math.round(words / wordsPerMinute)）===
  const minutes = Math.round(words / TYPORA_WORDS_PER_MINUTE)

  return { words, characters, lines, minutes }
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
    fileName,
    content,
    isModified,
  } = useEditorStore()

  // 对齐 Typora：右下角统计区实时显示总字数；hover 展开明细面板（行数/字符/分钟）。
  // main.js 的 updateWordCount 把 #footer-word-count-label 文本设为 "N Words"，
  // #footer-word-count-td 等单元格在 #footer-word-count-info 面板里。本项目无 Typora
  // 的 selection 计数，只展示全文字数。
  const wordCount = useMemo(() => countTyporaWords(content), [content])

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
  const isSidebarResizing = useRef(false)

  // 注册全局快捷键
  useKeyboardShortcuts()

  // 启用自动保存
  useAutoSave()

  // --sidebar-width 挂在 :root/body（对齐 Typora base.css 的 :root 定义）。
  // Typora window.css 的 #typora-sidebar { width: var(--sidebar-width) } 据此计算宽度。
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
      if (!isSidebarResizing.current) return

      // 侧栏在窗口左侧，宽度 = 鼠标 X 相对于 #typora-sidebar 左边的距离。
      const sidebar = document.getElementById('typora-sidebar')
      const sidebarLeft = sidebar?.getBoundingClientRect().left ?? 0
      setSidebarWidth(clampSidebarWidth(e.clientX - sidebarLeft))
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
    <>
      {/* TyporaShell：通过 portal 把大纲/文件树/搜索结果/file-info 塞进已注入 body 的
          Typora 骨架节点，并切换骨架节点的交互态 class。骨架本身（#typora-sidebar 等）
          由 main.tsx 的 mountTyporaSkeleton 注入，不在这里渲染。 */}
      <TyporaShell />

      {/* sidebar-resizer：骨架已含 #typora-sidebar-resizer 的 DOM（Typora 原生 id），
          但拖拽交互由本项目接管（Typora 用 native resize）。这里只挂事件，不重复渲染 DOM。 */}
      <SidebarResizerBridge
        active={isSidebarResizeActive}
        sidebarWidth={sidebarWidth}
        onMouseDown={handleSidebarResizeMouseDown}
        onKeyDown={handleSidebarResizeKeyDown}
      />

      {/*
        macOS 形态顶部条（seamless 模式）：
        Typora 在 macOS 用原生 Cocoa 标题栏渲染文件名/字数（bridge.callHandler），
        左上系统红绿灯由 macOS 渲染。本项目用 Tauri，只在 28px 标题栏区域自渲染轻量覆盖层。
        正文 <content> 的 top 由 Typora window.css 提供。
        data-tauri-drag-region 让整条可拖拽移动窗口（Tauri 等价 -webkit-app-region:drag）。
      */}
      <div
        className="mac-titlebar-overlay inkwing-chrome"
        data-tauri-drag-region="true"
        aria-hidden="true"
      >
        <span
          className={`mac-titlebar-filename${isModified ? ' mac-titlebar-filename-modified' : ''}`}
        >
          {fileName || 'Untitled'}
        </span>
        <span className="mac-titlebar-wordcount">{wordCount.words} Words</span>
      </div>

      <content>
        <MilkdownEditor />
      </content>

      {showSettings && <SettingsModal />}
    </>
  )
}

export default App

// sidebar-resizer 桥接层：骨架已注入 #typora-sidebar-resizer 的 DOM（Typora 原生 id，
// 带子节点 .typora-sidebar-resizer-bar）。Typora 用 native resize，本项目用 HTML 拖拽接管。
// 这里不重新渲染 DOM，只通过 effect 把 React 的事件处理绑定到骨架节点上，保留 Typora
// window.css 对 #typora-sidebar-resizer 的原生布局规则。
type SidebarResizerBridgeProps = {
  active: boolean
  sidebarWidth: number
  onMouseDown: (e: React.MouseEvent) => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

const SidebarResizerBridge: React.FC<SidebarResizerBridgeProps> = ({
  active,
  sidebarWidth,
  onMouseDown,
  onKeyDown,
}) => {
  useEffect(() => {
    const resizer = document.getElementById('typora-sidebar-resizer')
    if (!resizer) return

    resizer.setAttribute('role', 'separator')
    resizer.setAttribute('aria-orientation', 'vertical')
    resizer.setAttribute('tabindex', '0')
    resizer.setAttribute('aria-valuemin', String(MIN_SIDEBAR_WIDTH))
    resizer.setAttribute('aria-valuemax', String(MAX_SIDEBAR_WIDTH))
    resizer.setAttribute('aria-valuenow', String(sidebarWidth))
    resizer.classList.toggle('dragging', active)

    const handleNativeMouseDown = (event: MouseEvent) => {
      onMouseDown(event as unknown as React.MouseEvent)
    }
    const handleNativeKeyDown = (event: KeyboardEvent) => {
      onKeyDown(event as unknown as React.KeyboardEvent)
    }

    resizer.addEventListener('mousedown', handleNativeMouseDown)
    resizer.addEventListener('keydown', handleNativeKeyDown)

    return () => {
      resizer.removeEventListener('mousedown', handleNativeMouseDown)
      resizer.removeEventListener('keydown', handleNativeKeyDown)
    }
  }, [active, sidebarWidth, onMouseDown, onKeyDown])

  return null
}
