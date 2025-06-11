import { Flags } from '@oclif/core'
import { Page } from 'playwright'
import { BaseCommand } from '../base.js'
import { promises as fs } from 'fs'

interface RecordedAction {
  type: 'click' | 'type' | 'navigate' | 'select' | 'check' | 'scroll'
  selector?: string
  value?: string
  url?: string
  timestamp: number
}

export default class Record extends BaseCommand {
  static description = 'Record browser interactions and generate reusable automation scripts in JSON or JavaScript - perfect for creating test scenarios'

  static examples = [
    '<%= config.bin %> <%= command.id %> --output recording.json',
    '<%= config.bin %> <%= command.id %> --output script.js --format js',
    '<%= config.bin %> <%= command.id %> --duration 30000',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    output: Flags.string({
      char: 'o',
      description: 'Output file for the recording',
      default: 'recording.json',
    }),
    format: Flags.string({
      char: 'f',
      description: 'Output format (json or js)',
      options: ['json', 'js'],
      default: 'json',
    }),
    duration: Flags.integer({
      char: 'd',
      description: 'Maximum recording duration in milliseconds',
      default: 60000, // 1 minute
    }),
  }

  private actions: RecordedAction[] = []
  private startTime: number = Date.now()

  async run(): Promise<void> {
    const { flags } = await this.parse(Record)
    
    await this.connectToChrome(
      flags.port,
      flags.host,
      flags.launch,
      flags.profile,
      flags.headless,
      flags.verbose,
      true // Always keep open for recording
    )
    
    if (!this.page) {
      this.error('Failed to connect to Chrome')
    }

    await this.startRecording(this.page!)
  }

  private async startRecording(page: Page): Promise<void> {
    const { flags } = await this.parse(Record)
    
    this.log('🔴 Recording started. Interact with the page...')
    this.log(`Press Ctrl+C to stop recording (max duration: ${flags.duration}ms)`)
    
    // Track navigation
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        this.actions.push({
          type: 'navigate',
          url: frame.url(),
          timestamp: Date.now() - this.startTime,
        })
      }
    })

    // Inject recording script into every frame
    await page.addInitScript(() => {
      // Store actions in window object
      (window as any).__recordedActions = [];
      
      // Override addEventListener to capture all events
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type: string, listener: any, options: any) {
        if (type === 'click' || type === 'change' || type === 'input') {
          const wrappedListener = function(this: any, event: Event) {
            const target = event.target as HTMLElement;
            
            // Generate selector
            let selector = '';
            if (target.id) {
              selector = `#${target.id}`;
            } else if (target.className) {
              selector = `.${target.className.split(' ')[0]}`;
            } else {
              selector = target.tagName.toLowerCase();
            }
            
            const action: any = {
              type: type,
              selector: selector,
              timestamp: Date.now(),
            };
            
            // Add value for input events
            if (type === 'input' && (target as any).value) {
              action.value = (target as any).value;
            }
            
            // Add selected value for select elements
            if (type === 'change' && target.tagName === 'SELECT') {
              action.value = (target as HTMLSelectElement).value;
            }
            
            (window as any).__recordedActions.push(action);
            
            // Call original listener
            return listener.call(this, event);
          };
          
          return originalAddEventListener.call(this, type, wrappedListener, options);
        }
        
        return originalAddEventListener.call(this, type, listener, options);
      };
    })

    // Set up polling to collect recorded actions
    const pollInterval = setInterval(async () => {
      try {
        const actions = await page.evaluate(() => {
          const recorded = (window as any).__recordedActions || [];
          (window as any).__recordedActions = [];
          return recorded;
        })
        
        // Process and add actions
        for (const action of actions) {
          if (action.type === 'click') {
            this.actions.push({
              type: 'click',
              selector: action.selector,
              timestamp: action.timestamp - this.startTime,
            })
          } else if (action.type === 'input') {
            this.actions.push({
              type: 'type',
              selector: action.selector,
              value: action.value,
              timestamp: action.timestamp - this.startTime,
            })
          } else if (action.type === 'change') {
            this.actions.push({
              type: 'select',
              selector: action.selector,
              value: action.value,
              timestamp: action.timestamp - this.startTime,
            })
          }
        }
      } catch (error) {
        // Page might have navigated, ignore errors
      }
    }, 100)

    // Set up timeout
    const timeout = setTimeout(() => {
      this.stopRecording(pollInterval)
    }, flags.duration)

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearTimeout(timeout)
      this.stopRecording(pollInterval)
    })
  }

  private async stopRecording(pollInterval: NodeJS.Timeout): Promise<void> {
    const { flags } = await this.parse(Record)
    
    clearInterval(pollInterval)
    
    this.log('⏹️  Recording stopped')
    this.log(`Captured ${this.actions.length} actions`)
    
    // Generate output
    let output: string
    
    if (flags.format === 'js') {
      output = this.generateJavaScript()
    } else {
      output = JSON.stringify(this.actions, null, 2)
    }
    
    // Write to file
    await fs.writeFile(flags.output, output)
    this.log(`✅ Recording saved to: ${flags.output}`)
    
    process.exit(0)
  }

  private generateJavaScript(): string {
    const lines = [
      '// Generated by chromancer record',
      '// Run with: node script.js',
      '',
      'const { chromium } = require("playwright");',
      '',
      '(async () => {',
      '  const browser = await chromium.launch({ headless: false });',
      '  const page = await browser.newPage();',
      '',
    ]
    
    let lastTimestamp = 0
    
    for (const action of this.actions) {
      // Add delay if needed
      const delay = action.timestamp - lastTimestamp
      if (delay > 100) {
        lines.push(`  await page.waitForTimeout(${delay});`)
      }
      lastTimestamp = action.timestamp
      
      // Generate action code
      switch (action.type) {
        case 'navigate':
          lines.push(`  await page.goto('${action.url}');`)
          break
        case 'click':
          lines.push(`  await page.click('${action.selector}');`)
          break
        case 'type':
          lines.push(`  await page.fill('${action.selector}', '${action.value}');`)
          break
        case 'select':
          lines.push(`  await page.selectOption('${action.selector}', '${action.value}');`)
          break
      }
    }
    
    lines.push('', '  // await browser.close();', '})();')
    
    return lines.join('\n')
  }
}