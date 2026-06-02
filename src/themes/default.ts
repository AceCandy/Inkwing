// 默认主题定义
export const defaultTheme = {
  id: 'default',
  name: 'Default Dark',
  description: 'A clean dark theme for comfortable editing',
  colors: {
    // 编辑器背景
    editorBg: '#1e1e2e',
    editorBgSecondary: '#181825',

    // 预览区背景
    previewBg: '#1e1e2e',

    // 文本颜色
    textPrimary: '#cdd6f4',
    textSecondary: '#a6adc8',
    textMuted: '#6c7086',

    // 强调色
    accent: '#89b4fa',
    accentHover: '#74c7ec',

    // 边框
    border: '#45475a',

    // 状态颜色
    success: '#a6e3a1',
    warning: '#f9e2af',
    error: '#f38ba8',

    // 代码块
    codeBg: '#181825',
    codeText: '#cdd6f4',

    // 链接
    link: '#89b4fa',
    linkHover: '#74c7ec',

    // 引用块
    blockquoteBg: '#313244',
    blockquoteBorder: '#89b4fa',

    // 表格
    tableBorder: '#45475a',
    tableHeaderBg: '#313244',
    tableRowHover: '#2a2a3c',
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontFamilyMono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: '16px',
    lineHeight: '1.75',
    h1Size: '2em',
    h2Size: '1.5em',
    h3Size: '1.25em',
  },
  spacing: {
    paragraphMargin: '1em 0',
    headingMargin: '1.5em 0 0.5em',
    blockPadding: '1em',
  },
}

export const defaultLightTheme = {
  id: 'light',
  name: 'Default Light',
  description: 'A clean and elegant light theme for writing',
  colors: {
    // 编辑器背景
    editorBg: '#fcfcfc',
    editorBgSecondary: '#f3f4f6',

    // 预览区背景
    previewBg: '#fcfcfc',

    // 文本颜色
    textPrimary: '#1f2937',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',

    // 强调色
    accent: '#3b82f6',
    accentHover: '#2563eb',

    // 边框
    border: '#e5e7eb',

    // 状态颜色
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',

    // 代码块
    codeBg: '#f3f4f6',
    codeText: '#1f2937',

    // 链接
    link: '#3b82f6',
    linkHover: '#2563eb',

    // 引用块
    blockquoteBg: '#f9fafb',
    blockquoteBorder: '#3b82f6',

    // 表格
    tableBorder: '#e5e7eb',
    tableHeaderBg: '#f3f4f6',
    tableRowHover: '#f9fafb',
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontFamilyMono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: '16px',
    lineHeight: '1.75',
    h1Size: '2em',
    h2Size: '1.5em',
    h3Size: '1.25em',
  },
  spacing: {
    paragraphMargin: '1em 0',
    headingMargin: '1.5em 0 0.5em',
    blockPadding: '1em',
  },
}

export type Theme = typeof defaultTheme


// 将主题转换为 CSS 变量
export function themeToCSSVariables(theme: Theme): string {
  const vars: string[] = []

  // 颜色变量
  Object.entries(theme.colors).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
    vars.push(`--theme-${cssKey}: ${value}`)
  })

  // 排版变量
  Object.entries(theme.typography).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
    vars.push(`--theme-${cssKey}: ${value}`)
  })

  // 间距变量
  Object.entries(theme.spacing).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
    vars.push(`--theme-${cssKey}: ${value}`)
  })

  return `:root {\n  ${vars.join(';\n  ')};\n}`
}
