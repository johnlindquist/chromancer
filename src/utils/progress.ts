export class ProgressIndicator {
  private spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  private currentIndex = 0
  private interval?: NodeJS.Timeout
  private message: string
  
  constructor(message: string) {
    this.message = message
  }
  
  start(): void {
    this.interval = setInterval(() => {
      process.stdout.write(`\r${this.spinner[this.currentIndex]} ${this.message}`)
      this.currentIndex = (this.currentIndex + 1) % this.spinner.length
    }, 80)
  }
  
  update(message: string): void {
    this.message = message
  }
  
  stop(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval)
      process.stdout.write('\r' + ' '.repeat(this.message.length + 3) + '\r')
      if (finalMessage) {
        console.log(finalMessage)
      }
    }
  }
}

export class ProgressBar {
  private width: number
  private total: number
  private current = 0
  private description: string
  
  constructor(description: string, total: number, width = 30) {
    this.description = description
    this.total = total
    this.width = width
  }
  
  update(current: number): void {
    this.current = Math.min(current, this.total)
    this.render()
  }
  
  increment(): void {
    this.update(this.current + 1)
  }
  
  private render(): void {
    const percent = this.current / this.total
    const filled = Math.floor(this.width * percent)
    const empty = this.width - filled
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty)
    const percentStr = `${Math.floor(percent * 100)}%`
    
    process.stdout.write(
      `\r${this.description} [${bar}] ${percentStr} (${this.current}/${this.total})`
    )
    
    if (this.current === this.total) {
      console.log() // New line when complete
    }
  }
  
  complete(message?: string): void {
    this.update(this.total)
    if (message) {
      console.log(message)
    }
  }
}