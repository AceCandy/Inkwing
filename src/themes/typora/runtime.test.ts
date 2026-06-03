import { describe, expect, it } from 'vitest'

import { getTyporaRuntimeBodyClasses, getTyporaRuntimeShellVariables } from './runtime'

describe('getTyporaRuntimeBodyClasses', () => {
  it('adds Typora-compatible macOS outline body classes', () => {
    expect(getTyporaRuntimeBodyClasses('MacIntel', 'Mozilla/5.0 (Macintosh)')).toEqual([
      'typora-theme-scope',
      'mac-os',
      'active-tab-outline',
    ])
  })

  it('adds Typora-compatible Windows outline body classes', () => {
    expect(getTyporaRuntimeBodyClasses('Win32', 'Mozilla/5.0 (Windows NT 10.0)')).toEqual([
      'typora-theme-scope',
      'os-windows',
      'active-tab-outline',
    ])
  })
})

describe('getTyporaRuntimeShellVariables', () => {
  it('provides Typora shell variables that imported themes expect from the host app', () => {
    expect(getTyporaRuntimeShellVariables()).toEqual(
      expect.objectContaining({
        '--sidebar-width': '325px',
        '--title-bar-height': '78px',
      }),
    )
  })
})
