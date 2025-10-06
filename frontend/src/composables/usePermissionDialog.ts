import { computed } from 'vue'
import type { PermissionUpdate, ToolPermissionRequest } from '../types/message'
import type { PermissionResult } from '@anthropic-ai/claude-code'
import { useWorkspace } from '../stores/workspace'
import { useChatManager } from '../stores/chat'
import { useToast } from 'primevue'
import { extractFileName } from '../utils/pathProcess'
import { useMessageSender } from './useMessageSender'

export interface PermissionOption {
  id: string
  text: string
  icon: string
  iconClass: string
  textClass: string
  action: () => void
}

export function usePermissionDialog(request: ToolPermissionRequest | null) {
  const workspace = useWorkspace()
  const chatManager = useChatManager()
  const toast = useToast()
  const messageSender = useMessageSender()

  const isExitPlanMode = computed(() => request?.tool_use.tool_name === 'ExitPlanMode')
  const suggestions = computed(() => request?.suggestions || [])

  let escCallback: (() => void) | undefined;

  const questionText = computed(() => {
    if (!request) return ''

    if (isExitPlanMode.value) {
      return 'Would you like to proceed?'
    }

    const toolName = request.tool_use.tool_name

    if (toolName === 'Edit' || toolName === 'Write') {
      const file_path = request.tool_use.input.file_path
      const fileName = extractFileName(file_path)
      return `Do you want to make this edit to ${fileName}?`
    }

    if (toolName === 'Bash') {
      return `Do you want to run this command?`
    }

    return `Do you want to allow this ${toolName} operation?`
  })

  function suggestionText(suggestion: PermissionUpdate): string {
    switch (suggestion.type) {
      case 'setMode':
        if (suggestion.mode == 'acceptEdits') {
          if (suggestion.destination == 'session') {
            return 'Yes, allow all edits during this session'
          } else if (suggestion.destination == 'projectSettings') {
            return 'Yes, allow all edits in this project'
          }
        }
        break
      case "addRules": {
        const rule = suggestion.rules[0];
        if (rule.toolName == "Bash") {
          if (suggestion.destination == 'localSettings') {
            const cmd = rule.ruleContent?.replace(":*", "");
            const cmd_html = `<span class="text-orange-500 font-bold">${cmd}</span>`
            return `Yes and don't ask again for commands ${cmd_html} in ${workspace.workingDirectory}`
          }
        }
        break
      }
      default:
        return String(suggestion)
    }

    return `Unknown suggestion type: ${suggestion}`
  }

  // Permission response functions
  const sendPermissionResponse = (result: PermissionResult) => {
    try {
      messageSender.sendPermissionResponse(chatManager.foregroundChat.chatId, result)
      chatManager.foregroundChat.pendingRequest = undefined
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: `Failed to send permission response:\n ${error}`,
      })
    }
  }

  const denyPermission = () => {
    if (!request) return

    const result: PermissionResult = {
      behavior: 'deny',
      message: "",
      interrupt: true
    };

    sendPermissionResponse(result)
  }

  const allowPermission = () => {
    if (!request) return

    const result: PermissionResult = {
      behavior: 'allow',
      updatedInput: request.tool_use.input as Record<string, unknown>,
      updatedPermissions: []
    };

    sendPermissionResponse(result)
  }

  const allowWithSuggestion = (suggestion?: PermissionUpdate) => {
    if (!request) return

    const result: PermissionResult = {
      behavior: 'allow',
      updatedInput: request.tool_use.input as Record<string, unknown>,
      updatedPermissions: suggestion ? [suggestion] : [],
    };

    // Handle special case for ExitPlanMode with acceptEdits
    if (suggestion?.type === 'setMode' && suggestion.mode === 'acceptEdits') {
      chatManager.foregroundChat.session.permissionMode = 'acceptEdits'
    }

    sendPermissionResponse(result)
  }

  const options = computed<PermissionOption[]>(() => {
    if (!request) return []

    if (isExitPlanMode.value) {
      escCallback = denyPermission
      return [
        {
          id: 'exit-allow-with-suggestion',
          text: 'Yes, and auto-accept edits',
          icon: 'pi-check',
          iconClass: 'text-orange-500',
          textClass: 'font-medium',
          action: () => allowWithSuggestion({ type: 'setMode', mode: 'acceptEdits', destination: 'session' })
        },
        {
          id: 'exit-allow',
          text: 'Yes, and manually approve edits',
          icon: 'pi-check',
          iconClass: 'text-gray-500',
          textClass: '',
          action: allowPermission
        },
        {
          id: 'exit-deny',
          text: 'No, keep planning (ESC)',
          icon: 'pi-times',
          iconClass: 'text-red-500',
          textClass: 'font-medium',
          action: denyPermission
        }
      ]
    }

    const baseOptions: PermissionOption[] = [
      {
        id: 'allow',
        text: 'Yes',
        icon: 'pi-check',
        iconClass: 'text-green-500',
        textClass: '',
        action: allowPermission
      }
    ]

    const suggestionOptions: PermissionOption[] = suggestions.value.map((suggestion, index) => ({
      id: `suggestion-${index}`,
      text: suggestionText(suggestion),
      icon: 'pi-lightbulb',
      iconClass: 'text-orange-500',
      textClass: 'font-medium',
      action: () => allowWithSuggestion(suggestion)
    }))

    escCallback = denyPermission
    const denyOption: PermissionOption = {
      id: 'deny',
      text: 'No, and tell Claude what to do differently (ESC)',
      icon: 'pi-times',
      iconClass: 'text-red-500',
      textClass: 'font-medium',
      action: denyPermission
    }

    return [...baseOptions, ...suggestionOptions, denyOption]
  })

  return {
    questionText,
    options,
    escCallback
  }
}