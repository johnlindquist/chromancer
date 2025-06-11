import { Flags } from '@oclif/core'
import { Page, Request, Response } from 'playwright'
import { BaseCommand } from '../base.js'
import { promises as fs } from 'fs'

interface NetworkLog {
  timestamp: string
  method: string
  url: string
  status?: number
  type?: string
  size?: number
  duration?: number
  headers?: Record<string, string>
  postData?: string
  response?: any
}

export default class Network extends BaseCommand {
  static description = 'Advanced network monitoring with request filtering, response capture, performance analysis, and request blocking - debug API calls in real-time'

  static examples = [
    '<%= config.bin %> <%= command.id %> --filter "api"',
    '<%= config.bin %> <%= command.id %> --type xhr --output api-calls.json',
    '<%= config.bin %> <%= command.id %> --method POST --verbose',
    '<%= config.bin %> <%= command.id %> --status 404 --status 500',
    '<%= config.bin %> <%= command.id %> --block "ads" --block "analytics"',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    filter: Flags.string({
      char: 'f',
      description: 'URL filter pattern',
      multiple: true,
    }),
    type: Flags.string({
      char: 't',
      description: 'Resource type filter',
      options: ['document', 'stylesheet', 'image', 'media', 'font', 'script', 'xhr', 'fetch', 'websocket'],
      multiple: true,
    }),
    method: Flags.string({
      char: 'm',
      description: 'HTTP method filter',
      options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
      multiple: true,
    }),
    status: Flags.integer({
      description: 'HTTP status code filter',
      multiple: true,
    }),
    block: Flags.string({
      char: 'b',
      description: 'Block requests matching pattern',
      multiple: true,
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output file for network log',
    }),
    'capture-response': Flags.boolean({
      description: 'Capture response bodies',
      default: false,
    }),
    'live-mode': Flags.boolean({
      description: 'Show requests in real-time',
      default: true,
    }),
    duration: Flags.integer({
      char: 'd',
      description: 'Monitor duration in milliseconds',
      default: 60000, // 1 minute
    }),
  }

  private networkLogs: NetworkLog[] = []
  private requestTimings = new Map<string, number>()

  async run(): Promise<void> {
    const { flags } = await this.parse(Network)
    
    await this.connectToChrome(
      flags.port,
      flags.host,
      flags.launch,
      flags.profile,
      flags.headless,
      flags.verbose,
      true // Always keep open for monitoring
    )
    
    if (!this.page) {
      this.error('Failed to connect to Chrome')
    }

    await this.monitorNetwork(this.page!)
  }

  private async monitorNetwork(page: Page): Promise<void> {
    const { flags } = await this.parse(Network)
    
    this.log('🌐 Network monitoring started...')
    this.log(`Press Ctrl+C to stop (max duration: ${flags.duration}ms)\n`)
    
    // Set up request interception if blocking
    if (flags.block && flags.block.length > 0) {
      await page.route('**/*', async (route) => {
        const url = route.request().url()
        const shouldBlock = flags.block!.some(pattern => url.includes(pattern))
        
        if (shouldBlock) {
          await route.abort()
          if (flags['live-mode']) {
            this.log(`🚫 Blocked: ${url}`)
          }
        } else {
          await route.continue()
        }
      })
    }
    
    // Monitor requests
    page.on('request', (request) => {
      this.requestTimings.set(request.url(), Date.now())
      
      if (this.shouldLogRequest(request)) {
        const log: NetworkLog = {
          timestamp: new Date().toISOString(),
          method: request.method(),
          url: request.url(),
          type: request.resourceType(),
        }
        
        if (flags.verbose || flags['capture-response']) {
          log.headers = request.headers()
          log.postData = request.postData() || undefined
        }
        
        if (flags['live-mode']) {
          this.log(`→ ${request.method()} ${request.url()}`)
        }
        
        this.networkLogs.push(log)
      }
    })
    
    // Monitor responses
    page.on('response', async (response) => {
      const request = response.request()
      
      if (this.shouldLogRequest(request) && this.shouldLogResponse(response)) {
        const startTime = this.requestTimings.get(request.url())
        const duration = startTime ? Date.now() - startTime : undefined
        
        // Find and update the request log
        const logIndex = this.networkLogs.findIndex(
          log => log.url === request.url() && log.method === request.method() && !log.status
        )
        
        if (logIndex !== -1) {
          this.networkLogs[logIndex].status = response.status()
          this.networkLogs[logIndex].duration = duration
          
          try {
            const headers = await response.allHeaders()
            const size = headers['content-length'] ? parseInt(headers['content-length']) : undefined
            this.networkLogs[logIndex].size = size
            
            if (flags['capture-response']) {
              try {
                const contentType = headers['content-type'] || ''
                if (contentType.includes('json') || contentType.includes('text')) {
                  this.networkLogs[logIndex].response = await response.text()
                }
              } catch {
                // Ignore response body errors
              }
            }
          } catch {
            // Ignore header errors
          }
        }
        
        if (flags['live-mode']) {
          const status = response.status()
          const statusIcon = status >= 200 && status < 300 ? '✓' : status >= 400 ? '✗' : '•'
          const sizeStr = this.networkLogs[logIndex]?.size 
            ? ` (${this.formatBytes(this.networkLogs[logIndex].size!)})`
            : ''
          const durationStr = duration ? ` ${duration}ms` : ''
          
          this.log(`← ${statusIcon} ${status} ${request.url()}${sizeStr}${durationStr}`)
        }
      }
    })
    
    // Monitor failed requests
    page.on('requestfailed', (request) => {
      if (this.shouldLogRequest(request)) {
        if (flags['live-mode']) {
          this.log(`✗ Failed: ${request.method()} ${request.url()}`)
        }
        
        const logIndex = this.networkLogs.findIndex(
          log => log.url === request.url() && log.method === request.method() && !log.status
        )
        
        if (logIndex !== -1) {
          this.networkLogs[logIndex].status = 0 // Failed request
        }
      }
    })
    
    // Set up monitoring duration
    const timeout = setTimeout(() => {
      this.stopMonitoring()
    }, flags.duration)
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearTimeout(timeout)
      this.stopMonitoring()
    })
  }

  private shouldLogRequest(request: Request): boolean {
    const { flags } = this.parsedFlags as any
    
    // Filter by URL pattern
    if (flags.filter && flags.filter.length > 0) {
      const url = request.url()
      if (!flags.filter.some((pattern: string) => url.includes(pattern))) {
        return false
      }
    }
    
    // Filter by resource type
    if (flags.type && flags.type.length > 0) {
      if (!flags.type.includes(request.resourceType())) {
        return false
      }
    }
    
    // Filter by method
    if (flags.method && flags.method.length > 0) {
      if (!flags.method.includes(request.method())) {
        return false
      }
    }
    
    return true
  }

  private shouldLogResponse(response: Response): boolean {
    const { flags } = this.parsedFlags as any
    
    // Filter by status code
    if (flags.status && flags.status.length > 0) {
      if (!flags.status.includes(response.status())) {
        return false
      }
    }
    
    return true
  }

  private async stopMonitoring(): Promise<void> {
    const { flags } = this.parsedFlags as any
    
    this.log('\n⏹️  Network monitoring stopped')
    this.log(`Captured ${this.networkLogs.length} requests`)
    
    // Summary statistics
    const stats = this.calculateStats()
    this.log('\n📊 Summary:')
    this.log(`   Total requests: ${stats.total}`)
    this.log(`   Successful: ${stats.successful} (2xx)`)
    this.log(`   Redirects: ${stats.redirects} (3xx)`)
    this.log(`   Client errors: ${stats.clientErrors} (4xx)`)
    this.log(`   Server errors: ${stats.serverErrors} (5xx)`)
    this.log(`   Failed: ${stats.failed}`)
    if (stats.totalSize > 0) {
      this.log(`   Total size: ${this.formatBytes(stats.totalSize)}`)
    }
    if (stats.avgDuration > 0) {
      this.log(`   Average duration: ${stats.avgDuration.toFixed(0)}ms`)
    }
    
    // Save to file if requested
    if (flags.output) {
      await fs.writeFile(flags.output, JSON.stringify(this.networkLogs, null, 2))
      this.log(`\n✅ Network log saved to: ${flags.output}`)
    }
    
    process.exit(0)
  }

  private calculateStats(): any {
    const stats = {
      total: this.networkLogs.length,
      successful: 0,
      redirects: 0,
      clientErrors: 0,
      serverErrors: 0,
      failed: 0,
      totalSize: 0,
      totalDuration: 0,
      avgDuration: 0,
    }
    
    for (const log of this.networkLogs) {
      if (log.status === 0) {
        stats.failed++
      } else if (log.status && log.status >= 200 && log.status < 300) {
        stats.successful++
      } else if (log.status && log.status >= 300 && log.status < 400) {
        stats.redirects++
      } else if (log.status && log.status >= 400 && log.status < 500) {
        stats.clientErrors++
      } else if (log.status && log.status >= 500) {
        stats.serverErrors++
      }
      
      if (log.size) {
        stats.totalSize += log.size
      }
      
      if (log.duration) {
        stats.totalDuration += log.duration
      }
    }
    
    const completedRequests = this.networkLogs.filter(log => log.duration).length
    if (completedRequests > 0) {
      stats.avgDuration = stats.totalDuration / completedRequests
    }
    
    return stats
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  private get parsedFlags() {
    return this.parse(Network).then(result => result.flags)
  }
}