import React, { useEffect, useRef } from 'react'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { prism } from '@milkdown/plugin-prism'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { useEditorStore } from '../../stores/editorStore'
import { typoraEmojiDecorationPlugin } from './typoraDecorations'
import './styles.css'

export function syncTyporaWriteRoot(root: ParentNode | null) {
  const editorRoot = root?.querySelector('.milkdown .editor, .editor')
  if (!(editorRoot instanceof HTMLElement)) {
    return
  }

  // Typora 主题通常以 #write.write 作为正文区域根节点。
  editorRoot.id = 'write'
  editorRoot.classList.add('write')
}

// 编辑器内容组件
const EditorContent: React.FC = () => {
  const { filePath, content, setContent } = useEditorStore()
  const typoraWriteHostRef = useRef<HTMLDivElement>(null)

  useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, content)
      })
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          setContent(markdown)
        })
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(prism)
      .use(typoraEmojiDecorationPlugin)
  }, [filePath])

  useEffect(() => {
    const host = typoraWriteHostRef.current
    if (!host) {
      return
    }

    syncTyporaWriteRoot(host)

    if (typeof MutationObserver === 'undefined') {
      return
    }

    const observer = new MutationObserver(() => {
      syncTyporaWriteRoot(host)
    })
    observer.observe(host, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div className="typora-write-host" ref={typoraWriteHostRef}>
      <Milkdown />
    </div>
  )
}

// 编辑器包装组件
export const MilkdownEditor: React.FC = () => {
  return (
    <MilkdownProvider>
      <div className="milkdown-editor">
        <EditorContent />
      </div>
    </MilkdownProvider>
  )
}

export default MilkdownEditor
