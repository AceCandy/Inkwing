import { useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '../stores/editorStore'

const DEBOUNCE_DELAY = 2000

export function useAutoSave() {
  const {
    autoSaveEnabled,
    filePath,
    content,
    lastSavedContent,
    setIsSaving,
  } = useEditorStore()

  // 使用 ref 追踪最新的 content 和 lastSavedContent，避免闭包问题
  const contentRef = useRef(content)
  const lastSavedRef = useRef(lastSavedContent)
  contentRef.current = content
  lastSavedRef.current = lastSavedContent

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const performSave = useCallback(async () => {
    if (!filePath) return
    if (contentRef.current === lastSavedRef.current) return

    setIsSaving(true)
    try {
      await invoke('save_file', {
        path: filePath,
        content: contentRef.current,
      })
      useEditorStore.setState({
        lastSavedContent: contentRef.current,
        isModified: false,
      })
    } catch (err) {
      console.error('Auto-save failed:', err)
    } finally {
      setIsSaving(false)
    }
  }, [filePath, setIsSaving])

  useEffect(() => {
    if (!autoSaveEnabled || !filePath) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    if (content === lastSavedContent) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(() => {
      performSave()
      timerRef.current = null
    }, DEBOUNCE_DELAY)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  })

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])
}

export default useAutoSave
