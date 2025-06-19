import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../../base.js'

export default class TabsClose extends BaseCommand {
  static description = 'Close browser tabs'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> 0',
    '<%= config.bin %> <%= command.id %> 1 2 3',
    '<%= config.bin %> <%= command.id %> --all',
    '<%= config.bin %> <%= command.id %> --current',
    '<%= config.bin %> <%= command.id %> --url "example.com"',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    all: Flags.boolean({
      description: 'Close all tabs',
      default: false,
    }),
    current: Flags.boolean({
      description: 'Close the current active tab',
      default: false,
    }),
    url: Flags.string({
      description: 'Close tabs matching URL pattern',
    }),
    title: Flags.string({
      description: 'Close tabs matching title pattern',
    }),
    force: Flags.boolean({
      description: 'Force close without confirmation',
      default: false,
    }),
  }

  static args = {
    indices: Args.string({
      description: 'Tab indices to close (space-separated)',
      required: false,
    }),
  }

  static strict = false // Allow multiple arguments

  async run(): Promise<void> {
    const { args, flags, argv } = await this.parse(TabsClose)
    
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
      const context = this.browser!.contexts()[0]
      const pages = context.pages()
      
      if (pages.length === 0) {
        this.log('No tabs to close')
        return
      }

      let tabsToClose: number[] = []

      // Determine which tabs to close
      if (flags.all) {
        tabsToClose = pages.map((_, index) => index)
      } else if (flags.current) {
        const currentIndex = pages.indexOf(this.page!)
        if (currentIndex >= 0) {
          tabsToClose = [currentIndex]
        }
      } else if (flags.url || flags.title) {
        // Filter by URL or title pattern
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i]
          const url = page.url()
          const title = await page.title()
          
          if (flags.url && url.includes(flags.url)) {
            tabsToClose.push(i)
          } else if (flags.title && title.includes(flags.title)) {
            tabsToClose.push(i)
          }
        }
      } else if (argv.length > 0) {
        // Parse indices from arguments
        tabsToClose = argv
          .map(arg => parseInt(arg as string, 10))
          .filter(index => !isNaN(index) && index >= 0 && index < pages.length)
      } else {
        // Default to current tab if no arguments
        const currentIndex = pages.indexOf(this.page!)
        if (currentIndex >= 0) {
          tabsToClose = [currentIndex]
        }
      }

      if (tabsToClose.length === 0) {
        this.log('No matching tabs found to close')
        return
      }

      // Warn if closing all tabs
      if (tabsToClose.length === pages.length && !flags.force) {
        this.warn('This will close all tabs and may exit the browser')
        const { confirm } = await import('@inquirer/prompts')
        const shouldClose = await confirm({
          message: 'Are you sure you want to close all tabs?',
          default: false
        })
        
        if (!shouldClose) {
          this.log('Cancelled')
          return
        }
      }

      // Sort indices in descending order to avoid index shifting
      tabsToClose.sort((a, b) => b - a)

      this.log(`🔌 Closing ${tabsToClose.length} tab(s)...`)

      let closedCount = 0
      for (const index of tabsToClose) {
        try {
          const page = pages[index]
          const title = await page.title()
          const url = page.url()
          
          await page.close()
          closedCount++
          
          this.log(`   ✅ Closed [${index}] ${title || 'Untitled'} - ${url}`)
        } catch (error) {
          this.warn(`   ❌ Failed to close tab ${index}: ${error}`)
        }
      }

      // Update current page reference if it was closed
      const remainingPages = context.pages()
      if (remainingPages.length > 0 && !remainingPages.includes(this.page!)) {
        this.page = remainingPages[0]
        await this.page.bringToFront()
        this.log(`📑 Switched to tab: ${await this.page.title()}`)
      }

      this.log(`✅ Closed ${closedCount} tab(s)`)
      
      if (flags.verbose) {
        this.logVerbose('Close operation summary', {
          requested: tabsToClose.length,
          closed: closedCount,
          remaining: remainingPages.length,
        })
      }
    } catch (error: any) {
      this.error(`Failed to close tabs: ${error.message}`)
    }
  }
}