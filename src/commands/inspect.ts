import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base.js'
import { DOMInspector } from '../utils/dom-inspector.js'

export default class Inspect extends BaseCommand {
  static description = 'Inspect page DOM structure to find working selectors'

  static examples = [
    '<%= config.bin %> <%= command.id %> "search results"',
    '<%= config.bin %> <%= command.id %> "product prices" --json',
    '<%= config.bin %> <%= command.id %> "navigation links" --selector "nav"',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    json: Flags.boolean({
      description: 'Output raw JSON inspection data',
      default: false,
    }),
    selector: Flags.string({
      description: 'Limit inspection to elements within this selector',
    }),
  }

  static args = {
    target: Args.string({
      description: 'What you\'re looking for (e.g., "search results", "product titles")',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Inspect)
    
    await this.connectToChrome(
      flags.port,
      flags.host,
      flags.launch,
      flags.profile,
      flags.headless,
      flags.verbose,
      flags.keepOpen
    )
    
    if (!this.page) {
      this.error('No page available')
    }

    this.log(`🔍 Inspecting page for: ${args.target}\n`)

    const inspector = new DOMInspector(this.page!)
    
    // Limit scope if selector provided
    if (flags.selector) {
      try {
        await this.page!.waitForSelector(flags.selector, { timeout: 5000 })
      } catch {
        this.warn(`Selector "${flags.selector}" not found, inspecting entire page`)
      }
    }

    const inspection = await inspector.inspectForDataExtraction(args.target)

    if (flags.json) {
      this.log(JSON.stringify(inspection, null, 2))
      return
    }

    // Display results in readable format
    this.log('📋 Common Patterns Found:')
    if (inspection.selectors.common.length > 0) {
      inspection.selectors.common.slice(0, 5).forEach((sel, i) => {
        this.log(`   ${i + 1}. ${sel}`)
      })
    } else {
      this.log('   No repeated patterns found')
    }

    this.log('\n🏗️  Page Structure:')
    this.log(`   Headings: ${inspection.structure.headings.length}`)
    if (inspection.structure.headings.length > 0) {
      inspection.structure.headings.slice(0, 3).forEach(h => {
        this.log(`     - ${h.level}: "${h.text.substring(0, 50)}${h.text.length > 50 ? '...' : ''}"`)
      })
    }
    
    this.log(`   Links: ${inspection.structure.links.length}`)
    this.log(`   Buttons: ${inspection.structure.buttons.length}`)
    this.log(`   Inputs: ${inspection.structure.inputs.length}`)

    if (inspection.suggestions.length > 0) {
      this.log('\n💡 Suggestions:')
      inspection.suggestions.forEach(s => {
        this.log(`   - ${s}`)
      })
    }

    // Test suggested selectors
    this.log('\n🧪 Testing Selectors:')
    const testSelectors = await inspector.suggestSelectorsForExtraction(args.target)
    
    for (const selector of testSelectors.slice(0, 5)) {
      const count = await this.page!.evaluate((sel) => {
        try {
          return document.querySelectorAll(sel).length
        } catch {
          return 0
        }
      }, selector)
      
      if (count > 0) {
        this.log(`   ✅ "${selector}" - ${count} elements found`)
        
        // Show sample text from first element
        const sampleText = await this.page!.evaluate((sel) => {
          const el = document.querySelector(sel)
          return el?.textContent?.trim().substring(0, 60) || ''
        }, selector).catch(() => '')
        
        if (sampleText) {
          this.log(`      Sample: "${sampleText}${sampleText.length >= 60 ? '...' : ''}"`)
        }
      }
    }
  }
}