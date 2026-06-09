import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

import { useEditorStore } from '../stores/editorStore'

const MARKDOWN_FILE_FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
  { name: 'All Files', extensions: ['*'] },
]

export function resolveSelectedFilePath(selected: unknown): string | null {
  if (typeof selected === 'string') {
    return selected
  }

  if (
    selected &&
    typeof selected === 'object' &&
    !Array.isArray(selected) &&
    'path' in selected &&
    typeof selected.path === 'string'
  ) {
    return selected.path
  }

  return null
}

export function shouldOpenInNewWindow(filePath: string | null): boolean {
  return filePath !== null
}

async function selectMarkdownFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: MARKDOWN_FILE_FILTERS,
  })

  return resolveSelectedFilePath(selected)
}

export async function openMarkdownFileInCurrentWindow(filePath?: string): Promise<void> {
  const path = filePath ?? await selectMarkdownFile()
  if (!path) {
    return
  }

  // 初始页没有承载文档，直接读取并复用当前窗口，避免打开后留下一个空白窗口。
  const content = await invoke<string>('read_file', { path })
  const name = await invoke<string>('get_file_name', { path })
  useEditorStore.getState().openFile(path, content, name)
}

export async function openMarkdownFileInNewWindow(filePath?: string): Promise<void> {
  const path = filePath ?? await selectMarkdownFile()
  if (!path) {
    return
  }

  await invoke('create_window', { filePath: path })
}

export async function openMarkdownFileForEditorState(): Promise<void> {
  const path = await selectMarkdownFile()
  if (!path) {
    return
  }

  if (shouldOpenInNewWindow(useEditorStore.getState().filePath)) {
    await openMarkdownFileInNewWindow(path)
    return
  }

  await openMarkdownFileInCurrentWindow(path)
}
