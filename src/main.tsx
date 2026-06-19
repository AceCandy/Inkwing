import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import 'katex/dist/katex.min.css'
import 'font-awesome/css/font-awesome.min.css'
import './styles/global.css'
import { mountTyporaSkeleton } from './components/TyporaShell/mountSkeleton'

// 在 React 渲染之前，把 Typora 原生 sidebar 骨架注入 document.body（#root 之前）。
// 这样 Typora base-control.css / window.css 的全局 id 选择器在与 Typora 完全相同的
// DOM 位置生效，TyporaShell 组件再通过 portal 填充动态内容。
mountTyporaSkeleton()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
