import { Flags } from '@oclif/core'
import { BaseCommand } from '../base.js'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

const chalk = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
}

export default class Init extends BaseCommand {
  static description = 'Initialize chromancer and set up your environment'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --skip-chrome-check',
    '<%= config.bin %> <%= command.id %> --example-workflows',
  ]

  static flags = {
    'skip-chrome-check': Flags.boolean({
      description: 'Skip Chrome connectivity check',
      default: false,
    }),
    'example-workflows': Flags.boolean({
      description: 'Create example workflow files',
      default: false,
    }),
    'config-only': Flags.boolean({
      description: 'Only create config file',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Init)
    
    this.showWelcome()
    
    // Step 1: Check Chrome
    if (!flags['skip-chrome-check'] && !flags['config-only']) {
      await this.checkChrome()
    }
    
    // Step 2: Create config
    await this.createConfig()
    
    // Step 3: Create examples if requested
    if (flags['example-workflows']) {
      await this.createExamples()
    }
    
    // Step 4: Show next steps
    this.showNextSteps()
  }

  private showWelcome(): void {
    console.log()
    console.log(chalk.bold(chalk.cyan('🧙 Welcome to Chromancer!')))
    console.log(chalk.gray('The magical Chrome automation tool'))
    console.log()
    console.log('This wizard will help you:')
    console.log('  • Check Chrome connectivity')
    console.log('  • Create a configuration file')
    console.log('  • Set up example workflows')
    console.log()
  }

  private async checkChrome(): Promise<void> {
    this.log(chalk.blue('📡 Checking Chrome connectivity...'))
    
    try {
      // Try default port
      await this.connectToChrome(9222, 'localhost', false)
      this.log(chalk.green('✅ Chrome is running and accessible on port 9222'))
    } catch (error) {
      this.log(chalk.yellow('⚠️  Chrome is not running or not accessible'))
      this.log()
      this.log('To start Chrome with remote debugging:')
      this.log()
      this.log(chalk.gray('  # Option 1: Use chromancer'))
      this.log('  chromancer spawn --headless')
      this.log()
      this.log(chalk.gray('  # Option 2: Start Chrome manually'))
      this.log('  chrome --remote-debugging-port=9222')
      this.log()
      this.log(chalk.gray('  # Option 3: Use Docker'))
      this.log('  docker run -d -p 9222:9222 zenika/alpine-chrome \\')
      this.log('    --no-sandbox --remote-debugging-host=0.0.0.0 --remote-debugging-port=9222')
      this.log()
    }
  }

  private async createConfig(): Promise<void> {
    const configPath = path.join(os.homedir(), '.chromancer.json')
    
    // Check if config exists
    try {
      await fs.access(configPath)
      this.log(chalk.yellow(`⚠️  Config file already exists: ${configPath}`))
      return
    } catch {
      // File doesn't exist, create it
    }
    
    const defaultConfig = {
      chrome: {
        port: 9222,
        host: 'localhost',
        defaultTimeout: 30000,
      },
      commands: {
        screenshot: {
          path: './screenshots',
          fullPage: true,
        },
        pdf: {
          path: './pdfs',
          format: 'A4',
        },
        export: {
          path: './exports',
        },
      },
      workflows: {
        continueOnError: false,
        variablePrefix: '${',
        variableSuffix: '}',
      },
      ui: {
        colorOutput: true,
        verboseErrors: true,
        showTips: true,
      },
    }
    
    await fs.writeFile(
      configPath,
      JSON.stringify(defaultConfig, null, 2)
    )
    
    this.log(chalk.green(`✅ Created config file: ${configPath}`))
    this.log(chalk.gray('   You can edit this file to customize chromancer behavior'))
  }

  private async createExamples(): Promise<void> {
    const examplesDir = path.join(process.cwd(), 'chromancer-examples')
    
    try {
      await fs.mkdir(examplesDir, { recursive: true })
    } catch (error) {
      this.warn('Could not create examples directory')
      return
    }
    
    // Create a simple example
    const simpleExample = `# Simple workflow example
# Run with: chromancer run simple.yml

- navigate: https://example.com
- wait:
    selector: h1
    timeout: 5000
- screenshot: example-home.png
- click: a[href*="more"]
- wait: 
    time: 2000
- screenshot: example-more.png
`
    
    await fs.writeFile(
      path.join(examplesDir, 'simple.yml'),
      simpleExample
    )
    
    // Create a form example
    const formExample = `# Form automation example
# Run with: chromancer run form.yml --var EMAIL=test@example.com

- navigate: https://example.com/contact
- wait:
    selector: form
- fill:
    form:
      name: "Test User"
      email: \${EMAIL}
      message: "This is an automated test"
- screenshot: form-filled.png
# Uncomment to submit:
# - click: button[type="submit"]
`
    
    await fs.writeFile(
      path.join(examplesDir, 'form.yml'),
      formExample
    )
    
    // Create a scraping example
    const scrapingExample = `# Web scraping example
# Run with: chromancer run scraping.yml

- navigate: https://news.ycombinator.com
- wait:
    selector: .itemlist
- evaluate: |
    // Extract top stories
    Array.from(document.querySelectorAll('.athing')).slice(0, 10).map(item => ({
      title: item.querySelector('.titleline a')?.textContent,
      link: item.querySelector('.titleline a')?.href,
      rank: item.querySelector('.rank')?.textContent
    }))
- export:
    format: json
    output: hn-stories.json
`
    
    await fs.writeFile(
      path.join(examplesDir, 'scraping.yml'),
      scrapingExample
    )
    
    this.log(chalk.green(`✅ Created example workflows in: ${examplesDir}`))
    this.log(chalk.gray('   • simple.yml    - Basic navigation'))
    this.log(chalk.gray('   • form.yml      - Form automation'))
    this.log(chalk.gray('   • scraping.yml  - Data extraction'))
  }

  private showNextSteps(): void {
    console.log()
    console.log(chalk.bold(chalk.green('🎉 Setup complete!')))
    console.log()
    console.log('Next steps:')
    console.log()
    console.log('1. Start Chrome (if not running):')
    console.log(chalk.cyan('   chromancer spawn'))
    console.log()
    console.log('2. Try a simple command:')
    console.log(chalk.cyan('   chromancer navigate https://example.com'))
    console.log(chalk.cyan('   chromancer screenshot example.png'))
    console.log()
    console.log('3. Run a workflow:')
    console.log(chalk.cyan('   chromancer run chromancer-examples/simple.yml'))
    console.log()
    console.log('4. Explore more commands:')
    console.log(chalk.cyan('   chromancer --help'))
    console.log()
    console.log(chalk.gray('📚 Full documentation: https://chromancer.dev'))
    console.log()
  }
}