import React from 'react'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { prism } from '@milkdown/plugin-prism'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { useEditorStore } from '../../stores/editorStore'
import './styles.css'

// 编辑器内容组件
const EditorContent: React.FC = () => {
  const { filePath, content, setContent } = useEditorStore()

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
  }, [filePath])

  return <Milkdown />
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
