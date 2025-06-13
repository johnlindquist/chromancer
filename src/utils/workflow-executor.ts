import { Page } from 'playwright';
import type { WorkflowStepResult, WorkflowExecutionResult } from '../types/workflow.js';
import * as yaml from 'yaml';
import { DataFormatter } from './data-formatter.js';

interface WorkflowStep {
  [command: string]: any;
}

interface WorkflowOptions {
  strict?: boolean;
  variables?: Record<string, string>;
  timeout?: number;
  captureOutput?: boolean;
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

      try {
        output = await this.executeStep(command, args, options);
        success = true;
        successCount++;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
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
    const timeout = options.timeout || 30000;
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
        const clickSelector = typeof args === 'string' ? args : args.selector;
        await this.page.click(clickSelector, {
          button: args.button || 'left',
          clickCount: args.clickCount || 1,
          timeout,
        });
        output = `Clicked ${clickSelector}`;
        break;

      case 'type':
        const typeSelector = typeof args === 'string' 
          ? args.split(' ')[0] 
          : args.selector;
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
          await this.page.waitForSelector(args, { 
            state: 'visible',
            timeout 
          });
          output = `Waited for selector: ${args}`;
        } else if (args.selector) {
          await this.page.waitForSelector(args.selector, {
            state: args.state || 'visible',
            timeout: args.timeout || timeout,
          });
          output = `Waited for selector: ${args.selector}`;
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
          await this.page.evaluate(({ selector }) => {
            document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth' });
          }, { selector: args.selector });
          output = `Scrolled to ${args.selector}`;
        }
        break;

      case 'select':
        const selectSelector = typeof args === 'string' 
          ? args.split(' ')[0]
          : args.selector;
        const value = typeof args === 'string'
          ? args.split(' ').slice(1).join(' ')
          : args.value;
        
        await this.page.selectOption(selectSelector, value);
        output = `Selected "${value}" in ${selectSelector}`;
        break;

      case 'hover':
        const hoverSelector = typeof args === 'string' ? args : args.selector;
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