import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

export interface ChromancerConfig {
  chrome?: {
    port?: number
    host?: string
    defaultTimeout?: number
    launchOptions?: {
      headless?: boolean
      args?: string[]
    }
  }
  commands?: {
    screenshot?: {
      path?: string
      fullPage?: boolean
      type?: 'png' | 'jpeg' | 'webp'
    }
    pdf?: {
      path?: string
      format?: string
      landscape?: boolean
    }
    export?: {
      path?: string
      defaultFormat?: string
    }
    record?: {
      outputPath?: string
      maxDuration?: number
    }
  }
  workflows?: {
    continueOnError?: boolean
    variablePrefix?: string
    variableSuffix?: string
    defaultTimeout?: number
  }
  ui?: {
    colorOutput?: boolean
    verboseErrors?: boolean
    showTips?: boolean
    progressIndicators?: boolean
  }
  aliases?: Record<string, string>
}

class ConfigManager {
  private configPath: string
  private config?: ChromancerConfig
  
  constructor() {
    this.configPath = path.join(os.homedir(), '.chromancer.json')
  }
  
  async load(): Promise<ChromancerConfig> {
    if (this.config) {
      return this.config
    }
    
    try {
      const content = await fs.readFile(this.configPath, 'utf-8')
      this.config = JSON.parse(content)
      return this.config!
    } catch (error) {
      // Return default config if file doesn't exist
      this.config = this.getDefaultConfig()
      return this.config
    }
  }
  
  async save(config: ChromancerConfig): Promise<void> {
    this.config = config
    await fs.writeFile(
      this.configPath,
      JSON.stringify(config, null, 2)
    )
  }
  
  async get<T>(path: string, defaultValue?: T): Promise<T | undefined> {
    const config = await this.load()
    
    const keys = path.split('.')
    let value: any = config
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key]
      } else {
        return defaultValue
      }
    }
    
    return value as T
  }
  
  async set(path: string, value: any): Promise<void> {
    const config = await this.load()
    
    const keys = path.split('.')
    let current: any = config
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {}
      }
      current = current[key]
    }
    
    current[keys[keys.length - 1]] = value
    await this.save(config)
  }
  
  private getDefaultConfig(): ChromancerConfig {
    return {
      chrome: {
        port: 9222,
        host: 'localhost',
        defaultTimeout: 30000,
        launchOptions: {
          headless: false,
          args: [],
        },
      },
      commands: {
        screenshot: {
          path: './screenshots',
          fullPage: true,
          type: 'png',
        },
        pdf: {
          path: './pdfs',
          format: 'A4',
          landscape: false,
        },
        export: {
          path: './exports',
          defaultFormat: 'json',
        },
        record: {
          outputPath: './recordings',
          maxDuration: 300000, // 5 minutes
        },
      },
      workflows: {
        continueOnError: false,
        variablePrefix: '${',
        variableSuffix: '}',
        defaultTimeout: 30000,
      },
      ui: {
        colorOutput: true,
        verboseErrors: true,
        showTips: true,
        progressIndicators: true,
      },
      aliases: {
        'g': 'go',
        'n': 'navigate',
        's': 'screenshot',
        'c': 'click',
        't': 'type',
        'w': 'wait',
        'e': 'evaluate',
      },
    }
  }
  
  async reset(): Promise<void> {
    this.config = this.getDefaultConfig()
    await this.save(this.config)
  }
  
  getConfigPath(): string {
    return this.configPath
  }
}

// Singleton instance
export const config = new ConfigManager()

// Helper to apply config to command flags
export async function applyConfigToFlags(command: string, flags: any): Promise<any> {
  const configData = await config.load()
  
  // Apply command-specific config
  const commandConfig = configData.commands?.[command as keyof typeof configData.commands]
  if (commandConfig) {
    Object.entries(commandConfig).forEach(([key, value]) => {
      if (!(key in flags) || flags[key] === undefined) {
        flags[key] = value
      }
    })
  }
  
  // Apply global Chrome config
  if (configData.chrome) {
    if (!flags.port && configData.chrome.port) {
      flags.port = configData.chrome.port
    }
    if (!flags.host && configData.chrome.host) {
      flags.host = configData.chrome.host
    }
  }
  
  return flags
}