import { Command, Flags } from '@oclif/core'
import puppeteer, { Browser, Page } from 'puppeteer-core'

export abstract class BaseCommand extends Command {
  static baseFlags = {
    port: Flags.integer({
      char: 'p',
      description: 'Chrome debugging port',
      default: 9222,
    }),
    host: Flags.string({
      char: 'h',
      description: 'Chrome debugging host',
      default: 'localhost',
    }),
  }

  protected browser?: Browser
  protected page?: Page

  async connectToChrome(port: number, host: string): Promise<void> {
    try {
      this.browser = await puppeteer.connect({
        browserURL: `http://${host}:${port}`,
        defaultViewport: null,
      })

      const pages = await this.browser.pages()
      this.page = pages[0] || await this.browser.newPage()
    } catch (error) {
      this.error(`Failed to connect to Chrome at ${host}:${port}. Make sure Chrome is running with --remote-debugging-port=${port}`)
    }
  }

  async finally(): Promise<void> {
    if (this.browser) {
      await this.browser.disconnect()
    }
  }
}