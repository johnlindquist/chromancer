import { Args, Flags } from '@oclif/core'
import { Page } from 'playwright'
import { BaseCommand } from '../base.js'

export default class Scroll extends BaseCommand {
  static description = 'Scroll the page or to specific elements'

  static examples = [
    '<%= config.bin %> <%= command.id %> down',
    '<%= config.bin %> <%= command.id %> top',
    '<%= config.bin %> <%= command.id %> bottom',
    '<%= config.bin %> <%= command.id %> --to "#section3"',
    '<%= config.bin %> <%= command.id %> --by 500',
    '<%= config.bin %> <%= command.id %> --percent 50',
  ]

  static args = {
    direction: Args.string({
      description: 'Scroll direction',
      options: ['up', 'down', 'left', 'right', 'top', 'bottom'],
    }),
  }

  static flags = {
    ...BaseCommand.baseFlags,
    to: Flags.string({
      char: 't',
      description: 'CSS selector to scroll to',
      exclusive: ['by', 'percent'],
    }),
    by: Flags.integer({
      char: 'b',
      description: 'Pixels to scroll by',
      exclusive: ['to', 'percent'],
    }),
    percent: Flags.integer({
      char: 'p',
      description: 'Percentage of page to scroll to (0-100)',
      exclusive: ['to', 'by'],
    }),
    smooth: Flags.boolean({
      description: 'Use smooth scrolling',
      default: true,
    }),
    'wait-after': Flags.integer({
      description: 'Wait time in ms after scrolling',
      default: 500,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Scroll)
    
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
      this.error('Failed to connect to Chrome')
    }

    await this.performScroll(this.page!)
  }

  private async performScroll(page: Page): Promise<void> {
    const { args, flags } = await this.parse(Scroll)
    
    const behavior = flags.smooth ? 'smooth' : 'auto'
    
    try {
      // Scroll to element
      if (flags.to) {
        await page.evaluate(({ selector, behavior }) => {
          const element = document.querySelector(selector)
          if (!element) throw new Error(`Element not found: ${selector}`)
          
          element.scrollIntoView({ behavior: behavior as ScrollBehavior, block: 'center' })
        }, { selector: flags.to, behavior })
        
        this.log(`✅ Scrolled to element: ${flags.to}`)
      }
      // Scroll by pixels
      else if (flags.by) {
        const direction = args.direction || 'down'
        let x = 0, y = 0
        
        switch (direction) {
          case 'up':
            y = -flags.by
            break
          case 'down':
            y = flags.by
            break
          case 'left':
            x = -flags.by
            break
          case 'right':
            x = flags.by
            break
          default:
            y = flags.by // Default to down
        }
        
        await page.evaluate(({ x, y, behavior }) => {
          window.scrollBy({ left: x, top: y, behavior: behavior as ScrollBehavior })
        }, { x, y, behavior })
        
        this.log(`✅ Scrolled ${direction} by ${flags.by}px`)
      }
      // Scroll to percentage
      else if (flags.percent !== undefined) {
        if (flags.percent < 0 || flags.percent > 100) {
          this.error('Percentage must be between 0 and 100')
        }
        
        await page.evaluate(({ percent, behavior }) => {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight
          const targetScroll = (maxScroll * percent) / 100
          
          window.scrollTo({ top: targetScroll, behavior: behavior as ScrollBehavior })
        }, { percent: flags.percent, behavior })
        
        this.log(`✅ Scrolled to ${flags.percent}% of page`)
      }
      // Scroll by direction
      else if (args.direction) {
        switch (args.direction) {
          case 'top':
            await page.evaluate(({ behavior }) => {
              window.scrollTo({ top: 0, behavior: behavior as ScrollBehavior })
            }, { behavior })
            this.log('✅ Scrolled to top')
            break
            
          case 'bottom':
            await page.evaluate(({ behavior }) => {
              window.scrollTo({ 
                top: document.documentElement.scrollHeight, 
                behavior: behavior as ScrollBehavior 
              })
            }, { behavior })
            this.log('✅ Scrolled to bottom')
            break
            
          case 'up':
            await page.evaluate(({ behavior }) => {
              window.scrollBy({ top: -window.innerHeight * 0.8, behavior: behavior as ScrollBehavior })
            }, { behavior })
            this.log('✅ Scrolled up')
            break
            
          case 'down':
            await page.evaluate(({ behavior }) => {
              window.scrollBy({ top: window.innerHeight * 0.8, behavior: behavior as ScrollBehavior })
            }, { behavior })
            this.log('✅ Scrolled down')
            break
            
          case 'left':
            await page.evaluate(({ behavior }) => {
              window.scrollBy({ left: -window.innerWidth * 0.8, behavior: behavior as ScrollBehavior })
            }, { behavior })
            this.log('✅ Scrolled left')
            break
            
          case 'right':
            await page.evaluate(({ behavior }) => {
              window.scrollBy({ left: window.innerWidth * 0.8, behavior: behavior as ScrollBehavior })
            }, { behavior })
            this.log('✅ Scrolled right')
            break
        }
      }
      // Default: scroll down one viewport
      else {
        await page.evaluate(({ behavior }) => {
          window.scrollBy({ top: window.innerHeight * 0.8, behavior: behavior as ScrollBehavior })
        }, { behavior })
        this.log('✅ Scrolled down')
      }
      
      // Wait after scrolling
      if (flags['wait-after'] > 0) {
        await page.waitForTimeout(flags['wait-after'])
      }
      
      // Log current position if verbose
      if (flags.verbose) {
        const position = await page.evaluate(() => ({
          x: window.pageXOffset,
          y: window.pageYOffset,
          maxX: document.documentElement.scrollWidth - window.innerWidth,
          maxY: document.documentElement.scrollHeight - window.innerHeight,
        }))
        
        this.logVerbose('Scroll position', {
          x: `${position.x}/${position.maxX}`,
          y: `${position.y}/${position.maxY}`,
          percentX: Math.round((position.x / position.maxX) * 100) || 0,
          percentY: Math.round((position.y / position.maxY) * 100) || 0,
        })
      }
      
    } catch (error: any) {
      this.error(`Failed to scroll: ${error.message}`)
    }
  }
}