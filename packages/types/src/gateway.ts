// ============================================
// Gateway Types
// ============================================

/**
 * Gateway process status
 */
export type GatewayStatus = 'stopped' | 'starting' | 'running' | 'error'

/**
 * Gateway state for store
 */
export interface GatewayState {
  status: GatewayStatus
  port: number
  error?: string
}
