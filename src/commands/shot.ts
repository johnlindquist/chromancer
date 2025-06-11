import Screenshot from './screenshot.js'

export default class Shot extends Screenshot {
  static description = 'Alias for screenshot - capture the page'

  static examples = [
    '<%= config.bin %> <%= command.id %> output.png',
    '<%= config.bin %> <%= command.id %> --selector ".main-content"',
  ]

  static args = Screenshot.args
  static flags = Screenshot.flags

  async run(): Promise<void> {
    // Simply run the parent screenshot command
    await super.run()
  }
}