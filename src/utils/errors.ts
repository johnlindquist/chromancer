export interface CommandError extends Error {
  action?: string
  selector?: string
  originalError?: Error
  isTimeout?: boolean
}

/**
 * Check if an error is a timeout error
 */
export function isTimeoutError(error: Error): boolean {
  return (
    error.name === 'TimeoutError' ||
    error.message.includes('TimeoutError') ||
    error.message.includes('timeout') ||
    error.message.includes('Timeout') ||
    error.message.includes('Waiting failed')
  )
}

/**
 * Format error message with consistent structure
 */
export function formatErrorMessage(
  action: string,
  message: string,
  selector?: string,
  error?: Error
): string {
  if (error && isTimeoutError(error) && selector) {
    return `Timeout waiting for element: ${selector}`
  }
  
  let formattedMessage = `Failed to ${action}: ${message}`
  if (selector) {
    formattedMessage += ` (${selector})`
  }
  
  return formattedMessage
}

/**
 * Create a standardized command error
 */
export function handleCommandError(
  error: Error,
  action: string,
  selector?: string
): CommandError {
  const commandError = new Error(
    formatErrorMessage(action, error.message, selector, error)
  ) as CommandError
  
  commandError.action = action
  commandError.selector = selector
  commandError.originalError = error
  commandError.isTimeout = isTimeoutError(error)
  
  // Preserve stack trace
  if (error.stack) {
    commandError.stack = error.stack
  }
  
  return commandError
}