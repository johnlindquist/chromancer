import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base.js'
import { ProgressIndicator } from '../utils/progress.js'

const chalk = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
}

export default class Quick extends BaseCommand {
  static description = 'Perform comprehensive site testing, capture screenshots, extract data, and run accessibility checks - all with single commands'

  static examples = [
    '<%= config.bin %> <%= command.id %> check example.com',
    '<%= config.bin %> <%= command.id %> capture https://example.com output.png',
    '<%= config.bin %> <%= command.id %> extract https://news.site "article h2"',
  ]

  static args = {
    action: Args.string({
      description: 'Quick action to perform',
      required: true,
      options: ['check', 'capture', 'extract', 'test'],
    }),
    target: Args.string({
      description: 'URL or target for the action',
      required: true,
    }),
    extra: Args.string({
      description: 'Extra parameter (output file, selector, etc)',
    }),
  }

  static flags = {
    ...BaseCommand.baseFlags,
    json: Flags.boolean({
      description: 'Output in JSON format',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Quick)
    
    // Connect to Chrome
    const progress = new ProgressIndicator('Connecting to Chrome...')
    progress.start()
    
    await this.connectToChrome(
      flags.port,
      flags.host,
      flags.launch,
      flags.profile,
      flags.headless,
      flags.verbose,
      flags.keepOpen
    )
    
    progress.stop()
    
    if (!this.page) {
      this.error('Failed to connect to Chrome')
    }

    switch (args.action) {
      case 'check':
        await this.checkSite(args.target)
        break
        
      case 'capture':
        await this.captureSite(args.target, args.extra || 'quick-capture.png')
        break
        
      case 'extract':
        await this.extractData(args.target, args.extra || 'body')
        break
        
      case 'test':
        await this.testSite(args.target)
        break
        
      default:
        this.error(`Unknown action: ${args.action}`)
    }
  }

  private async checkSite(url: string): Promise<void> {
    const progress = new ProgressIndicator('Checking site...')
    progress.start()
    
    try {
      // Navigate
      if (!url.startsWith('http')) {
        url = 'https://' + url
      }
      
      const startTime = Date.now()
      await this.page!.goto(url, { waitUntil: 'load' })
      const loadTime = Date.now() - startTime
      
      // Get page info
      const title = await this.page!.title()
      const metrics = await this.page!.evaluate(() => ({
        links: document.querySelectorAll('a').length,
        images: document.querySelectorAll('img').length,
        scripts: document.querySelectorAll('script').length,
        styles: document.querySelectorAll('link[rel="stylesheet"], style').length,
      }))
      
      progress.stop()
      
      console.log(chalk.green('\n✅ Site is accessible!\n'))
      console.log(`📍 URL: ${chalk.blue(this.page!.url())}`)
      console.log(`📄 Title: ${title}`)
      console.log(`⏱️  Load time: ${loadTime}ms`)
      console.log(`\n📊 Page stats:`)
      console.log(`   • Links: ${metrics.links}`)
      console.log(`   • Images: ${metrics.images}`)
      console.log(`   • Scripts: ${metrics.scripts}`)
      console.log(`   • Styles: ${metrics.styles}`)
      
    } catch (error: any) {
      progress.stop()
      this.error(`Failed to check site: ${error.message}`)
    }
  }

  private async captureSite(url: string, output: string): Promise<void> {
    const progress = new ProgressIndicator('Capturing page...')
    progress.start()
    
    try {
      // Navigate
      if (!url.startsWith('http')) {
        url = 'https://' + url
      }
      
      await this.page!.goto(url, { waitUntil: 'networkidle' })
      progress.update('Taking screenshot...')
      
      // Take screenshot
      await this.page!.screenshot({
        path: output,
        fullPage: true,
      })
      
      progress.stop()
      console.log(chalk.green(`✅ Captured to: ${output}`))
      
    } catch (error: any) {
      progress.stop()
      this.error(`Failed to capture: ${error.message}`)
    }
  }

  private async extractData(url: string, selector: string): Promise<void> {
    const progress = new ProgressIndicator('Extracting data...')
    progress.start()
    
    try {
      // Navigate
      if (!url.startsWith('http')) {
        url = 'https://' + url
      }
      
      await this.page!.goto(url, { waitUntil: 'load' })
      progress.update('Finding elements...')
      
      // Extract data
      const data = await this.page!.evaluate((sel) => {
        const elements = document.querySelectorAll(sel)
        return Array.from(elements).map(el => ({
          text: el.textContent?.trim(),
          tag: el.tagName.toLowerCase(),
          href: (el as any).href,
          src: (el as any).src,
        }))
      }, selector)
      
      progress.stop()
      
      if (data.length === 0) {
        this.warn(`No elements found matching: ${selector}`)
        return
      }
      
      const { flags } = await this.parse(Quick)
      
      if (flags.json) {
        console.log(JSON.stringify(data, null, 2))
      } else {
        console.log(chalk.green(`\n✅ Found ${data.length} elements:\n`))
        data.slice(0, 10).forEach((item, i) => {
          console.log(`${i + 1}. [${chalk.blue(item.tag)}] ${item.text}`)
          if (item.href) console.log(`   ${chalk.gray('→')} ${item.href}`)
        })
        if (data.length > 10) {
          console.log(chalk.gray(`\n... and ${data.length - 10} more`))
        }
      }
      
    } catch (error: any) {
      progress.stop()
      this.error(`Failed to extract: ${error.message}`)
    }
  }

  private async testSite(url: string): Promise<void> {
    console.log(chalk.cyan('\n🧪 Running site tests...\n'))
    
    const tests = [
      { name: 'Accessibility', fn: () => this.testAccessibility(url) },
      { name: 'Performance', fn: () => this.testPerformance(url) },
      { name: 'Mobile View', fn: () => this.testMobile(url) },
      { name: 'Console Errors', fn: () => this.testConsole(url) },
    ]
    
    let passed = 0
    
    for (const test of tests) {
      try {
        const progress = new ProgressIndicator(`Testing ${test.name}...`)
        progress.start()
        const result = await test.fn()
        progress.stop()
        
        if (result.passed) {
          console.log(chalk.green(`✅ ${test.name}: ${result.message}`))
          passed++
        } else {
          console.log(chalk.yellow(`⚠️  ${test.name}: ${result.message}`))
        }
      } catch (error: any) {
        console.log(chalk.red(`❌ ${test.name}: ${error.message}`))
      }
    }
    
    console.log(chalk.cyan(`\n📊 Test Summary: ${passed}/${tests.length} passed\n`))
  }

  private async testAccessibility(url: string): Promise<any> {
    if (!url.startsWith('http')) url = 'https://' + url
    await this.page!.goto(url, { waitUntil: 'load' })
    
    const results = await this.page!.evaluate(() => {
      const issues = []
      
      // Check images for alt text
      const imagesWithoutAlt = document.querySelectorAll('img:not([alt])')
      if (imagesWithoutAlt.length > 0) {
        issues.push(`${imagesWithoutAlt.length} images without alt text`)
      }
      
      // Check headings hierarchy
      const h1Count = document.querySelectorAll('h1').length
      if (h1Count !== 1) {
        issues.push(`${h1Count} H1 tags (should be 1)`)
      }
      
      // Check form labels
      const inputsWithoutLabels = document.querySelectorAll('input:not([aria-label]):not([id])')
      if (inputsWithoutLabels.length > 0) {
        issues.push(`${inputsWithoutLabels.length} inputs without labels`)
      }
      
      return issues
    })
    
    return {
      passed: results.length === 0,
      message: results.length === 0 ? 'No major issues found' : results.join(', ')
    }
  }

  private async testPerformance(url: string): Promise<any> {
    if (!url.startsWith('http')) url = 'https://' + url
    
    const startTime = Date.now()
    await this.page!.goto(url, { waitUntil: 'networkidle' })
    const loadTime = Date.now() - startTime
    
    const metrics = await this.page!.evaluate(() => {
      const perf = (performance as any)
      return {
        resources: performance.getEntriesByType('resource').length,
        jsHeap: perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1048576) : 0,
      }
    })
    
    return {
      passed: loadTime < 3000,
      message: `Load time: ${loadTime}ms, Resources: ${metrics.resources}, JS Heap: ${metrics.jsHeap}MB`
    }
  }

  private async testMobile(url: string): Promise<any> {
    if (!url.startsWith('http')) url = 'https://' + url
    
    // Set mobile viewport
    await this.page!.setViewportSize({ width: 375, height: 667 })
    await this.page!.goto(url, { waitUntil: 'load' })
    
    const results = await this.page!.evaluate(() => {
      const issues = []
      
      // Check viewport meta tag
      const viewport = document.querySelector('meta[name="viewport"]')
      if (!viewport) {
        issues.push('No viewport meta tag')
      }
      
      // Check for horizontal scroll
      if (document.documentElement.scrollWidth > window.innerWidth) {
        issues.push('Horizontal scroll detected')
      }
      
      return issues
    })
    
    // Reset viewport
    await this.page!.setViewportSize({ width: 1280, height: 720 })
    
    return {
      passed: results.length === 0,
      message: results.length === 0 ? 'Mobile-friendly' : results.join(', ')
    }
  }

  private async testConsole(url: string): Promise<any> {
    const errors: string[] = []
    
    this.page!.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    if (!url.startsWith('http')) url = 'https://' + url
    await this.page!.goto(url, { waitUntil: 'load' })
    
    return {
      passed: errors.length === 0,
      message: errors.length === 0 ? 'No console errors' : `${errors.length} console errors`
    }
  }
}