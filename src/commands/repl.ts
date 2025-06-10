import Interactive from './interactive.js'

export default class Repl extends Interactive {
  static description = 'Alias for interactive command - start an interactive CDP session'
  
  static aliases = ['session']
}