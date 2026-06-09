export const BUNDLED_TYPORA_DARK_THEME_ID = 'typora:catppuccin-mocha:theme'
export const BUNDLED_TYPORA_LIGHT_THEME_ID = 'typora:catppuccin-latte:theme'

export function migrateLegacyThemeId(themeId: string | null | undefined): string {
  if (themeId === 'light') {
    return BUNDLED_TYPORA_LIGHT_THEME_ID
  }

  if (!themeId || themeId === 'default') {
    return BUNDLED_TYPORA_DARK_THEME_ID
  }

  return themeId
}
