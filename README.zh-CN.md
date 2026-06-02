# 墨羽（Inkwing）

[English](./README.md)

墨羽是一款面向专注写作的桌面 Markdown 编辑器。项目使用 Tauri 2
提供原生桌面能力，前端基于 React、TypeScript 和 Milkdown，支持所见即所得编辑、
实时预览、文档大纲、自动保存和可扩展主题系统。

英文产品名为 **Inkwing**。

## 功能特性

- 基于 Milkdown 的所见即所得 Markdown 编辑体验。
- 支持编辑器和预览分栏，兼顾源码编辑习惯。
- 根据 Markdown 标题生成文档大纲侧边栏。
- 支持本地文件打开、保存、重命名、导出和自动保存。
- 内置深色和浅色主题，使用 CSS 变量驱动。
- 支持按文件夹导入 Typora 主题，并进行作用域隔离适配。
- 支持 KaTeX 数学公式渲染和 Prism 代码高亮。
- 基于 Tauri 的跨平台桌面应用基础。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 桌面外壳 | Tauri 2 |
| 后端 | Rust |
| 前端 | React 18、TypeScript、Vite |
| 编辑器 | Milkdown、ProseMirror |
| 状态管理 | Zustand |
| 测试 | Vitest、Cargo test |

## 环境要求

- Node.js 18 或更高版本。
- Rust 1.70 或更高版本。
- Tauri 2 对应平台依赖，参考 [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)。

## 快速开始

安装依赖：

```bash
npm install
```

启动 Web 开发服务：

```bash
npm run dev
```

启动 Tauri 桌面应用：

```bash
npm run tauri -- dev
```

构建前端：

```bash
npm run build
```

运行测试：

```bash
npm run test -- --run
cd src-tauri && cargo test
```

## 项目结构

```text
inkwing/
├── src/                  # React 前端
│   ├── components/       # 编辑器、预览、侧边栏、设置
│   ├── hooks/            # 自动保存和快捷键
│   ├── stores/           # Zustand 编辑器状态
│   ├── themes/           # 内置主题和 Typora 主题运行时
│   └── utils/            # 导出和运行时辅助函数
├── src-tauri/            # Tauri 和 Rust 后端
│   ├── capabilities/     # Tauri capability 配置
│   └── src/              # 命令和原生应用入口
├── themes/               # 内置 CSS 变量主题
├── third-theme/          # Typora 主题参考包
└── package.json
```

## 主题系统

墨羽支持两类主题：

- 内置主题：以 TypeScript 对象维护，并映射为全局 CSS 变量。
- 导入的 Typora 主题：由 Tauri 复制到应用数据目录，生成清单文件后持久化；
  前端读取 CSS 后进行资源路径重写、选择器作用域隔离，并在运行时注入。

导入的 Typora CSS 不会全局污染应用。`#write`、`body`、`:root`、`.md-fences`
以及 Typora 外壳相关选择器会被重写或过滤，避免影响设置弹窗、标题栏和侧边栏。

## Git 规范

仓库默认忽略：

- `node_modules/`
- `dist/`
- `src-tauri/target/`
- Tauri 生成的 schema 文件
- 本地计划文档
- `.env*`、日志、系统和编辑器临时文件

## License

墨羽基于 [MIT License](./LICENSE) 开源。
