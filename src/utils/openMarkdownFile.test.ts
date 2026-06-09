import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

import {
  openMarkdownFileForEditorState,
  resolveSelectedFilePath,
  shouldOpenInNewWindow,
} from './openMarkdownFile'

const editorState = vi.hoisted(() => ({
  filePath: null as string | null,
  openFile: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

vi.mock('../stores/editorStore', () => ({
  useEditorStore: {
    getState: () => editorState,
  },
}))

describe('openMarkdownFileForEditorState', () => {
  beforeEach(() => {
    editorState.filePath = null
    editorState.openFile.mockReset()
    vi.mocked(open).mockReset()
    vi.mocked(invoke).mockReset()
  })

  it('uses the current window when the initial page has no document', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/notes.md')
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'read_file') return '# Notes'
      if (command === 'get_file_name') return 'notes.md'
      throw new Error(`Unexpected command: ${command}`)
    })

    await openMarkdownFileForEditorState()

    expect(invoke).toHaveBeenCalledWith('read_file', { path: '/tmp/notes.md' })
    expect(invoke).toHaveBeenCalledWith('get_file_name', { path: '/tmp/notes.md' })
    expect(invoke).not.toHaveBeenCalledWith('create_window', { filePath: '/tmp/notes.md' })
    expect(editorState.openFile).toHaveBeenCalledWith('/tmp/notes.md', '# Notes', 'notes.md')
  })

  it('opens a new window when the current editor already has a document', async () => {
    editorState.filePath = '/tmp/current.md'
    vi.mocked(open).mockResolvedValue('/tmp/next.md')
    vi.mocked(invoke).mockResolvedValue('editor-1')

    await openMarkdownFileForEditorState()

    expect(invoke).toHaveBeenCalledWith('create_window', { filePath: '/tmp/next.md' })
    expect(invoke).not.toHaveBeenCalledWith('read_file', { path: '/tmp/next.md' })
    expect(editorState.openFile).not.toHaveBeenCalled()
  })

  it('treats a new unsaved editor as an occupied document window', () => {
    expect(shouldOpenInNewWindow('')).toBe(true)
    expect(shouldOpenInNewWindow('/tmp/current.md')).toBe(true)
    expect(shouldOpenInNewWindow(null)).toBe(false)
  })

  it('normalizes dialog selections from Tauri path objects and strings', () => {
    expect(resolveSelectedFilePath('/tmp/string.md')).toBe('/tmp/string.md')
    expect(resolveSelectedFilePath({ path: '/tmp/object.md' })).toBe('/tmp/object.md')
    expect(resolveSelectedFilePath(null)).toBeNull()
    expect(resolveSelectedFilePath([{ path: '/tmp/ignored.md' }])).toBeNull()
  })
})
