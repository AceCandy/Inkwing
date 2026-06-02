# Inkwing

[简体中文](./README.zh-CN.md)

Inkwing is a desktop Markdown editor for focused writing. It combines a Tauri
2 native shell, a React and TypeScript interface, Milkdown editing, live preview,
document outline navigation, and an extensible theme system.

The Chinese product name is **墨羽**.

## Features

- WYSIWYG Markdown editing powered by Milkdown.
- Split editor and preview mode for source-first workflows.
- Document outline sidebar generated from Markdown headings.
- Local file open, save, rename, export, and auto-save support.
- Built-in dark and light themes based on CSS variables.
- Folder-based Typora theme import with scoped CSS adaptation.
- KaTeX math rendering and Prism code highlighting.
- Cross-platform desktop foundation through Tauri.

## Tech Stack

| Area | Technology |
| --- | --- |
| Desktop shell | Tauri 2 |
| Backend | Rust |
| Frontend | React 18, TypeScript, Vite |
| Editor | Milkdown, ProseMirror |
| State | Zustand |
| Tests | Vitest, Cargo test |

## Requirements

- Node.js 18 or newer.
- Rust 1.70 or newer.
- Platform prerequisites for Tauri 2. See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## Getting Started

Install dependencies:

```bash
npm install
```

Run the web development server:

```bash
npm run dev
```

Run the Tauri desktop app:

```bash
npm run tauri -- dev
```

Build the frontend:

```bash
npm run build
```

Run tests:

```bash
npm run test -- --run
cd src-tauri && cargo test
```

## Project Structure

```text
inkwing/
├── src/                  # React frontend
│   ├── components/       # Editor, preview, sidebar, settings
│   ├── hooks/            # Auto-save and keyboard shortcuts
│   ├── stores/           # Zustand editor state
│   ├── themes/           # Built-in and Typora theme runtime
│   └── utils/            # Export and runtime helpers
├── src-tauri/            # Tauri and Rust backend
│   ├── capabilities/     # Tauri capability configuration
│   └── src/              # Commands and native app entry points
├── themes/               # Bundled CSS-variable themes
├── third-theme/          # Reference Typora theme package
└── package.json
```

## Theme System

Inkwing supports two theme paths:

- Built-in themes are TypeScript theme objects mapped to global CSS variables.
- Imported Typora themes are copied into the app data directory, registered by a
  manifest, read through Tauri commands, adapted to Inkwing's editor and preview
  scopes, and injected at runtime.

Imported Typora theme CSS is not applied globally. Selectors such as `#write`,
`body`, `:root`, `.md-fences`, and Typora shell selectors are rewritten or
filtered so settings, title bar, and sidebar UI remain isolated.

## Git Hygiene

The repository intentionally ignores:

- `node_modules/`
- `dist/`
- `src-tauri/target/`
- generated Tauri schema files
- local planning artifacts
- `.env*`, logs, and OS/editor files

## License

Inkwing is released under the [MIT License](./LICENSE).
