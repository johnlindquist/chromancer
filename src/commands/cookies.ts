import { Args, Flags } from '@oclif/core'
import { Page, Cookie } from 'playwright'
import { BaseCommand } from '../base.js'
import { promises as fs } from 'fs'

export default class Cookies extends BaseCommand {
  static description = 'Manage browser cookies'

  static examples = [
    '<%= config.bin %> <%= command.id %> list',
    '<%= config.bin %> <%= command.id %> get sessionId',
    '<%= config.bin %> <%= command.id %> set name=value',
    '<%= config.bin %> <%= command.id %> delete sessionId',
    '<%= config.bin %> <%= command.id %> clear',
    '<%= config.bin %> <%= command.id %> save --output cookies.json',
    '<%= config.bin %> <%= command.id %> load --file cookies.json',
  ]

  static args = {
    action: Args.string({
      description: 'Cookie action',
      options: ['list', 'get', 'set', 'delete', 'clear', 'save', 'load'],
      required: true,
    }),
    value: Args.string({
      description: 'Cookie name or name=value pair',
    }),
  }

  static flags = {
    ...BaseCommand.baseFlags,
    output: Flags.string({
      char: 'o',
      description: 'Output file for save action',
      default: 'cookies.json',
    }),
    file: Flags.string({
      char: 'f',
      description: 'Input file for load action',
    }),
    domain: Flags.string({
      description: 'Cookie domain',
    }),
    path: Flags.string({
      description: 'Cookie path',
      default: '/',
    }),
    secure: Flags.boolean({
      description: 'Secure cookie flag',
      default: false,
    }),
    httpOnly: Flags.boolean({
      description: 'HttpOnly cookie flag',
      default: false,
    }),
    sameSite: Flags.string({
      description: 'SameSite cookie attribute',
      options: ['Strict', 'Lax', 'None'],
    }),
    expires: Flags.integer({
      description: 'Cookie expiration timestamp',
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Cookies)
    
    await this.connectToChrome(
      flags.port,
      flags.host,
      flags.launch,
      flags.profile,
      flags.headless,
      flags.verbose,
      flags.keepOpen
    )
    
    if (!this.page || !this.context) {
      this.error('Failed to connect to Chrome')
    }

    await this.manageCookies(this.page!, args.action, args.value)
  }

  private async manageCookies(page: Page, action: string, value?: string): Promise<void> {
    const { flags } = await this.parse(Cookies)
    
    switch (action) {
      case 'list':
        await this.listCookies(page)
        break
        
      case 'get':
        if (!value) this.error('Cookie name required for get action')
        await this.getCookie(page, value)
        break
        
      case 'set':
        if (!value) this.error('Cookie data required for set action (name=value)')
        await this.setCookie(page, value)
        break
        
      case 'delete':
        if (!value) this.error('Cookie name required for delete action')
        await this.deleteCookie(page, value)
        break
        
      case 'clear':
        await this.clearCookies(page)
        break
        
      case 'save':
        await this.saveCookies(page, flags.output)
        break
        
      case 'load':
        if (!flags.file) this.error('File path required for load action (use --file)')
        await this.loadCookies(page, flags.file)
        break
        
      default:
        this.error(`Unknown action: ${action}`)
    }
  }

  private async listCookies(page: Page): Promise<void> {
    const cookies = await this.context!.cookies()
    
    if (cookies.length === 0) {
      this.log('No cookies found')
      return
    }
    
    this.log(`Found ${cookies.length} cookies:\n`)
    
    for (const cookie of cookies) {
      this.log(`🍪 ${cookie.name}`)
      this.log(`   Value: ${cookie.value}`)
      this.log(`   Domain: ${cookie.domain}`)
      this.log(`   Path: ${cookie.path}`)
      if (cookie.expires && cookie.expires > 0) {
        this.log(`   Expires: ${new Date(cookie.expires * 1000).toISOString()}`)
      }
      if (cookie.secure) this.log('   Secure: ✓')
      if (cookie.httpOnly) this.log('   HttpOnly: ✓')
      if (cookie.sameSite) this.log(`   SameSite: ${cookie.sameSite}`)
      this.log('')
    }
  }

  private async getCookie(page: Page, name: string): Promise<void> {
    const { flags } = await this.parse(Cookies)
    const cookies = await this.context!.cookies()
    const cookie = cookies.find(c => c.name === name)
    
    if (!cookie) {
      this.error(`Cookie not found: ${name}`)
    }
    
    this.log(`🍪 ${cookie.name} = ${cookie.value}`)
    
    if (flags.verbose) {
      this.logVerbose('Cookie details', {
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expires: cookie.expires ? new Date(cookie.expires * 1000).toISOString() : 'Session',
      })
    }
  }

  private async setCookie(page: Page, value: string): Promise<void> {
    const { flags } = await this.parse(Cookies)
    
    // Parse name=value format
    const [name, ...valueParts] = value.split('=')
    if (!name || valueParts.length === 0) {
      this.error('Invalid cookie format. Use: name=value')
    }
    
    const cookieValue = valueParts.join('=') // Handle values with = in them
    
    // Get current URL for domain
    const url = page.url()
    const urlObj = new URL(url)
    
    const cookie: Cookie = {
      name: name.trim(),
      value: cookieValue.trim(),
      domain: flags.domain || urlObj.hostname,
      path: flags.path,
      secure: flags.secure,
      httpOnly: flags.httpOnly,
      sameSite: flags.sameSite as 'Strict' | 'Lax' | 'None',
      expires: flags.expires || -1, // -1 means session cookie
    }
    
    await this.context!.addCookies([cookie])
    this.log(`✅ Cookie set: ${name}`)
    
    if (flags.verbose) {
      this.logVerbose('Cookie set', cookie)
    }
  }

  private async deleteCookie(page: Page, name: string): Promise<void> {
    const cookies = await this.context!.cookies()
    const cookie = cookies.find(c => c.name === name)
    
    if (!cookie) {
      this.warn(`Cookie not found: ${name}`)
      return
    }
    
    // Delete by setting expiration to past
    await this.context!.addCookies([{
      ...cookie,
      expires: 0,
    }])
    
    this.log(`✅ Cookie deleted: ${name}`)
  }

  private async clearCookies(page: Page): Promise<void> {
    const cookies = await this.context!.cookies()
    
    if (cookies.length === 0) {
      this.log('No cookies to clear')
      return
    }
    
    await this.context!.clearCookies()
    this.log(`✅ Cleared ${cookies.length} cookies`)
  }

  private async saveCookies(page: Page, outputPath: string): Promise<void> {
    const cookies = await this.context!.cookies()
    
    if (cookies.length === 0) {
      this.warn('No cookies to save')
      return
    }
    
    await fs.writeFile(outputPath, JSON.stringify(cookies, null, 2))
    this.log(`✅ Saved ${cookies.length} cookies to: ${outputPath}`)
  }

  private async loadCookies(page: Page, filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const cookies = JSON.parse(content) as Cookie[]
      
      if (!Array.isArray(cookies)) {
        this.error('Invalid cookie file format')
      }
      
      await this.context!.addCookies(cookies)
      this.log(`✅ Loaded ${cookies.length} cookies from: ${filePath}`)
      
    } catch (error: any) {
      this.error(`Failed to load cookies: ${error.message}`)
    }
  }
}