import { Flags } from '@oclif/core'
import { BaseCommand } from '../../base.js'

export default class TabsList extends BaseCommand {
  static description = 'List all open tabs in the browser'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --format json',
    '<%= config.bin %> <%= command.id %> --active',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    format: Flags.string({
      description: 'Output format',
      options: ['table', 'json', 'simple'],
      default: 'table',
    }),
    active: Flags.boolean({
      description: 'Show only the active tab',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(TabsList)
    
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
      const pages = this.browser!.contexts()[0].pages()
      
      if (pages.length === 0) {
        this.log('No tabs open')
        return
      }

      // Get tab information
      const tabsInfo = await Promise.all(pages.map(async (page, index) => {
        const url = page.url()
        const title = await page.title()
        const isActive = page === this.page
        
        return {
          index,
          title: title || 'Untitled',
          url,
          isActive,
        }
      }))

      // Filter if only active tab requested
      const displayTabs = flags.active 
        ? tabsInfo.filter(tab => tab.isActive)
        : tabsInfo

      // Display based on format
      switch (flags.format) {
        case 'json':
          this.log(JSON.stringify(displayTabs, null, 2))
          break
          
        case 'simple':
          displayTabs.forEach(tab => {
            const activeMarker = tab.isActive ? '* ' : '  '
            this.log(`${activeMarker}[${tab.index}] ${tab.title}`)
            this.log(`  ${tab.url}`)
          })
          break
          
        case 'table':
        default:
          this.log(`📑 Open tabs: ${tabsInfo.length}`)
          this.log('---')
          displayTabs.forEach(tab => {
            const activeIcon = tab.isActive ? '▶ ' : '  '
            this.log(`${activeIcon}[${tab.index}] ${tab.title}`)
            this.log(`   URL: ${tab.url}`)
            if (tab.isActive) {
              this.log('   Status: Active')
            }
            this.log('')
          })
          break
      }

      if (flags.verbose) {
        this.logVerbose('Tab summary', {
          total: tabsInfo.length,
          activeIndex: tabsInfo.findIndex(tab => tab.isActive),
        })
      }
    } catch (error: any) {
      this.error(`Failed to list tabs: ${error.message}`)
    }
  }
}