import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base.js'
import * as fs from 'fs/promises'
import * as path from 'path'

export default class Screenshot extends BaseCommand {
  static description = 'Take a screenshot of the current page'

  static examples = [
    '<%= config.bin %> <%= command.id %> screenshot.png',
    '<%= config.bin %> <%= command.id %> fullpage.png --full-page',
    '<%= config.bin %> <%= command.id %> element.png --selector ".main-content"',
    '<%= config.bin %> <%= command.id %> mobile.png --viewport 375x667',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    'full-page': Flags.boolean({
      description: 'Capture full scrollable page',
      default: false,
    }),
    format: Flags.string({
      description: 'Screenshot format',
      options: ['png', 'jpeg', 'webp'],
      default: 'png',
    }),
    quality: Flags.integer({
      description: 'Quality (0-100) for JPEG/WebP format',
      default: 80,
    }),
    selector: Flags.string({
      description: 'CSS selector of element to screenshot',
    }),
    'omit-background': Flags.boolean({
      description: 'Make background transparent (PNG only)',
      default: false,
    }),
    viewport: Flags.string({
      description: 'Set viewport size before screenshot (format: widthxheight)',
    }),
    scale: Flags.string({
      description: 'Device scale factor',
      options: ['css', 'device'],
      default: 'device',
    }),
  }

  static args = {
    filename: Args.string({
      description: 'Output filename',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Screenshot)
    
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

    try {
      // Set viewport if specified
      if (flags.viewport) {
        const [width, height] = flags.viewport.split('x').map(n => parseInt(n, 10))
        if (!isNaN(width) && !isNaN(height)) {
          this.log(`📐 Setting viewport to ${width}x${height}`)
          await this.page!.setViewportSize({ width, height })
        } else {
          this.warn('Invalid viewport format, ignoring viewport flag')
        }
      }

      this.log(`📸 Taking screenshot...`)

      // Ensure directory exists
      const dir = path.dirname(args.filename)
      if (dir && dir !== '.') {
        await fs.mkdir(dir, { recursive: true })
      }

      const screenshotOptions: any = {
        path: args.filename,
        fullPage: flags['full-page'],
        type: flags.format as 'png' | 'jpeg' | 'webp',
        scale: flags.scale as 'css' | 'device',
      }

      // Add quality for JPEG/WebP
      if (flags.format === 'jpeg' || flags.format === 'webp') {
        screenshotOptions.quality = flags.quality
      }

      // Add transparent background option for PNG
      if (flags.format === 'png' && flags['omit-background']) {
        screenshotOptions.omitBackground = true
      }

      // Take screenshot of specific element or full page
      if (flags.selector) {
        this.log(`🎯 Capturing element: ${flags.selector}`)
        const element = await this.page!.$(flags.selector)
        if (!element) {
          this.error(`Element not found: ${flags.selector}`)
        }
        await element!.screenshot(screenshotOptions)
      } else {
        await this.page!.screenshot(screenshotOptions)
      }

      const absolutePath = path.resolve(args.filename)
      const stats = await fs.stat(args.filename)
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
      
      this.log(`✅ Screenshot saved to: ${absolutePath}`)
      this.log(`📊 File size: ${sizeMB} MB`)

      // Log screenshot details if verbose
      if (flags.verbose) {
        const pageInfo = await this.page!.evaluate(() => ({
          title: document.title,
          url: window.location.href,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
          documentSize: {
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
          },
        }))
        
        this.logVerbose('Screenshot details', {
          format: flags.format,
          fullPage: flags['full-page'],
          selector: flags.selector || 'page',
          ...pageInfo,
        })
      }
    } catch (error: any) {
      this.error(`Failed to take screenshot: ${error.message}`)
    }
  }
}