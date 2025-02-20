'use client'

import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
} from 'react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@ui/components/shadcn/ui/command'
import { cn, Popover_Shadcn_ as Popover, PopoverContent_Shadcn_ as PopoverContent } from 'ui'
import { PopoverAnchor } from '@ui/components/shadcn/ui/popover'

interface Suggestion {
  name: string
  hint?: string
}

/**
 *
 * Splits a suggestion into 3 parts:
 * 1. The part that matches what is already typed. May be undefined if nothing
 *    was typed.
 * 2. The next word. May be an empty string.
 * 3. The part after the next word. May be undefined.
 */
function filterSuggestions(sugg: Suggestion[], input: string): Suggestion[] {
  let mapped: Suggestion[]

  if (!input) {
    mapped = sugg.map(({ name, hint }) => {
      const next = name.split(' ', 1)[0]
      return { name: next, hint }
    })
  } else {
    mapped = sugg
      .filter(({ name }) => name.startsWith(input))
      .map(({ name, hint }) => {
        const next = name.substring(input.length).split(/(?<!^)\s+/, 1)[0]
        return { name: next, hint }
      })
  }

  const seen = new Set()
  const filtered = mapped.filter(({ name }) => {
    if (seen.has(name)) {
      return false
    }

    seen.add(name)
    return true
  })

  return filtered
}

const AutocompletePopover = forwardRef<
  ElementRef<typeof Popover>,
  ComponentPropsWithoutRef<typeof Popover> & {
    /* The children to render - this is where the AssistantChatForm should be placed */
    children: React.ReactNode
    /* The ref for the textarea - used with the AssistantChatForm */
    textAreaRef: React.RefObject<HTMLTextAreaElement>
    /* The function to handle the value change */
    setValue: (value: string) => void
    /* The value of the textarea */
    value: string
    /* Whether the popover is open */
    open: boolean
    /* The function to handle the popover open state */
    setOpen: (value: boolean) => void
    /* Autocomplete suggestions */
    suggestions?: Suggestion[]
  }
>(({ children, textAreaRef, setValue, value, open, setOpen, suggestions, ...props }, ref) => {
  const popoverContentRef = useRef<HTMLDivElement>()
  const targetInputRef = useRef<HTMLInputElement | null>(null)
  const textAreaWidth = textAreaRef.current?.clientWidth

  const queryEmpty = !value
  const queryLengthOne = value.length === 1
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === '/' && queryEmpty) {
        // User just started typing a slash command, open autocomplete
        setOpen(true)
        textAreaRef.current?.focus()
      } else if (event.key === 'Backspace' && queryLengthOne) {
        // This backspace will empty the input, close autocomplete
        setOpen(false)
      } else if (event.key === 'Escape') {
        setOpen(false)
      } else {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter') {
          // Forward the event to the target input
          if (targetInputRef.current) {
            const keyboardEvent = new KeyboardEvent('keydown', {
              bubbles: true,
              cancelable: true,
              composed: true,
              key: event.key,
              code: event.code,
            })

            targetInputRef.current.dispatchEvent(keyboardEvent)

            // Schedule focus on the original input using requestAnimationFrame
            requestAnimationFrame(() => {
              if (textAreaRef.current) {
                textAreaRef.current.focus()
              }
            })

            // Prevent the default behavior for ArrowUp, ArrowDown, and Enter
            event.preventDefault()
          }
        }
      }
    },
    [setOpen, textAreaRef, queryEmpty, queryLengthOne]
  )

  useEffect(() => {
    const textArea = textAreaRef.current
    if (textArea) {
      textArea.addEventListener('keydown', handleKeyPress)
    }

    return () => {
      if (textArea) {
        textArea.removeEventListener('keydown', handleKeyPress)
      }
    }
  }, [handleKeyPress, textAreaRef])

  const formattedSuggestions = filterSuggestions(suggestions, value.substring(1))

  return (
    <Popover
      open={open}
      onOpenChange={(open: boolean) => {
        setOpen(open)
        if (open) textAreaRef.current?.focus()
      }}
      {...props}
    >
      <PopoverAnchor className={cn('w-full relative')}>{children}</PopoverAnchor>
      <PopoverContent
        ref={popoverContentRef}
        className="my-2 p-0"
        // Override the width to match the input if it exists
        style={{ width: textAreaWidth ?? '420px', minWidth: 0 }}
        align="start"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
        }}
      >
        <Command>
          <CommandInput
            placeholder="Type a command or search..."
            wrapperClassName="hidden"
            value={value}
            ref={targetInputRef}
            tabIndex={-1}
            autoFocus={false}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              {formattedSuggestions.map(({ name, hint }) => (
                <CommandItem
                  key={name}
                  value={value + name}
                  className="text-sm gap-0.5"
                  onSelect={() => {
                    setValue(`${value}${name}`)
                  }}
                >
                  <span className="text-default">{value + name}</span>
                  {name === '' && <span className="text-light">{hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
})

AutocompletePopover.displayName = 'AutocompletePopover'

export { AutocompletePopover }
