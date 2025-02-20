import { proxy } from 'valtio'

type CommandAction = (param?: string) => void

interface SlashCommand {
  name: string
  hint?: string
  execute: CommandAction
}

const jsCommand: SlashCommand = {
  name: 'ref js',
  hint: '[method (optional)]',
  execute: async (params: string) => {
    const method = params.replace(/^ref js\s*/, '')

    if (!method) {
      const data = await fetch('/docs/api/reference?library=javascript&fields=title')
      const json = await data.json()
      sidePanelState.history.push({
        __agent: 'server',
        response: json,
      })
    } else {
      const data = await fetch(`/docs/api/reference?library=javascript&method=${method}`)
      const json = await data.json()
      sidePanelState.history.push({
        __agent: 'server',
        response: json,
      })
    }
  },
}

type HistoryItem = HistoryItemUser | HistoryItemApi

interface HistoryItemUser {
  __agent: 'user'
  command: string
}

interface HistoryItemApi {
  __agent: 'server'
  response: 'string'
}

class InvalidCommandError extends Error {
  constructor(private command: string) {
    super()
  }

  toString() {
    return `"${this.command}" is not a valid command`
  }
}

type SidePanelError = InvalidCommandError

export const sidePanelState = proxy({
  isOpen: false,
  setIsOpen: (open: boolean | ((open: boolean) => boolean)) => {
    if (typeof open === 'boolean') {
      sidePanelState.isOpen = open
    } else {
      sidePanelState.isOpen = open(sidePanelState.isOpen)
    }
  },
  error: null as SidePanelError | null,
  history: [] as Array<HistoryItem>,
  setCommand: (rawCmd: string, skipRun = false) => {
    sidePanelState.error = null

    const cmd = rawCmd.substring(1) // Remove the slash

    sidePanelState.history.push({ __agent: 'user', command: cmd })

    if (!skipRun) {
      const maybeError = sidePanelState.safeExecuteCommand(cmd)
      if (maybeError) {
        sidePanelState.error = maybeError
      }
    }
  },
  slashCommands: new Map<string, SlashCommand>([[jsCommand.name, jsCommand]]),
  safeExecuteCommand(cmd: string): undefined | SidePanelError {
    let cmdDetails = sidePanelState.slashCommands.get(cmd)
    while (cmdDetails === undefined && cmd.includes(' ')) {
      const maybeCmd = cmd.substring(0, cmd.lastIndexOf(' '))
      cmdDetails = sidePanelState.slashCommands.get(maybeCmd)
    }
    if (cmdDetails === undefined) {
      return new InvalidCommandError(cmd)
    }
    cmdDetails.execute(cmd)
  },
})
