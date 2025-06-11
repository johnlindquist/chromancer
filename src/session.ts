import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { ChildProcess } from 'child_process'

export interface ChromeSession {
  port: number
  pid: number
  startTime: number
  url?: string
}

export class SessionManager {
  private static instance: SessionManager
  private static sessionFile = path.join(os.tmpdir(), 'chromancer-session.json')
  private static activeProcess: ChildProcess | null = null
  private browserInstance: any = null
  private contextInstance: any = null
  private pageInstance: any = null

  static getInstance(): SessionManager {
    if (!this.instance) {
      this.instance = new SessionManager()
    }
    return this.instance
  }

  setBrowserInstance(browser: any, context: any, page: any): void {
    this.browserInstance = browser
    this.contextInstance = context
    this.pageInstance = page
  }

  getBrowserInstance(): { browser: any, context: any, page: any } | null {
    if (this.browserInstance) {
      return {
        browser: this.browserInstance,
        context: this.contextInstance,
        page: this.pageInstance
      }
    }
    return null
  }

  static setActiveProcess(process: ChildProcess): void {
    this.activeProcess = process
  }

  static getActiveProcess(): ChildProcess | null {
    return this.activeProcess
  }

  static saveSession(session: ChromeSession): void {
    fs.writeFileSync(this.sessionFile, JSON.stringify(session, null, 2))
  }

  static loadSession(): ChromeSession | null {
    try {
      if (fs.existsSync(this.sessionFile)) {
        const data = fs.readFileSync(this.sessionFile, 'utf8')
        return JSON.parse(data)
      }
    } catch (error) {
      // Session file might be corrupted
    }
    return null
  }

  static clearSession(): void {
    try {
      if (fs.existsSync(this.sessionFile)) {
        fs.unlinkSync(this.sessionFile)
      }
    } catch (error) {
      // Ignore errors when clearing
    }
    this.activeProcess = null
  }

  static async isSessionValid(session: ChromeSession): Promise<boolean> {
    try {
      // Check if the process is still running
      if (process.platform === 'win32') {
        // On Windows, use tasklist to check if process exists
        const { execSync } = require('child_process')
        try {
          const output = execSync(`tasklist /FI "PID eq ${session.pid}"`, { encoding: 'utf8' })
          if (!output.includes(session.pid.toString())) {
            return false
          }
        } catch {
          return false
        }
      } else {
        // On Unix-like systems, use kill -0
        process.kill(session.pid, 0)
      }
      
      // Also check if Chrome is responding
      const response = await fetch(`http://localhost:${session.port}/json/version`)
      return response.ok
    } catch {
      return false
    }
  }

  static async getValidSession(): Promise<ChromeSession | null> {
    const session = this.loadSession()
    if (session && await this.isSessionValid(session)) {
      return session
    }
    this.clearSession()
    return null
  }
}