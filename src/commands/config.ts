import { Args, Flags } from '@oclif/core'
import { Command } from '@oclif/core'
import { config } from '../utils/config.js'

const chalk = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
}

export default class Config extends Command {
  static description = 'Manage chromancer configuration'

  static examples = [
    '<%= config.bin %> <%= command.id %> get chrome.port',
    '<%= config.bin %> <%= command.id %> set chrome.port 9223',
    '<%= config.bin %> <%= command.id %> set ui.colorOutput false',
    '<%= config.bin %> <%= command.id %> list',
    '<%= config.bin %> <%= command.id %> reset',
  ]

  static args = {
    action: Args.string({
      description: 'Config action',
      required: true,
      options: ['get', 'set', 'list', 'reset', 'path'],
    }),
    key: Args.string({
      description: 'Configuration key (e.g., chrome.port)',
    }),
    value: Args.string({
      description: 'Value to set',
    }),
  }

  static flags = {
    json: Flags.boolean({
      description: 'Output in JSON format',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Config)
    
    switch (args.action) {
      case 'get':
        await this.getConfig(args.key!, flags.json)
        break
        
      case 'set':
        await this.setConfig(args.key!, args.value!)
        break
        
      case 'list':
        await this.listConfig(flags.json)
        break
        
      case 'reset':
        await this.resetConfig()
        break
        
      case 'path':
        this.showPath()
        break
        
      default:
        this.error(`Unknown action: ${args.action}`)
    }
  }

  private async getConfig(key: string, json: boolean): Promise<void> {
    if (!key) {
      this.error('Key is required for get action')
    }
    
    const value = await config.get(key)
    
    if (value === undefined) {
      this.warn(`Configuration key not found: ${key}`)
      return
    }
    
    if (json) {
      console.log(JSON.stringify(value))
    } else {
      console.log(`${chalk.cyan(key)}: ${JSON.stringify(value, null, 2)}`)
    }
  }

  private async setConfig(key: string, value: string): Promise<void> {
    if (!key || !value) {
      this.error('Key and value are required for set action')
    }
    
    // Try to parse value as JSON
    let parsedValue: any = value
    try {
      parsedValue = JSON.parse(value)
    } catch {
      // Keep as string if not valid JSON
    }
    
    await config.set(key, parsedValue)
    console.log(chalk.green(`✅ Set ${key} = ${JSON.stringify(parsedValue)}`))
  }

  private async listConfig(json: boolean): Promise<void> {
    const configData = await config.load()
    
    if (json) {
      console.log(JSON.stringify(configData, null, 2))
    } else {
      console.log(chalk.cyan('\n📋 Current Configuration:\n'))
      this.printConfig(configData)
    }
  }

  private printConfig(obj: any, prefix = ''): void {
    Object.entries(obj).forEach(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        console.log(chalk.blue(`${fullKey}:`))
        this.printConfig(value, fullKey)
      } else {
        console.log(`  ${chalk.gray(fullKey)}: ${JSON.stringify(value)}`)
      }
    })
  }

  private async resetConfig(): Promise<void> {
    console.log(chalk.yellow('⚠️  This will reset all configuration to defaults'))
    
    // Simple confirmation
    console.log('\nPress Enter to confirm or Ctrl+C to cancel')
    await new Promise(resolve => {
      process.stdin.once('data', resolve)
      process.stdin.resume()
    })
    
    await config.reset()
    console.log(chalk.green('✅ Configuration reset to defaults'))
  }

  private showPath(): void {
    console.log(chalk.cyan('📁 Config file location:'))
    console.log(config.getConfigPath())
  }
}