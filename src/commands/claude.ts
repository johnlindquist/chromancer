import AI from './ai.js'

export default class Claude extends AI {
  static description = 'Alias for ai command (deprecated - use "ai" instead)'
  static hidden = true
}