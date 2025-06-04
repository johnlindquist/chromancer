import { Command } from '@oclif/core'
import { SessionManager } from '../session.js'

export default class Stop extends Command {
  static description = 'Stop the active Chrome browser instance'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  public async run(): Promise<void> {
    const session = await SessionManager.getValidSession()
    
    if (!session) {
      this.log('No active Chrome session found')
      return
    }
    
    this.log(`Stopping Chrome on port ${session.port}...`)
    
    try {
      if (process.platform === 'win32') {
        // Windows-specific process termination
        try {
          // Use taskkill command on Windows
          const { execSync } = require('child_process')
          execSync(`taskkill /F /PID ${session.pid}`, { stdio: 'ignore' })
        } catch (error) {
          // Process might already be terminated
        }
      } else {
        // Unix-like systems
        try {
          // Try to kill the process gracefully
          process.kill(session.pid, 'SIGTERM')
          
          // Give it a moment to shut down gracefully
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Check if it's still running
          try {
            process.kill(session.pid, 0)
            // If we get here, process is still running, force kill
            process.kill(session.pid, 'SIGKILL')
          } catch {
            // Process already terminated
          }
        } catch {
          // Process might already be terminated
        }
      }
      
      // Clear the session
      SessionManager.clearSession()
      
      this.log('✅ Chrome stopped successfully')
    } catch (error) {
      this.error(`Failed to stop Chrome: ${error}`)
    }
  }
}