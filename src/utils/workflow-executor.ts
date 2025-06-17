import { Page } from 'playwright';
import type { WorkflowStepResult, WorkflowExecutionResult } from '../types/workflow.js';
import * as yaml from 'yaml';
import { DataFormatter } from './data-formatter.js';
import { RunLogManager } from './run-log.js';
import { DOMDigest } from './dom-digest.js';
import { normalizeSelector, isValidSelector, formatSelectorForError, suggestSelectorFix } from './selector-normalizer.js';

interface WorkflowStep {
  [command: string]: any;
}

interface WorkflowOptions {
  strict?: boolean;
  variables?: Record<string, string>;
  timeout?: number;
  captureOutput?: boolean;
  onStepStart?: (stepNumber: number, command: string, args: any) => void;
  onStepComplete?: (stepNumber: number, command: string, success: boolean) => void;
}

export class WorkflowExecutor {
  private page: Page;
  private stepResults: WorkflowStepResult[] = [];
  private originalPrompt?: string;

  constructor(page: Page, originalPrompt?: string) {
    this.page = page;
    this.originalPrompt = originalPrompt;
  }

  async execute(
    workflow: WorkflowStep[], 
    options: WorkflowOptions = {}
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    // Clear previous results
    this.stepResults = [];

    for (const [index, step] of workflow.entries()) {
      const stepNumber = index + 1;
      const command = Object.keys(step)[0];
      const args = this.replaceVariables(step[command], options.variables || {});
      
      const stepStartTime = Date.now();
      let success = false;
      let output: string | undefined;
      let error: string | undefined;

      // Notify step start
      if (options.onStepStart) {
        options.onStepStart(stepNumber, command, args);
      }

      try {
        output = await this.executeStep(command, args, options);
        success = true;
        successCount++;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        
        // Add selector-specific help if this looks like a selector error
        if (error.includes('selector') || error.includes('waitForSelector') || error.includes('No element matches')) {
          const selector = this.extractSelectorFromArgs(args);
          if (selector) {
            const suggestions = suggestSelectorFix(selector, error);
            if (suggestions.length > 0) {
              error += '\n' + suggestions.map(s => `  💡 ${s}`).join('\n');
            }
          }
        }
        
        failureCount++;
        
        if (options.strict) {
          // Still capture the result before throwing
          this.stepResults.push({
            stepNumber,
            command,
            args,
            success: false,
            error,
            duration: Date.now() - stepStartTime
          });
          
          throw new Error(`Workflow failed at step ${stepNumber}: ${error}`);
        }
      }

      this.stepResults.push({
        stepNumber,
        command,
        args,
        success,
        output,
        error,
        duration: Date.now() - stepStartTime
      });

      // Notify step complete
      if (options.onStepComplete) {
        options.onStepComplete(stepNumber, command, success);
      }

      // Add small delay between steps
      await this.page.waitForTimeout(100);
    }

    return {
      success: failureCount === 0,
      totalSteps: workflow.length,
      successfulSteps: successCount,
      failedSteps: failureCount,
      steps: this.stepResults,
      totalDuration: Date.now() - startTime
    };
  }

  private async executeStep(
    command: string,
    args: any,
    options: WorkflowOptions
  ): Promise<string | undefined> {
    const timeout = options.timeout || 5000; // Changed from 30s to 5s
    let output: string | undefined;

    switch (command) {
      case 'navigate':
      case 'goto':
        const url = typeof args === 'string' ? args : args.url;
        await this.page.goto(url, { 
          waitUntil: args.waitUntil || 'load',
          timeout 
        });
        output = `Navigated to ${url}`;
        break;

      case 'click':
        const rawClickSelector = typeof args === 'string' ? args : args.selector;
        const clickSelector = normalizeSelector(rawClickSelector);
        
        if (!isValidSelector(clickSelector)) {
          throw new Error(`Invalid selector: ${formatSelectorForError(clickSelector)}`);
        }
        
        await this.page.click(clickSelector, {
          button: args.button || 'left',
          clickCount: args.clickCount || 1,
          timeout,
        });
        output = `Clicked ${clickSelector}`;
        break;

      case 'type':
        const rawTypeSelector = typeof args === 'string' 
          ? args.split(' ')[0] 
          : args.selector;
        const typeSelector = normalizeSelector(rawTypeSelector);
        
        if (!isValidSelector(typeSelector)) {
          throw new Error(`Invalid selector: ${formatSelectorForError(typeSelector)}`);
        }
        
        const text = typeof args === 'string' 
          ? args.split(' ').slice(1).join(' ')
          : args.text;
        
        await this.page.type(typeSelector, text, {
          delay: args.delay || 0,
        });
        
        if (args.submit || args.enter) {
          await this.page.press(typeSelector, 'Enter');
        }
        output = `Typed "${text}" into ${typeSelector}`;
        break;

      case 'wait':
        if (typeof args === 'string') {
          const waitSelector = normalizeSelector(args);
          if (!isValidSelector(waitSelector)) {
            throw new Error(`Invalid selector: ${formatSelectorForError(waitSelector)}`);
          }
          await this.page.waitForSelector(waitSelector, { 
            state: 'visible',
            timeout 
          });
          output = `Waited for selector: ${waitSelector}`;
        } else if (args.selector) {
          const waitSelector = normalizeSelector(args.selector);
          if (!isValidSelector(waitSelector)) {
            throw new Error(`Invalid selector: ${formatSelectorForError(waitSelector)}`);
          }
          await this.page.waitForSelector(waitSelector, {
            state: args.state || 'visible',
            timeout: args.timeout || timeout,
          });
          output = `Waited for selector: ${waitSelector}`;
        } else if (args.time || args.ms) {
          const ms = args.time || args.ms;
          await this.page.waitForTimeout(ms);
          output = `Waited ${ms}ms`;
        } else if (args.url) {
          await this.page.waitForURL(args.url, { timeout });
          output = `Waited for URL: ${args.url}`;
        }
        break;

      case 'screenshot':
        const path = typeof args === 'string' ? args : args.path;
        await this.page.screenshot({
          path,
          fullPage: args.fullPage !== false,
          type: args.type || 'png',
        });
        output = `Screenshot saved to ${path}`;
        break;

      case 'evaluate':
      case 'eval':
        const script = typeof args === 'string' ? args : args.script || args.code;
        const result = await this.page.evaluate(script);
        
        // Always capture evaluate results for data extraction
        if (result !== undefined && result !== null) {
          // Check if this looks like data extraction (arrays or objects with content)
          const isDataExtraction = Array.isArray(result) || 
            (typeof result === 'object' && Object.keys(result).length > 0);
          
          if (isDataExtraction) {
            // Detect format from args or original prompt
            let format = args.format || 'json';
            
            // Auto-detect format from original prompt if available
            if (!args.format && this.originalPrompt) {
              format = DataFormatter.detectFormat(this.originalPrompt);
            }
            
            const filename = args.filename;
            
            const { filepath, displayed } = await DataFormatter.saveAndDisplay(result, {
              format,
              filename,
              display: true
            });
            
            // Show user-friendly path
            const home = process.env.HOME || process.env.USERPROFILE || '';
            const displayPath = filepath.startsWith(home) 
              ? filepath.replace(home, '~')
              : filepath;
            
            output = `Extracted data (${Array.isArray(result) ? result.length + ' items' : 'object'}) - saved to ${displayPath}`;
          } else {
            // Simple result, just log it
            const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
            console.log(`\n📤 Result: ${resultStr}`);
            output = `Evaluated script - result: ${resultStr}`;
          }
        } else {
          output = `Evaluated script - no data returned`;
        }
        break;

      case 'scroll':
        if (typeof args === 'string') {
          await this.page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
          output = `Scrolled to bottom`;
        } else if (args.to) {
          const percentage = parseInt(args.to);
          await this.page.evaluate(`window.scrollTo(0, document.body.scrollHeight * ${percentage} / 100)`);
          output = `Scrolled to ${percentage}%`;
        } else if (args.selector) {
          const scrollSelector = normalizeSelector(args.selector);
          if (!isValidSelector(scrollSelector)) {
            throw new Error(`Invalid selector: ${formatSelectorForError(scrollSelector)}`);
          }
          await this.page.evaluate(({ selector }) => {
            document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth' });
          }, { selector: scrollSelector });
          output = `Scrolled to ${scrollSelector}`;
        }
        break;

      case 'select':
        const rawSelectSelector = typeof args === 'string' 
          ? args.split(' ')[0]
          : args.selector;
        const selectSelector = normalizeSelector(rawSelectSelector);
        
        if (!isValidSelector(selectSelector)) {
          throw new Error(`Invalid selector: ${formatSelectorForError(selectSelector)}`);
        }
        
        const value = typeof args === 'string'
          ? args.split(' ').slice(1).join(' ')
          : args.value;
        
        await this.page.selectOption(selectSelector, value);
        output = `Selected "${value}" in ${selectSelector}`;
        break;

      case 'hover':
        const rawHoverSelector = typeof args === 'string' ? args : args.selector;
        const hoverSelector = normalizeSelector(rawHoverSelector);
        
        if (!isValidSelector(hoverSelector)) {
          throw new Error(`Invalid selector: ${formatSelectorForError(hoverSelector)}`);
        }
        
        await this.page.hover(hoverSelector, {
          timeout,
          position: args.position,
        });
        output = `Hovered over ${hoverSelector}`;
        break;

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    return output;
  }

  private replaceVariables(args: any, variables: Record<string, string>): any {
    if (typeof args === 'string') {
      return args.replace(/\$\{(\w+)\}/g, (_, key) => variables[key] || '');
    }
    
    if (typeof args === 'object' && args !== null) {
      const result: any = Array.isArray(args) ? [] : {};
      
      for (const [key, value] of Object.entries(args)) {
        result[key] = this.replaceVariables(value, variables);
      }
      
      return result;
    }
    
    return args;
  }

  private extractSelectorFromArgs(args: any): string | null {
    if (typeof args === 'string') {
      // For string args, the selector is usually the first part
      return args.split(' ')[0] || args;
    }
    
    if (typeof args === 'object' && args !== null) {
      // Look for common selector properties
      return args.selector || args.target || args.element || null;
    }
    
    return null;
  }

  // Helper to format results for Claude
  static formatResultsForAnalysis(result: WorkflowExecutionResult, originalPrompt: string, yamlContent: string): string {
    const stepDetails = result.steps.map(step => {
      const status = step.success ? '✓' : '✗';
      const details = step.output || step.error || 'No output';
      return `  ${status} Step ${step.stepNumber}: ${step.command} - ${details}`;
    }).join('\n');

    return `
User's original request: "${originalPrompt}"

Workflow YAML:
\`\`\`yaml
${yamlContent}
\`\`\`

Execution Results:
- Total steps: ${result.totalSteps}
- Successful: ${result.successfulSteps}
- Failed: ${result.failedSteps}
- Duration: ${result.totalDuration}ms

Step Details:
${stepDetails}

Based on these results, did the workflow successfully achieve the user's goal?
If not, what went wrong and what changes would fix it?
`;
  }
}