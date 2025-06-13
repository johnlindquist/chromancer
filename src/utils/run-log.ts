import type { WorkflowExecutionResult, WorkflowStepResult } from '../types/workflow.js'
import { DOMDigest } from './dom-digest.js'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

export interface StepLog {
  n: number
  cmd: string
  ok: boolean
  why?: string
  selector?: string
  digest?: {
    count: number
    samples?: string[]
  }
  duration: number
}

export interface RunLog {
  id: string
  workflowId?: string
  timestamp: number
  url: string
  steps: StepLog[]
  elapsedMs: number
  domDigest?: DOMDigest
  claudeAnalysis?: any
  success: boolean
  failureReason?: string
}

export class RunLogManager {
  private logsDir: string

  constructor(baseDir: string = '.chromancer') {
    this.logsDir = path.join(baseDir, 'run-logs')
  }

  async init(): Promise<void> {
    await fs.mkdir(this.logsDir, { recursive: true })
  }

  async createRunLog(
    executionResult: WorkflowExecutionResult,
    options: {
      workflowId?: string
      url: string
      domDigest?: DOMDigest
      claudeAnalysis?: any
    }
  ): Promise<RunLog> {
    const runLog: RunLog = {
      id: uuidv4(),
      workflowId: options.workflowId,
      timestamp: Date.now(),
      url: options.url,
      steps: this.convertStepsToLogs(executionResult.steps),
      elapsedMs: executionResult.totalDuration,
      domDigest: options.domDigest,
      claudeAnalysis: options.claudeAnalysis,
      success: executionResult.failedSteps === 0,
      failureReason: executionResult.failedSteps > 0 
        ? this.getFailureReason(executionResult.steps)
        : undefined
    }

    await this.saveRunLog(runLog)
    return runLog
  }

  private convertStepsToLogs(steps: WorkflowStepResult[]): StepLog[] {
    return steps.map(step => {
      const log: StepLog = {
        n: step.stepNumber,
        cmd: step.command,
        ok: step.success,
        duration: step.duration || 0
      }

      if (!step.success && step.error) {
        log.why = step.error
      }

      // Extract selector and digest info from evaluate commands
      if (step.command === 'evaluate' && step.args) {
        log.selector = this.extractSelector(step.args)
        
        if (step.output) {
          try {
            const result = JSON.parse(step.output)
            if (Array.isArray(result)) {
              log.digest = {
                count: result.length,
                samples: result.slice(0, 3).map(item => 
                  typeof item === 'string' ? item : JSON.stringify(item)
                )
              }
            } else {
              log.digest = { count: 1, samples: [step.output.substring(0, 100)] }
            }
          } catch {
            // For non-JSON output
            if (step.output.includes('0 items') || step.output === '[]') {
              log.digest = { count: 0 }
            }
          }
        }
      }

      return log
    })
  }

  private extractSelector(args: Record<string, any>): string | undefined {
    if (args.expression) {
      // Try to extract selector from expression
      const match = args.expression.match(/querySelectorAll\(['"]([^'"]+)['"]\)/)
      if (match) return match[1]
      
      const match2 = args.expression.match(/querySelector\(['"]([^'"]+)['"]\)/)
      if (match2) return match2[1]
    }
    return undefined
  }

  private getFailureReason(steps: WorkflowStepResult[]): string {
    const failedSteps = steps.filter(s => !s.success)
    if (failedSteps.length === 0) return 'Unknown'
    
    const reasons = failedSteps.map(s => `Step ${s.stepNumber} (${s.command}): ${s.error || 'Failed'}`)
    return reasons.join('; ')
  }

  async saveRunLog(runLog: RunLog): Promise<void> {
    const filename = `${runLog.id}.json`
    const filepath = path.join(this.logsDir, filename)
    
    await fs.writeFile(
      filepath,
      JSON.stringify(runLog, null, 2),
      'utf8'
    )
  }

  async getRunLog(id: string): Promise<RunLog | null> {
    try {
      const filepath = path.join(this.logsDir, `${id}.json`)
      const content = await fs.readFile(filepath, 'utf8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  async listRunLogs(workflowId?: string): Promise<RunLog[]> {
    try {
      const files = await fs.readdir(this.logsDir)
      const logs: RunLog[] = []
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.logsDir, file), 'utf8')
          const log = JSON.parse(content) as RunLog
          
          if (!workflowId || log.workflowId === workflowId) {
            logs.push(log)
          }
        }
      }
      
      return logs.sort((a, b) => b.timestamp - a.timestamp)
    } catch {
      return []
    }
  }

  formatRunLogForClaude(runLog: RunLog): string {
    const lines = [
      `Run ID: ${runLog.id}`,
      `URL: ${runLog.url}`,
      `Success: ${runLog.success}`,
      `Duration: ${runLog.elapsedMs}ms`,
      '',
      'Steps:'
    ]

    runLog.steps.forEach(step => {
      const status = step.ok ? '✅' : '❌'
      lines.push(`  ${status} Step ${step.n}: ${step.cmd}`)
      
      if (!step.ok && step.why) {
        lines.push(`     Error: ${step.why}`)
      }
      
      if (step.selector) {
        lines.push(`     Selector: ${step.selector}`)
      }
      
      if (step.digest) {
        lines.push(`     Found: ${step.digest.count} items`)
        if (step.digest.samples && step.digest.samples.length > 0) {
          lines.push(`     Samples: ${step.digest.samples.slice(0, 2).join(', ')}`)
        }
      }
    })

    if (runLog.failureReason) {
      lines.push('', `Failure: ${runLog.failureReason}`)
    }

    return lines.join('\n')
  }
}