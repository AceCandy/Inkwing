# Yammmby

A modern, cross-platform Markdown editor with beautiful themes and WYSIWYG editing.

## Features

- 🎨 **Beautiful Themes** - Built-in dark/light themes with customizable CSS variables
- ✨ **WYSIWYG Editing** - Real-time rich text editing experience
- 📝 **Split View** - Traditional editor + preview mode
- 📁 **File Management** - Open, save, and manage Markdown files
- 📋 **Document Outline** - Sidebar with heading navigation
- 🎯 **Cross-Platform** - Works on macOS, Windows, and Linux

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Tauri 2.x (Rust backend) |
| Frontend | React + TypeScript |
| Editor | Milkdown (ProseMirror-based) |
| Styling | CSS Variables + Theme System |

## Getting Started

### Prerequisites

- Node.js 18+
- Rust 1.70+
- System dependencies for Tauri ([see Tauri docs](https://v2.tauri.app/start/prerequisites/))

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## Project Structure

```
yammmby/
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── main.rs      # Entry point
│   │   └── lib.rs       # Tauri commands
│   └── Cargo.toml
├── src/                 # React frontend
│   ├── components/
│   │   ├── Editor/      # Milkdown editor
│   │   ├── Preview/     # Markdown preview
│   │   ├── Sidebar/     # Document outline
│   │   ├── Toolbar/     # File operations
│   │   └── ThemeManager/# Theme settings
│   ├── stores/          # Zustand state
│   └── themes/          # Theme definitions
├── themes/              # External theme packages
└── package.json
```

## Theme System

### Built-in Themes

- **Default Dark** - Clean dark theme for comfortable editing

### External Themes

Themes can be loaded from the `themes/` directory. Each theme contains:

```
themes/my-theme/
├── theme.json    # Theme metadata
└── theme.css     # Theme styles (CSS variables)
```

### theme.json

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "description": "A custom theme",
  "path": "./themes/my-theme"
}
```

### CSS Variables

Themes use CSS variables for customization:

```css
:root {
  --theme-editor-bg: #1e1e2e;
  --theme-text-primary: #cdd6f4;
  --theme-accent: #89b4fa;
  /* ... more variables */
}
```

## Development

### Running in Development

```bash
npm run dev
```

This starts:
- Vite dev server at `http://localhost:1420`
- Tauri app with hot reload

### Building

```bash
npm run build
```

The built app will be in `src-tauri/target/release/`.

## Roadmap

- [ ] Drag-and-drop file opening
- [ ] Export to PDF/HTML
- [ ] Math formula support (KaTeX)
- [ ] Mermaid diagram support
- [ ] Plugin system
- [ ] Keyboard shortcuts customization
- [ ] Multi-tab support
- [ ] Search and replace
- [ ] Auto-save
- [ ] Version history

## License

MIT
