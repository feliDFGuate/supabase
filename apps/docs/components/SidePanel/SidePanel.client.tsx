import { type MutableRefObject, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'

import { Admonition } from 'ui-patterns/Admonition'
import { AssistantChatForm } from 'ui-patterns/AssistantChat'

import { AutocompletePopover } from '../AutocompleteInput'
import { sidePanelState } from './SidePanel.utils'

function useReturnFocus<T extends HTMLElement>(ref: MutableRefObject<T>) {
  const previousFocusedElem = useRef<Element>(null)

  useEffect(() => {
    previousFocusedElem.current = document.activeElement
    ref.current?.focus()

    //@ts-expect-error -- focus will not be a method if not HTMLElement
    return () => previousFocusedElem.current?.focus?.()
  }, [ref])
}

export function SidePanelInput() {
  const { slashCommands, setCommand } = useSnapshot(sidePanelState)
  const slashCommandNames = useMemo(() => [...slashCommands.keys()], [slashCommands])

  const [commandsOpen, setCommandsOpen] = useState(false)
  console.log('COMMANDS OPEN?', commandsOpen)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  const [value, setValueState] = useState('')
  const [loading, setLoading] = useState(false)

  useReturnFocus(textAreaRef)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const command = textAreaRef.current?.value
    if (command) setCommand(command)
  }

  return (
    <div className="flex flex-col gap-3">
      <AutocompletePopover
        open={commandsOpen}
        setOpen={setCommandsOpen}
        textAreaRef={textAreaRef}
        value={value}
        setValue={setValueState}
        suggestions={[{ name: 'ref js', hint: '[method]' }]}
      >
        <AssistantChatForm
          textAreaRef={textAreaRef}
          value={value}
          loading={loading}
          disabled={loading}
          onValueChange={(e) => setValueState(e.target.value)}
          commandsOpen={commandsOpen}
          setCommandsOpen={setCommandsOpen}
          onSubmit={async (event) => {
            event.preventDefault()
            handleSubmit(event)
          }}
        />
      </AutocompletePopover>
      <p className="text-xs mt-3 text-foreground-lighter">
        Press <span className="bg-surface-300 px-[3px] py-[2px] border rounded">/</span> to open
        commands
      </p>
    </div>
  )
}

export function Messages() {
  const { history } = useSnapshot(sidePanelState)

  return <pre>{JSON.stringify(history, null, 2)}</pre>
}

export function ErrorMessage() {
  const { error } = useSnapshot(sidePanelState)
  if (!error) return undefined

  return <Admonition type="warning">{error.toString()}</Admonition>
}
