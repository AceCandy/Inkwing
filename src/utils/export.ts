import { marked } from 'marked'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'

// 内联样式，使用项目默认主题颜色
const EXPORT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 16px;
    line-height: 1.75;
    color: #cdd6f4;
    background-color: #1e1e2e;
    padding: 48px;
  }
  .content { max-width: 800px; margin: 0 auto; }
  h1 { font-size: 2em; font-weight: 700; margin: 1.5em 0 0.5em; color: #cdd6f4; border-bottom: 2px solid #45475a; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; font-weight: 600; margin: 1.5em 0 0.5em; color: #cdd6f4; }
  h3 { font-size: 1.25em; font-weight: 600; margin: 1.5em 0 0.5em; color: #cdd6f4; }
  h4, h5, h6 { font-size: 1.1em; font-weight: 600; margin: 1.5em 0 0.5em; color: #cdd6f4; }
  p { margin: 1em 0; }
  a { color: #89b4fa; text-decoration: none; border-bottom: 1px solid transparent; }
  a:hover { color: #74c7ec; border-bottom-color: #74c7ec; }
  strong { font-weight: 600; }
  em { font-style: italic; color: #a6adc8; }
  blockquote {
    margin: 1em 0; padding: 1em;
    background-color: #313244; border-left: 4px solid #89b4fa;
    border-radius: 0 8px 8px 0;
  }
  blockquote p { margin: 0.5em 0; color: #a6adc8; }
  code {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.9em; background-color: #181825; color: #cdd6f4;
    padding: 0.2em 0.4em; border-radius: 4px;
  }
  pre { margin: 1em 0; padding: 1em; background-color: #181825; border-radius: 8px; overflow-x: auto; }
  pre code { background: none; padding: 0; font-size: 0.9em; line-height: 1.6; }
  ul, ol { margin: 1em 0; padding-left: 2em; }
  li { margin: 0.5em 0; }
  table { width: 100%; margin: 1em 0; border-collapse: collapse; border-radius: 8px; overflow: hidden; }
  th { background-color: #313244; font-weight: 600; text-align: left; padding: 0.75em 1em; border: 1px solid #45475a; }
  td { padding: 0.75em 1em; border: 1px solid #45475a; }
  tr:hover { background-color: #2a2a3c; }
  hr { margin: 2em 0; border: none; border-top: 2px solid #45475a; }
  img { max-width: 100%; height: auto; border-radius: 8px; margin: 1em 0; }
  @media print {
    body { background-color: #fff; color: #1a1a2e; padding: 24px; }
    h1, h2, h3, h4, h5, h6 { color: #1a1a2e; }
    a { color: #2563eb; }
    code, pre { background-color: #f3f4f6; color: #1a1a2e; }
    blockquote { background-color: #f9fafb; border-left-color: #2563eb; }
    blockquote p { color: #4b5563; }
    th { background-color: #f3f4f6; }
    td, th { border-color: #e5e7eb; }
    tr:hover { background-color: #f9fafb; }
  }
`

// 生成完整的自包含 HTML 文档
function buildHTMLDocument(markdown: string, title: string): string {
  const body = marked.parse(markdown, { async: false }) as string
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(title)}</title>
  <style>${EXPORT_CSS}</style>
</head>
<body>
  <div class="content">${body}</div>
</body>
</html>`
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// 从文件名生成不带扩展名的基础名
function getBaseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

// 导出为 HTML 文件
export async function exportToHTML(markdown: string, fileName: string): Promise<void> {
  const baseName = getBaseName(fileName)
  const path = await save({
    defaultPath: `${baseName}.html`,
    filters: [{ name: 'HTML', extensions: ['html'] }],
  })
  if (!path) return

  const html = buildHTMLDocument(markdown, baseName)
  await invoke('export_html', { path, content: html })
}

// 导出为 PDF（通过浏览器打印）
export function exportToPDF(markdown: string, fileName: string): void {
  const baseName = getBaseName(fileName)
  const html = buildHTMLDocument(markdown, baseName)

  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}
