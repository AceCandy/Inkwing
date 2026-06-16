# Typora Sidebar Parity 待办

更新时间：2026-06-16

## 当前已确认

- 本机 Typora 当前偏好：`theme = Claude`、`darkTheme = Claude Dark`、`sidebar_tab = outline`、`sidebar-width = 245`。
- Typora 原始 `TypeMark/index.html` 的搜索框机制不是长期保留 `#file-library-search-panel`：
  - 初始 HTML 中搜索输入和选项按钮在 `#file-library-search-panel`。
  - 启动脚本执行后会 `remove()` 该 panel，并把内部控件追加到 `#ty-sidebar-search-tabs`。
- 项目当前已经把搜索输入直接渲染到 `#ty-sidebar-search-tabs`，并且不再渲染 `#file-library-search-panel`。这个方向和 Typora 运行后的 DOM 一致。
- 端口收尾已检查：`1420` 和 `4444` 当前都没有监听进程。

## 未完成验证

- 使用 Safari WebDriver 重新跑一次完整 live 对比：
  - 打开 `/Applications/Typora.app/Contents/Resources/TypeMark/index.html`。
  - 打开 `http://127.0.0.1:1420/`，强制 `app-theme = typora:claude-typora-theme-v1-0-0:claude`、`app-sidebar-width = 245`。
  - 分别点击搜索按钮后采集 `#ty-sidebar-search-tabs`、`#file-library-search-input`、`#sidebar-content`、`#outline-content`、`#file-library-tree` 的 `getBoundingClientRect()` 和 `getComputedStyle()`。
- 对比截图仍未完成：需要用 Safari 或 `screencapture` 保留 Typora 与项目侧栏搜索态截图。

## 后续修正方向

- 文件树 DOM 还没有完全按 Typora 原始模板收敛。当前项目仍存在这些自造结构或属性：
  - `.file-tree-item`
  - `.file-tree-expander`
  - `.file-tree-name`
  - `data-file-tree-path`
  - `data-is-directory`
  - `role="button"` / `role="treeitem"`
- 建议把 `renderFileTreeNode()` 收敛到 Typora 模板：
  - 外层：`.file-library-node.file-tree-node`
  - 属性：保留 `data-path`、`data-has-sub`、`tabIndex={-1}`
  - 内容：`.file-node-background`、`.file-node-content`、`.file-node-open-state`、`i.file-node-icon`、`.file-node-title`、`.file-tree-rename-div > input.file-tree-rename-input`
  - 子节点容器：`.file-node-children`
- 同步更新测试：
  - 将 `[data-file-tree-path=...]` 改为 `[data-path=...]`。
  - 删除对 `.file-tree-item`、`.file-tree-expander`、`.file-tree-name`、`data-is-directory` 的断言。
  - 新增对 `.file-tree-rename-div` 和 `.file-tree-rename-input` 的断言。
- 同步清理样式：
  - 删除 `src/components/Sidebar/styles.css` 中 `.file-tree-item`、`.file-tree-expander`、`.file-tree-name` 这些项目别名选择器。
  - 避免用项目自造 class 做主题兜底；优先让 Typora 原始 class 和 Claude 主题 CSS 命中。

## 建议验证命令

```bash
npm run test -- src/components/Sidebar/index.test.tsx src/components/Sidebar/styles.test.ts src/App.openFile.test.tsx
npm run test
npm run build
git diff --check
```

## 注意事项

- 继续验证时必须用 Claude 主题作为基线。
- 不要把“能看起来类似”的项目兜底当成完成标准；优先对齐 Typora 原始 DOM、Typora 原始 CSS 选择器和 Safari live computedStyle。
- 当前工作树已有大量历史改动，后续提交时不要 `git add .`，只 stage 本任务确认相关文件。
