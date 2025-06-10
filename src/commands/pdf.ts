import { Flags } from '@oclif/core'
import { Page } from 'playwright'
import { BaseCommand } from '../base.js'

export default class Pdf extends BaseCommand {
  static description = 'Save page as PDF'

  static examples = [
    '<%= config.bin %> <%= command.id %> --output page.pdf',
    '<%= config.bin %> <%= command.id %> --output report.pdf --format A4',
    '<%= config.bin %> <%= command.id %> --output doc.pdf --landscape --background',
    '<%= config.bin %> <%= command.id %> --output print.pdf --css "@media print"',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    output: Flags.string({
      char: 'o',
      description: 'Output PDF file path',
      default: 'page.pdf',
    }),
    format: Flags.string({
      char: 'f',
      description: 'Page format',
      options: ['Letter', 'Legal', 'Tabloid', 'Ledger', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
      default: 'Letter',
    }),
    landscape: Flags.boolean({
      description: 'Use landscape orientation',
      default: false,
    }),
    scale: Flags.integer({
      description: 'Scale of the webpage rendering (percentage)',
      default: 100,
    }),
    background: Flags.boolean({
      description: 'Print background graphics',
      default: false,
    }),
    'display-header-footer': Flags.boolean({
      description: 'Display header and footer',
      default: false,
    }),
    'header-template': Flags.string({
      description: 'HTML template for header',
    }),
    'footer-template': Flags.string({
      description: 'HTML template for footer',
    }),
    margin: Flags.string({
      description: 'Page margins (e.g., "20px" or "1in 2in 1in 2in")',
    }),
    'page-ranges': Flags.string({
      description: 'Page ranges to print (e.g., "1-5, 8, 11-13")',
    }),
    css: Flags.string({
      description: 'CSS media type to emulate',
    }),
    'wait-for': Flags.string({
      description: 'Wait for selector before generating PDF',
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Pdf)
    
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

    await this.generatePDF(this.page!)
  }

  private async generatePDF(page: Page): Promise<void> {
    const { flags } = await this.parse(Pdf)
    
    try {
      // Wait for specific element if requested
      if (flags['wait-for']) {
        this.log(`⏳ Waiting for: ${flags['wait-for']}`)
        await page.waitForSelector(flags['wait-for'], { timeout: 30000 })
      }
      
      // Emulate CSS media type if specified
      if (flags.css) {
        await page.emulateMedia({ media: flags.css as 'screen' | 'print' })
      }
      
      // Prepare PDF options
      const pdfOptions: any = {
        path: flags.output,
        format: flags.format,
        landscape: flags.landscape,
        printBackground: flags.background,
        displayHeaderFooter: flags['display-header-footer'],
      }
      
      // Scale
      if (flags.scale !== 100) {
        pdfOptions.scale = flags.scale / 100
      }
      
      // Header and footer templates
      if (flags['header-template']) {
        pdfOptions.headerTemplate = flags['header-template']
      }
      if (flags['footer-template']) {
        pdfOptions.footerTemplate = flags['footer-template']
      }
      
      // Margins
      if (flags.margin) {
        const margins = this.parseMargins(flags.margin)
        pdfOptions.margin = margins
      }
      
      // Page ranges
      if (flags['page-ranges']) {
        pdfOptions.pageRanges = flags['page-ranges']
      }
      
      this.log('📄 Generating PDF...')
      
      // Generate PDF
      await page.pdf(pdfOptions)
      
      this.log(`✅ PDF saved to: ${flags.output}`)
      
      // Log details if verbose
      if (flags.verbose) {
        const stats = await this.getFileStats(flags.output)
        this.logVerbose('PDF generated', {
          format: flags.format,
          orientation: flags.landscape ? 'landscape' : 'portrait',
          scale: `${flags.scale}%`,
          fileSize: stats ? `${(stats.size / 1024).toFixed(2)} KB` : 'unknown',
          url: page.url(),
        })
      }
      
    } catch (error: any) {
      this.error(`Failed to generate PDF: ${error.message}`)
    }
  }

  private parseMargins(margin: string): any {
    const parts = margin.trim().split(/\s+/)
    
    if (parts.length === 1) {
      // Single value for all margins
      return {
        top: parts[0],
        right: parts[0],
        bottom: parts[0],
        left: parts[0],
      }
    } else if (parts.length === 2) {
      // Vertical and horizontal
      return {
        top: parts[0],
        right: parts[1],
        bottom: parts[0],
        left: parts[1],
      }
    } else if (parts.length === 4) {
      // Top, right, bottom, left
      return {
        top: parts[0],
        right: parts[1],
        bottom: parts[2],
        left: parts[3],
      }
    } else {
      this.error('Invalid margin format. Use "20px" or "1in 2in 1in 2in"')
    }
  }

  private async getFileStats(path: string): Promise<{ size: number } | null> {
    try {
      const { promises: fs } = await import('fs')
      const stats = await fs.stat(path)
      return { size: stats.size }
    } catch {
      return null
    }
  }
}