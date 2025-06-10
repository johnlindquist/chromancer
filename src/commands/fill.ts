import { Flags } from '@oclif/core'
import { Page } from 'playwright'
import { BaseCommand } from '../base.js'
import { promises as fs } from 'fs'

interface FormData {
  [key: string]: string | boolean | string[]
}

export default class Fill extends BaseCommand {
  static description = 'Fill form fields automatically'

  static examples = [
    '<%= config.bin %> <%= command.id %> --data \'{"username": "john", "email": "john@example.com"}\'',
    '<%= config.bin %> <%= command.id %> --file form-data.json',
    '<%= config.bin %> <%= command.id %> --selector "#login-form" --data \'{"username": "admin", "password": "secret"}\'',
    '<%= config.bin %> <%= command.id %> --auto-generate --submit',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    data: Flags.string({
      char: 'd',
      description: 'JSON data to fill forms with',
      exclusive: ['file', 'auto-generate'],
    }),
    file: Flags.string({
      char: 'f',
      description: 'JSON file containing form data',
      exclusive: ['data', 'auto-generate'],
    }),
    selector: Flags.string({
      char: 's',
      description: 'CSS selector for specific form',
    }),
    'auto-generate': Flags.boolean({
      description: 'Generate random test data for all fields',
      exclusive: ['data', 'file'],
    }),
    submit: Flags.boolean({
      description: 'Submit the form after filling',
      default: false,
    }),
    'wait-after': Flags.integer({
      description: 'Wait time in ms after filling each field',
      default: 100,
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Fill)
    
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

    await this.fillForms(this.page!)
  }

  private async fillForms(page: Page): Promise<void> {
    const { flags } = await this.parse(Fill)
    
    // Get form data
    let formData: FormData = {}
    
    if (flags.data) {
      try {
        formData = JSON.parse(flags.data)
      } catch (error) {
        this.error('Invalid JSON data')
      }
    } else if (flags.file) {
      try {
        const content = await fs.readFile(flags.file, 'utf-8')
        formData = JSON.parse(content)
      } catch (error) {
        this.error(`Failed to read file: ${flags.file}`)
      }
    } else if (flags['auto-generate']) {
      formData = await this.generateTestData(page, flags.selector)
    } else {
      this.error('No form data provided. Use --data, --file, or --auto-generate')
    }
    
    // Fill the form
    const formSelector = flags.selector || 'form'
    
    try {
      // Wait for form to be present
      await page.waitForSelector(formSelector, { timeout: 5000 })
      
      // Fill each field
      for (const [key, value] of Object.entries(formData)) {
        const filled = await this.fillField(page, formSelector, key, value)
        
        if (filled && flags['wait-after'] > 0) {
          await page.waitForTimeout(flags['wait-after'])
        }
      }
      
      this.log('✅ Form filled successfully')
      
      // Submit if requested
      if (flags.submit) {
        await this.submitForm(page, formSelector)
      }
      
    } catch (error: any) {
      this.error(`Failed to fill form: ${error.message}`)
    }
  }

  private async fillField(page: Page, formSelector: string, key: string, value: any): Promise<boolean> {
    const { flags } = await this.parse(Fill)
    
    // Try different strategies to find the field
    const selectors = [
      `${formSelector} [name="${key}"]`,
      `${formSelector} #${key}`,
      `${formSelector} [id="${key}"]`,
      `${formSelector} [data-field="${key}"]`,
      `${formSelector} input[placeholder*="${key}" i]`,
      `${formSelector} label:has-text("${key}") input`,
    ]
    
    for (const selector of selectors) {
      try {
        const element = await page.$(selector)
        if (!element) continue
        
        const tagName = await element.evaluate(el => el.tagName)
        const type = await element.evaluate(el => (el as any).type)
        
        if (tagName === 'INPUT') {
          if (type === 'checkbox' || type === 'radio') {
            if (value === true || value === 'true' || value === '1') {
              await element.check()
              if (flags.verbose) {
                this.logVerbose(`Checked: ${key}`)
              }
            }
          } else if (type === 'file') {
            if (typeof value === 'string') {
              await element.setInputFiles(value)
              if (flags.verbose) {
                this.logVerbose(`Set file: ${key} = ${value}`)
              }
            }
          } else {
            await element.fill(String(value))
            if (flags.verbose) {
              this.logVerbose(`Filled: ${key} = ${value}`)
            }
          }
          return true
        } else if (tagName === 'SELECT') {
          if (Array.isArray(value)) {
            await element.selectOption(value)
          } else {
            await element.selectOption(String(value))
          }
          if (flags.verbose) {
            this.logVerbose(`Selected: ${key} = ${value}`)
          }
          return true
        } else if (tagName === 'TEXTAREA') {
          await element.fill(String(value))
          if (flags.verbose) {
            this.logVerbose(`Filled textarea: ${key}`)
          }
          return true
        }
      } catch (error) {
        // Try next selector
        continue
      }
    }
    
    this.warn(`Could not find field: ${key}`)
    return false
  }

  private async generateTestData(page: Page, formSelector?: string): Promise<FormData> {
    const selector = formSelector || 'form'
    
    return await page.evaluate((sel) => {
      const form = document.querySelector(sel)
      if (!form) throw new Error(`Form not found: ${sel}`)
      
      const data: any = {}
      
      // Generate data based on field types and names
      const generateValue = (element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): any => {
        const name = element.name || element.id
        const type = (element as HTMLInputElement).type || element.tagName.toLowerCase()
        
        // Generate based on common field names
        if (/email/i.test(name)) return 'test@example.com'
        if (/phone|tel/i.test(name)) return '+1234567890'
        if (/name/i.test(name)) {
          if (/first/i.test(name)) return 'John'
          if (/last/i.test(name)) return 'Doe'
          return 'John Doe'
        }
        if (/user/i.test(name)) return 'testuser'
        if (/pass/i.test(name)) return 'TestPass123!'
        if (/age/i.test(name)) return '25'
        if (/date/i.test(name)) return new Date().toISOString().split('T')[0]
        if (/time/i.test(name)) return '12:00'
        if (/url|website/i.test(name)) return 'https://example.com'
        if (/zip|postal/i.test(name)) return '12345'
        if (/address/i.test(name)) return '123 Test Street'
        if (/city/i.test(name)) return 'Test City'
        if (/state/i.test(name)) return 'CA'
        if (/country/i.test(name)) return 'United States'
        if (/message|comment|description|bio/i.test(name)) return 'This is a test message.'
        
        // Generate based on input type
        switch (type) {
          case 'email': return 'test@example.com'
          case 'tel': return '+1234567890'
          case 'url': return 'https://example.com'
          case 'number': return '42'
          case 'date': return new Date().toISOString().split('T')[0]
          case 'time': return '12:00'
          case 'datetime-local': return new Date().toISOString().slice(0, 16)
          case 'month': return new Date().toISOString().slice(0, 7)
          case 'week': return new Date().toISOString().split('T')[0]
          case 'color': return '#3498db'
          case 'range': return '50'
          case 'checkbox': return true
          case 'radio': return true
          case 'select':
          case 'select-one':
            const options = (element as HTMLSelectElement).options
            if (options.length > 1) {
              return options[1].value // Skip first option (often empty)
            }
            return options[0]?.value
          case 'select-multiple':
            const opts = Array.from((element as HTMLSelectElement).options)
            return opts.slice(1, 3).map(o => o.value) // Select first two non-empty options
          case 'textarea': return 'This is test content for the textarea field.'
          default: return 'Test Value'
        }
      }
      
      // Find all form fields
      form.querySelectorAll('input, select, textarea').forEach((field) => {
        const element = field as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        const name = element.name || element.id
        
        if (!name) return
        
        // Skip hidden, submit, button, reset fields
        if ((element as HTMLInputElement).type === 'hidden' ||
            (element as HTMLInputElement).type === 'submit' ||
            (element as HTMLInputElement).type === 'button' ||
            (element as HTMLInputElement).type === 'reset') {
          return
        }
        
        // Skip if already has data for radio buttons
        if ((element as HTMLInputElement).type === 'radio' && data[name]) {
          return
        }
        
        data[name] = generateValue(element)
      })
      
      return data
    }, selector)
  }

  private async submitForm(page: Page, formSelector: string): Promise<void> {
    this.log('📤 Submitting form...')
    
    // Try to find and click submit button
    const submitSelectors = [
      `${formSelector} button[type="submit"]`,
      `${formSelector} input[type="submit"]`,
      `${formSelector} button:has-text("Submit")`,
      `${formSelector} button:has-text("Send")`,
      `${formSelector} button:has-text("Save")`,
      `${formSelector} button:has-text("Continue")`,
    ]
    
    for (const selector of submitSelectors) {
      try {
        const button = await page.$(selector)
        if (button) {
          await button.click()
          this.log('✅ Form submitted')
          return
        }
      } catch (error) {
        // Try next selector
      }
    }
    
    // Fallback: submit via Enter key
    try {
      await page.evaluate((sel) => {
        const form = document.querySelector(sel) as HTMLFormElement
        if (form) {
          form.submit()
        }
      }, formSelector)
      this.log('✅ Form submitted')
    } catch (error: any) {
      this.warn('Could not find submit button')
    }
  }
}