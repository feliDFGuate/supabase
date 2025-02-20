import { cn } from 'ui'

import { ErrorMessage, Messages, SidePanelInput } from './SidePanel.client'

export function SidePanel({ className }: { className?: string } = {}) {
  return (
    <div
      className={cn(
        'w-full h-full overflow-hidden',
        'flex flex-col items-between',
        'p-4',
        className
      )}
    >
      <div className="w-full flex-grow overflow-auto">
        <Messages />
      </div>
      <ErrorMessage />
      <SidePanelInput />
    </div>
  )
}
