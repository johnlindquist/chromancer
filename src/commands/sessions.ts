import { Flags } from '@oclif/core'
import { Command } from '@oclif/core'
import fetch from 'node-fetch'
import { execSync } from 'child_process'
import * as os from 'os'

interface ChromeInstance {
  port: number
  pid?: number
  version?: string
  tabs?: any[]
  error?: string
}

export default class Sessions extends Command {
  static description = 'List all Chrome instances with remote debugging enabled'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --kill 9222',
    '<%= config.bin %> <%= command.id %> --kill-all',
  ]

  static flags = {
    kill: Flags.integer({
      description: 'Kill Chrome instance on specified port',
      required: false,
    }),
    'kill-all': Flags.boolean({
      description: 'Kill all Chrome instances with debugging enabled',
      default: false,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show detailed information about each instance',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Sessions)

    // Find all Chrome instances with debugging ports
    const instances = await this.findChromeInstances()

    if (flags.verbose) {
      this.log('🔍 Searching for Chrome instances...')
    }

    if (flags.kill) {
      await this.killInstance(flags.kill)
      return
    }

    if (flags['kill-all']) {
      await this.killAllInstances(instances)
      return
    }

    // Display found instances
    this.displayInstances(instances, flags.verbose)
  }

  private async findChromeInstances(): Promise<ChromeInstance[]> {
    const instances: ChromeInstance[] = []
    
    // Get all Chrome processes
    const platform = os.platform()
    let chromeProcesses: string = ''
    
    try {
      if (platform === 'darwin') {
        chromeProcesses = execSync('ps aux | grep -i "chrome.*remote-debugging-port" | grep -v grep', { encoding: 'utf8' })
      } else if (platform === 'linux') {
        chromeProcesses = execSync('ps aux | grep -i "chrom.*remote-debugging-port" | grep -v grep', { encoding: 'utf8' })
      } else if (platform === 'win32') {
        chromeProcesses = execSync('wmic process where "name like \'%chrome%\'" get processid,commandline /format:csv', { encoding: 'utf8' })
      }
    } catch (error) {
      // No Chrome processes found
      return instances
    }

    // Parse process list to find ports
    const portRegex = /--remote-debugging-port=(\d+)/
    const lines = chromeProcesses.split('\n').filter(line => line.trim())
    
    for (const line of lines) {
      const portMatch = line.match(portRegex)
      if (portMatch) {
        const port = parseInt(portMatch[1])
        const pidMatch = line.match(/^\s*\w+\s+(\d+)/)
        const pid = pidMatch ? parseInt(pidMatch[1]) : undefined
        
        // Try to connect to this port
        const instance = await this.checkChromeInstance(port, pid)
        instances.push(instance)
      }
    }

    // Also check common ports
    const commonPorts = [9222, 9223, 9224, 9225, 9226, 9227, 9228, 9229]
    for (const port of commonPorts) {
      // Skip if already found
      if (instances.find(i => i.port === port)) continue
      
      const instance = await this.checkChromeInstance(port)
      if (!instance.error) {
        instances.push(instance)
      }
    }

    // Also check saved session
    try {
      const savedSession = await fetch('http://localhost:9222/json/version')
      if (savedSession.ok) {
        const instance = await this.checkChromeInstance(9222)
        if (!instance.error && !instances.find(i => i.port === 9222)) {
          instances.push(instance)
        }
      }
    } catch (error) {
      // No saved session
    }

    return instances.filter(i => !i.error)
  }

  private async checkChromeInstance(port: number, pid?: number): Promise<ChromeInstance> {
    const instance: ChromeInstance = { port, pid }
    
    try {
      // Try to get version info
      const versionResponse = await fetch(`http://localhost:${port}/json/version`, {
        timeout: 1000
      } as any)
      
      if (versionResponse.ok) {
        const versionData = await versionResponse.json() as any
        instance.version = versionData.Browser || 'Unknown'
        
        // Get tabs/pages
        const tabsResponse = await fetch(`http://localhost:${port}/json/list`)
        if (tabsResponse.ok) {
          instance.tabs = await tabsResponse.json() as any[]
        }
      }
    } catch (error) {
      instance.error = 'Not responding'
    }
    
    return instance
  }

  private displayInstances(instances: ChromeInstance[], verbose: boolean): void {
    if (instances.length === 0) {
      this.log('❌ No Chrome instances with remote debugging found')
      this.log('💡 Start Chrome with: google-chrome --remote-debugging-port=9222')
      return
    }

    this.log(`🔍 Found ${instances.length} Chrome instance(s) with remote debugging:\n`)
    
    for (const instance of instances) {
      this.log(`📍 Port: ${instance.port}`)
      if (instance.pid) {
        this.log(`   PID: ${instance.pid}`)
      }
      if (instance.version) {
        this.log(`   Version: ${instance.version}`)
      }
      if (instance.tabs) {
        this.log(`   Open tabs: ${instance.tabs.length}`)
        if (verbose) {
          for (const tab of instance.tabs) {
            this.log(`     - ${tab.title || 'Untitled'} (${tab.url})`)
          }
        }
      }
      this.log('')
    }

    this.log('💡 To connect: cdp navigate <url> --port <port>')
    this.log('💡 To kill: cdp sessions --kill <port>')
  }

  private async killInstance(port: number): Promise<void> {
    const instances = await this.findChromeInstances()
    const instance = instances.find(i => i.port === port)
    
    if (!instance) {
      this.error(`No Chrome instance found on port ${port}`)
    }

    if (instance.pid) {
      try {
        if (os.platform() === 'win32') {
          execSync(`taskkill /F /PID ${instance.pid}`)
        } else {
          execSync(`kill -9 ${instance.pid}`)
        }
        this.log(`✅ Killed Chrome instance on port ${port} (PID: ${instance.pid})`)
      } catch (error) {
        this.error(`Failed to kill Chrome instance: ${error}`)
      }
    } else {
      this.error(`Could not find PID for Chrome instance on port ${port}`)
    }
  }

  private async killAllInstances(instances: ChromeInstance[]): Promise<void> {
    if (instances.length === 0) {
      this.log('❌ No Chrome instances to kill')
      return
    }

    let killed = 0
    for (const instance of instances) {
      if (instance.pid) {
        try {
          if (os.platform() === 'win32') {
            execSync(`taskkill /F /PID ${instance.pid}`)
          } else {
            execSync(`kill -9 ${instance.pid}`)
          }
          this.log(`✅ Killed Chrome on port ${instance.port} (PID: ${instance.pid})`)
          killed++
        } catch (error) {
          this.log(`❌ Failed to kill Chrome on port ${instance.port}: ${error}`)
        }
      }
    }

    this.log(`\n🧹 Killed ${killed} Chrome instance(s)`)
  }
}