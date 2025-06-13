import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../../base.js'

export default class TabsNew extends BaseCommand {
  static description = 'Open a new tab in the browser'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> https://example.com',
    '<%= config.bin %> <%= command.id %> https://example.com --background',
    '<%= config.bin %> <%= command.id %> --incognito',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    background: Flags.boolean({
      description: 'Open tab in background without switching to it',
      default: false,
    }),
    incognito: Flags.boolean({
      description: 'Open tab in incognito/private mode',
      default: false,
    }),
    'wait-for-load': Flags.boolean({
      description: 'Wait for page to load before returning',
      default: true,
    }),
  }

  static args = {
    url: Args.string({
      description: 'URL to open in new tab (defaults to blank page)',
      required: false,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TabsNew)
    
    await this.connectToChrome(
      flags.port,
      flags.host,
      flags.launch,
      flags.profile,
      flags.headless,
      flags.verbose,
      flags.keepOpen
    )
    
    if (!this.browser) {
      this.error('No browser available')
    }

    try {
      const context = flags.incognito 
        ? await this.browser!.newContext({ 
            acceptDownloads: true,
            viewport: null,
          })
        : this.browser!.contexts()[0]

      this.log('🆕 Opening new tab...')
      
      const newPage = await context.newPage()
      
      // Navigate to URL if provided
      if (args.url) {
        this.log(`📍 Navigating to: ${args.url}`)
        
        if (flags['wait-for-load']) {
          await newPage.goto(args.url, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
          })
        } else {
          newPage.goto(args.url).catch(() => {
            // Ignore navigation errors in non-waiting mode
          })
        }
      }

      // Switch to new tab unless background flag is set
      if (!flags.background) {
        await newPage.bringToFront()
        // Update the page reference in base command
        this.page = newPage
        this.log('✅ Switched to new tab')
      } else {
        this.log('✅ New tab opened in background')
      }

      // Get tab info
      const title = await newPage.title()
      const url = newPage.url()
      const tabIndex = context.pages().indexOf(newPage)

      this.log(`📑 Tab info:`)
      this.log(`   Index: ${tabIndex}`)
      this.log(`   Title: ${title || 'Untitled'}`)
      this.log(`   URL: ${url}`)
      
      if (flags.incognito) {
        this.log('   Mode: Incognito')
      }

      if (flags.verbose) {
        this.logVerbose('New tab details', {
          index: tabIndex,
          title,
          url,
          background: flags.background,
          incognito: flags.incognito,
          totalTabs: context.pages().length,
        })
      }
    } catch (error: any) {
      this.error(`Failed to open new tab: ${error.message}`)
    }
  }
}