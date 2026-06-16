export const BUNDLED_TYPORA_CLAUDE_THEME_ID = 'typora:claude-typora-theme-v1-0-0:claude'

export function migrateLegacyThemeId(themeId: string | null | undefined): string {
  if (!themeId || themeId === 'default' || themeId === 'light') {
    return BUNDLED_TYPORA_CLAUDE_THEME_ID
  }

  return themeId
}
