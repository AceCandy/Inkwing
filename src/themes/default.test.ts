import { describe, expect, it } from 'vitest'

import { defaultLightTheme, defaultTheme, themeToCSSVariables } from './default'
import { BUNDLED_TYPORA_CLAUDE_THEME_ID } from './typora/bundled'

describe('legacy default theme shim', () => {
  it('points old default imports at the bundled Claude Typora theme without CSS fallbacks', () => {
    expect(defaultTheme.id).toBe(BUNDLED_TYPORA_CLAUDE_THEME_ID)
    expect(defaultLightTheme).toBe(defaultTheme)
    expect(themeToCSSVariables(defaultTheme)).toBe('')
  })
})
