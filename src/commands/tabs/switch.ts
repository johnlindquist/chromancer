import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../../base.js'

export default class TabsSwitch extends BaseCommand {
  static description = 'Switch between browser tabs'

  static examples = [
    '<%= config.bin %> <%= command.id %> 0',
    '<%= config.bin %> <%= command.id %> next',
    '<%= config.bin %> <%= command.id %> prev',
    '<%= config.bin %> <%= command.id %> last',
    '<%= config.bin %> <%= command.id %> --interactive',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    interactive: Flags.boolean({
      char: 'i',
      description: 'Interactively select a tab to switch to',
      default: false,
    }),
  }

  static args = {
    target: Args.string({
      description: 'Tab index or keyword (next, prev, previous, last, first)',
      required: false,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TabsSwitch)
    
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
        this.log('No tabs available')
        return
      }

      if (pages.length === 1) {
        this.log('Only one tab open')
        return
      }

      const currentIndex = pages.indexOf(this.page!)
      let targetIndex: number

      if (flags.interactive) {
        // Interactive selection
        const tabChoices = await Promise.all(pages.map(async (page, index) => {
          const title = await page.title()
          const url = page.url()
          const isCurrent = index === currentIndex
          
          return {
            name: `${isCurrent ? '▶ ' : '  '}[${index}] ${title || 'Untitled'} - ${url}`,
            value: index,
            short: `[${index}] ${title}`,
          }
        }))

        const { select } = await import('@inquirer/prompts')
        const selectedIndex = await select({
          message: 'Select tab to switch to:',
          choices: tabChoices.map(c => ({ name: c.name, value: c.value })),
          default: currentIndex
        })
        
        targetIndex = selectedIndex
      } else if (!args.target) {
        // Default to next tab
        targetIndex = (currentIndex + 1) % pages.length
      } else {
        // Parse target argument
        const target = args.target.toLowerCase()
        
        switch (target) {
          case 'next':
            targetIndex = (currentIndex + 1) % pages.length
            break
          case 'prev':
          case 'previous':
            targetIndex = currentIndex === 0 ? pages.length - 1 : currentIndex - 1
            break
          case 'first':
            targetIndex = 0
            break
          case 'last':
            targetIndex = pages.length - 1
            break
          default:
            // Try to parse as number
            targetIndex = parseInt(target, 10)
            if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= pages.length) {
              this.error(`Invalid tab target: ${args.target}. Use index (0-${pages.length - 1}) or keyword (next, prev, first, last)`)
            }
        }
      }

      if (targetIndex === currentIndex) {
        this.log('Already on selected tab')
        return
      }

      // Switch to target tab
      const targetPage = pages[targetIndex]
      await targetPage.bringToFront()
      this.page = targetPage

      const title = await targetPage.title()
      const url = targetPage.url()

      this.log(`🔄 Switched to tab [${targetIndex}]`)
      this.log(`   Title: ${title || 'Untitled'}`)
      this.log(`   URL: ${url}`)

      if (flags.verbose) {
        this.logVerbose('Tab switch details', {
          from: currentIndex,
          to: targetIndex,
          totalTabs: pages.length,
          direction: args.target,
        })
      }
    } catch (error: any) {
      this.error(`Failed to switch tabs: ${error.message}`)
    }
  }
}