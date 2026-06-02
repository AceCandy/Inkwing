import { describe, expect, it, vi } from 'vitest'
import { isTauri } from '@tauri-apps/api/core'

import { isRunningInTauri } from './tauriRuntime'

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: vi.fn(),
}))

describe('isRunningInTauri', () => {
  it('returns false when the page is running in a regular browser', () => {
    vi.mocked(isTauri).mockReturnValue(false)

    expect(isRunningInTauri()).toBe(false)
  })

  it('returns true when the Tauri runtime is available', () => {
    vi.mocked(isTauri).mockReturnValue(true)

    expect(isRunningInTauri()).toBe(true)
  })

  it('returns false when runtime detection throws', () => {
    vi.mocked(isTauri).mockImplementation(() => {
      throw new Error('missing runtime')
    })

    expect(isRunningInTauri()).toBe(false)
  })
})
