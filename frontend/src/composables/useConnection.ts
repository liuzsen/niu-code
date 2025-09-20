import { computed } from 'vue'
import { wsService } from '../services/websocket'

export function useConnection() {
  const connectionStatus = computed(() => {
    if (wsService.state.connected) return 'Connected'
    if (wsService.state.connecting) return 'Connecting...'
    return 'Disconnected'
  })


  const connect = async () => {
    try {
      await wsService.connect()
    } catch (error) {
      console.error('Connection failed:', error)
    }
  }

  const disconnect = () => {
    wsService.disconnect()
  }

  return {
    connectionStatus,
    connect,
    disconnect,
    isConnected: computed(() => wsService.state.connected),
    isConnecting: computed(() => wsService.state.connecting),
    error: computed(() => wsService.state.error)
  }
}