import { Args, Flags } from '@oclif/core'
import { Command } from '@oclif/core'

const chalk = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
}

interface Example {
  title: string
  commands: string[]
  description?: string
}

export default class Examples extends Command {
  static description = 'Show example recipes for common tasks'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> login',
    '<%= config.bin %> <%= command.id %> scraping',
    '<%= config.bin %> <%= command.id %> testing',
  ]

  static args = {
    topic: Args.string({
      description: 'Topic to show examples for',
      options: ['login', 'scraping', 'testing', 'forms', 'automation', 'monitoring'],
    }),
  }

  static flags = {
    list: Flags.boolean({
      char: 'l',
      description: 'List all available topics',
      default: false,
    }),
  }

  private examples: Record<string, Example> = {
    login: {
      title: 'Login & Authentication',
      description: 'Handle login flows and authenticated sessions',
      commands: [
        '# Method 1: Interactive login with profile',
        'chromancer spawn --profile work',
        'chromancer wait-for-login https://github.com/login',
        'chromancer navigate https://github.com/settings',
        '',
        '# Method 2: Automated login with workflow',
        'cat > github-login.yml << EOF',
        '- navigate: https://github.com/login',
        '- type:',
        '    selector: input[name="login"]',
        '    text: ${USERNAME}',
        '- type:',
        '    selector: input[name="password"]',
        '    text: ${PASSWORD}',
        '- click: input[type="submit"]',
        '- wait:',
        '    url: https://github.com',
        'EOF',
        'chromancer run github-login.yml --var USERNAME=you --var PASSWORD=secret',
      ],
    },
    scraping: {
      title: 'Web Scraping',
      description: 'Extract data from websites',
      commands: [
        '# Quick data extraction',
        'chromancer quick extract https://news.ycombinator.com ".titleline a" --json > stories.json',
        '',
        '# Export table data as CSV',
        'chromancer navigate https://example.com/data',
        'chromancer export --format csv --selector "table#results" --output data.csv',
        '',
        '# Complex scraping workflow',
        'cat > scraper.yml << EOF',
        '- navigate: https://example.com/products',
        '- wait: .product-list',
        '- evaluate: |',
        '    Array.from(document.querySelectorAll(".product")).map(p => ({',
        '      name: p.querySelector(".name")?.textContent,',
        '      price: p.querySelector(".price")?.textContent,',
        '      link: p.querySelector("a")?.href',
        '    }))',
        '- export:',
        '    format: json',
        '    output: products.json',
        'EOF',
        'chromancer run scraper.yml',
      ],
    },
    testing: {
      title: 'Testing & Monitoring',
      description: 'Test websites and monitor performance',
      commands: [
        '# Quick site test',
        'chromancer quick test example.com',
        '',
        '# Visual regression test',
        'chromancer navigate https://example.com',
        'chromancer screenshot baseline.png',
        '# ... make changes ...',
        'chromancer screenshot current.png',
        '',
        '# Performance monitoring',
        'chromancer navigate https://example.com',
        'chromancer evaluate "performance.timing" --json > perf.json',
        '',
        '# Network monitoring',
        'chromancer network --filter "api" --type xhr --output api-calls.json',
      ],
    },
    forms: {
      title: 'Form Automation',
      description: 'Fill and submit forms automatically',
      commands: [
        '# Auto-fill with generated data',
        'chromancer navigate https://example.com/signup',
        'chromancer fill --auto-generate --submit',
        '',
        '# Fill with specific data',
        'chromancer fill --data \'{"email": "test@example.com", "name": "Test User"}\'',
        '',
        '# Complex form workflow',
        'cat > form-flow.yml << EOF',
        '- navigate: https://example.com/application',
        '- fill:',
        '    form:',
        '      firstName: John',
        '      lastName: Doe',
        '      email: john@example.com',
        '- select:',
        '    selector: select[name="country"]',
        '    value: US',
        '- click: input[type="checkbox"][name="terms"]',
        '- screenshot: form-complete.png',
        '- click: button[type="submit"]',
        'EOF',
        'chromancer run form-flow.yml',
      ],
    },
    automation: {
      title: 'General Automation',
      description: 'Automate repetitive tasks',
      commands: [
        '# Daily screenshot',
        'chromancer spawn --headless',
        'chromancer run daily-screenshots.yml',
        '',
        '# Batch PDF generation',
        'for url in site1.com site2.com site3.com; do',
        '  chromancer navigate "https://$url"',
        '  chromancer pdf --output "$url.pdf"',
        'done',
        '',
        '# Cookie management',
        'chromancer cookies save --output session.json',
        '# ... later ...',
        'chromancer cookies load --file session.json',
        'chromancer navigate https://example.com/dashboard',
        '',
        '# Record and replay',
        'chromancer record --output actions.json',
        '# ... perform actions in browser ...',
        '# Press Ctrl+C to stop',
        'chromancer record --output actions.js --format js',
      ],
    },
    monitoring: {
      title: 'Monitoring & Alerts',
      description: 'Monitor websites for changes',
      commands: [
        '# Check for content changes',
        'chromancer navigate https://example.com/status',
        'chromancer evaluate "document.querySelector(\'.status\').textContent" > status.txt',
        'diff status.txt previous-status.txt || echo "Status changed!"',
        '',
        '# Monitor for specific text',
        'cat > monitor.yml << EOF',
        '- navigate: https://example.com/products',
        '- wait:',
        '    text: "Out of Stock"',
        '    timeout: 5000',
        '- evaluate: |',
        '    console.log("Item is out of stock!")',
        'EOF',
        'chromancer run monitor.yml --continue-on-error',
        '',
        '# Network performance monitoring',
        'chromancer network --duration 60000 --output network-report.json',
        'cat network-report.json | jq \'.[] | select(.duration > 1000)\'',
      ],
    },
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Examples)
    
    if (flags.list || !args.topic) {
      this.showTopics()
      return
    }
    
    const example = this.examples[args.topic]
    if (!example) {
      this.error(`Unknown topic: ${args.topic}\nRun 'chromancer examples --list' to see available topics`)
    }
    
    this.showExample(args.topic, example)
  }

  private showTopics(): void {
    console.log(chalk.bold('\n📚 Available Example Topics\n'))
    
    Object.entries(this.examples).forEach(([key, example]) => {
      console.log(`${chalk.cyan(key.padEnd(12))} - ${example.title}`)
      if (example.description) {
        console.log(chalk.gray(`${''.padEnd(14)} ${example.description}`))
      }
    })
    
    console.log(chalk.gray('\nRun \'chromancer examples <topic>\' to see examples'))
    console.log()
  }

  private showExample(topic: string, example: Example): void {
    console.log()
    console.log(chalk.bold(chalk.cyan(`📖 ${example.title}`)))
    if (example.description) {
      console.log(chalk.gray(example.description))
    }
    console.log()
    
    let inCodeBlock = false
    
    example.commands.forEach(line => {
      if (line.startsWith('#')) {
        // Comment
        console.log(chalk.green(line))
      } else if (line === '') {
        console.log()
      } else if (line.includes('<<') && line.includes('EOF')) {
        // Start of heredoc
        console.log(chalk.gray(line))
        inCodeBlock = true
      } else if (line === 'EOF') {
        // End of heredoc
        console.log(chalk.gray(line))
        inCodeBlock = false
      } else if (inCodeBlock) {
        // Inside heredoc
        console.log(chalk.yellow(line))
      } else {
        // Command
        console.log(line)
      }
    })
    
    console.log()
    console.log(chalk.gray(`Try more examples: chromancer examples --list`))
    console.log()
  }
}