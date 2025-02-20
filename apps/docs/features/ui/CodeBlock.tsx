'use client'

import { useMemo } from 'react'
import { useSnapshot } from 'valtio'

import { CodeBlock as CodeBlockPrimitive, type CodeBlockProps } from 'ui'
import { transformRenderer } from 'ui-patterns/SqlToRest/syntax-highlighter/transform-renderer'

import { sidePanelState } from '~/components/SidePanel/SidePanel.utils'

export function CodeBlock(props: CodeBlockProps) {
  const { setIsOpen, setCommand } = useSnapshot(sidePanelState)

  const codeBlockRenderer = useMemo(
    () =>
      transformRenderer({
        search: (text) => text.includes('signUp('),
        wrapper: ({ children }) => (
          <span
            className="cursor-pointer border-b border-dotted border-neutral-500"
            onClick={() => {
              setIsOpen(true)
              setCommand('/ref js signUp')
            }}
          >
            {children}
          </span>
        ),
      }),
    [setIsOpen, setCommand]
  )

  return <CodeBlockPrimitive renderer={codeBlockRenderer} {...props} />
}
