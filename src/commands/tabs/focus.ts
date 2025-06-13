import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../../base.js'

export default class TabsFocus extends BaseCommand {
  static description = 'Focus a specific tab by URL or title pattern'

  static examples = [
    '<%= config.bin %> <%= command.id %> "example.com"',
    '<%= config.bin %> <%= command.id %> "My Document" --title',
    '<%= config.bin %> <%= command.id %> "github.com" --exact',
    '<%= config.bin %> <%= command.id %> --interactive',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    title: Flags.boolean({
      description: 'Search by title instead of URL',
      default: false,
    }),
    exact: Flags.boolean({
      description: 'Require exact match instead of partial',
      default: false,
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Interactively select from matching tabs',
      default: false,
    }),
  }

  static args = {
    pattern: Args.string({
      description: 'Pattern to match against URL or title',
      required: false,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TabsFocus)
    
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

      // Get tab information with search field
      const tabsInfo = await Promise.all(pages.map(async (page, index) => {
        const url = page.url()
        const title = await page.title()
        const searchField = flags.title ? title : url
        
        return {
          index,
          page,
          title: title || 'Untitled',
          url,
          searchField,
          isActive: page === this.page,
        }
      }))

      let matchingTabs = tabsInfo

      // Filter by pattern if provided
      if (args.pattern && !flags.interactive) {
        const pattern = args.pattern.toLowerCase()
        
        matchingTabs = tabsInfo.filter(tab => {
          const field = tab.searchField.toLowerCase()
          return flags.exact 
            ? field === pattern
            : field.includes(pattern)
        })

        if (matchingTabs.length === 0) {
          this.error(`No tabs found matching "${args.pattern}" in ${flags.title ? 'title' : 'URL'}`)
        }
      }

      // Select target tab
      let targetTab

      if (flags.interactive || matchingTabs.length > 1) {
        // Interactive selection or multiple matches
        const choices = matchingTabs.map(tab => ({
          name: `${tab.isActive ? '▶ ' : '  '}[${tab.index}] ${tab.title} - ${tab.url}`,
          value: tab,
          short: `[${tab.index}] ${tab.title}`,
        }))

        const inquirer = await import('inquirer')
        const { selected } = await inquirer.default.prompt([
          {
            type: 'list',
            name: 'selected',
            message: matchingTabs.length > 1 
              ? `Found ${matchingTabs.length} matching tabs. Select one:`
              : 'Select tab to focus:',
            choices,
            pageSize: 10,
          },
        ])
        
        targetTab = selected
      } else if (matchingTabs.length === 1) {
        targetTab = matchingTabs[0]
      } else {
        this.error('No pattern provided. Use --interactive flag or provide a search pattern')
      }

      // Check if already on target tab
      if (targetTab.isActive) {
        this.log('Already focused on selected tab')
        return
      }

      // Focus the target tab
      await targetTab.page.bringToFront()
      this.page = targetTab.page

      this.log(`🎯 Focused tab [${targetTab.index}]`)
      this.log(`   Title: ${targetTab.title}`)
      this.log(`   URL: ${targetTab.url}`)

      if (flags.verbose) {
        this.logVerbose('Focus operation details', {
          pattern: args.pattern,
          searchField: flags.title ? 'title' : 'url',
          matchesFound: matchingTabs.length,
          selectedIndex: targetTab.index,
        })
      }
    } catch (error: any) {
      this.error(`Failed to focus tab: ${error.message}`)
    }
  }
}