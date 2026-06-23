import { useEffect, useCallback } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { useLanguage } from '../i18n'
import { openMarkdownFileForEditorState } from '../utils/openMarkdownFile'
import { isMac } from '../utils/tauriRuntime'

type ShortcutHandler = () => void

interface ShortcutMap {
  [key: string]: ShortcutHandler
}

/**
 * 检查修饰键是否按下
 * macOS 使用 Meta (Cmd)，其他平台使用 Ctrl
 */
const isModifierPressed = (e: KeyboardEvent): boolean => {
  return isMac() ? e.metaKey : e.ctrlKey
}

/**
 * 快捷键 Hook
 * 提供全局键盘快捷键支持
 */
export const useKeyboardShortcuts = () => {
  const {
    setMode,
    toggleSidebar,
  } = useEditorStore()
  const { t } = useLanguage()

  // 新建文件 - 在当前窗口进入编辑器
  const handleNew = useCallback(() => {
    useEditorStore.getState().newFile()
  }, [])

  // 打开文件：初始页复用当前窗口；已有文档时创建新窗口。
  const handleOpen = useCallback(async () => {
    try {
      await openMarkdownFileForEditorState()
    } catch (err) {
      console.error('Failed to open file:', err)
    }
  }, [])

  // 保存文件
  const handleSave = useCallback(async () => {
    const state = useEditorStore.getState()
    if (!state.filePath) {
      await handleSaveAs()
      return
    }

    try {
      await invoke('save_file', { path: state.filePath, content: state.content })
      useEditorStore.setState({
        isModified: false,
        lastSavedContent: state.content,
      })
    } catch (err) {
      console.error('Failed to save file:', err)
    }
  }, [])

  // 另存为
  const handleSaveAs = useCallback(async () => {
    const state = useEditorStore.getState()

    try {
      const path = await save({
        filters: [
          {
            name: 'Markdown',
            extensions: ['md'],
          },
        ],
      })

      if (path) {
        await invoke('save_file', { path, content: state.content })
        const name = await invoke<string>('get_file_name', { path })
        useEditorStore.setState({
          filePath: path,
          fileName: name,
          isModified: false,
          lastSavedContent: state.content,
        })
      }
    } catch (err) {
      console.error('Failed to save file:', err)
    }
  }, [])

  // 切换编辑模式（分栏/所见即所得）
  const handleToggleMode = useCallback(() => {
    setMode(useEditorStore.getState().mode === 'wysiwyg' ? 'split' : 'wysiwyg')
  }, [setMode])

  // 应用 Markdown 格式化
  const applyFormat = useCallback((prefix: string, suffix: string) => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const selectedText = range.toString()

      if (selectedText) {
        const formattedText = `${prefix}${selectedText}${suffix}`
        range.deleteContents()
        range.insertNode(document.createTextNode(formattedText))
      }
    }
  }, [])

  // 粗体
  const handleBold = useCallback(() => {
    applyFormat('**', '**')
  }, [applyFormat])

  // 斜体
  const handleItalic = useCallback(() => {
    applyFormat('*', '*')
  }, [applyFormat])

  // 撤销
  const handleUndo = useCallback(() => {
    document.execCommand('undo')
  }, [])

  // 重做
  const handleRedo = useCallback(() => {
    document.execCommand('redo')
  }, [])

  // 快捷键映射表
  const getShortcuts = useCallback((): ShortcutMap => {
    return {
      'n': handleNew,
      'o': handleOpen,
      's': handleSave,
      'S': handleSaveAs,
      'z': handleUndo,
      'Z': handleRedo,
      'b': handleBold,
      'i': handleItalic,
      '`': toggleSidebar,
      '\\': handleToggleMode,
    }
  }, [handleNew, handleOpen, handleSave, handleSaveAs, handleUndo, handleRedo, handleBold, handleItalic, toggleSidebar, handleToggleMode])

  // 键盘事件处理
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

    if (!isModifierPressed(e)) {
      return
    }

    const key = e.key
    const hasShift = e.shiftKey
    const shortcuts = getShortcuts()

    let handler: ShortcutHandler | undefined

    if (hasShift && shortcuts[key]) {
      handler = shortcuts[key]
    } else if (!hasShift && shortcuts[key.toLowerCase()]) {
      handler = shortcuts[key.toLowerCase()]
    }

    if (!handler) {
      if (hasShift && key === '~') {
        handler = shortcuts['`']
      }
      if (key === '\\') {
        handler = shortcuts['\\']
      }
    }

    if (handler) {
      const globalKeys = ['s', 'S', 'n', 'o']
      if (isInput && !globalKeys.includes(key) && !globalKeys.includes(key.toLowerCase())) {
        return
      }

      e.preventDefault()
      e.stopPropagation()
      handler()
    }
  }, [getShortcuts])

  // 注册全局快捷键
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  // 返回快捷键信息，可用于显示快捷键提示
  return {
    isMac: isMac(),
    modifierKey: isMac() ? 'Cmd' : 'Ctrl',
    shortcuts: [
      { key: 'N', description: t('shortcuts.newFile') },
      { key: 'O', description: t('shortcuts.openFile') },
      { key: 'S', description: t('shortcuts.save') },
      { key: 'Shift + S', description: t('shortcuts.saveAs') },
      { key: 'Z', description: t('shortcuts.undo') },
      { key: 'Shift + Z', description: t('shortcuts.redo') },
      { key: 'B', description: t('shortcuts.bold') },
      { key: 'I', description: t('shortcuts.italic') },
      { key: '`', description: t('shortcuts.toggleSidebar') },
      { key: '\\', description: t('shortcuts.toggleSplitMode') },
    ],
  }
}

export default useKeyboardShortcuts
