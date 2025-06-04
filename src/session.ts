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
  private static sessionFile = path.join(os.tmpdir(), 'chromancer-session.json')
  private static activeProcess: ChildProcess | null = null

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
      process.kill(session.pid, 0)
      
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