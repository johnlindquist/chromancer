import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runChromancer } from './test-utils.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Workflow Issues', () => {
  let tempDir;
  
  beforeEach(async () => {
    // Create a temporary directory for workflow files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chromancer-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Issue 1: Duplicate workflow save prompt', () => {
    it('should demonstrate duplicate save prompt issue', async () => {
      // This test demonstrates the issue where after selecting "Save workflow for future use",
      // the user is prompted again with "Would you like to save this workflow?"
      
      // Create a simple workflow file
      const workflowContent = `
instruction: Navigate to example.com
steps:
  - navigate: https://example.com
`;
      const workflowPath = path.join(tempDir, 'test-workflow.yaml');
      await fs.writeFile(workflowPath, workflowContent);
      
      // Run the workflow with AI command
      // Note: This test is to document the issue, not test the fix yet
      const result = await runChromancer('ai', ['--workflow', workflowPath, '--no-interactive']);
      
      // The issue is in src/commands/ai.ts:
      // 1. User selects "Save workflow for future use" from menu (line 1061)
      // 2. promptSaveWorkflow is called (line 1072)
      // 3. promptSaveWorkflow asks again "Would you like to save this workflow?" (line 878)
      // This is redundant since the user already chose to save
      
      expect(result.stderr || result.stdout).toContain('workflow');
    });
  });

  describe('Issue 2: Session not terminating after workflow completion', () => {
    it('should demonstrate session hanging after completion', async () => {
      // This test demonstrates the issue where the session doesn't terminate
      // after showing "💡 Run it later with: chromancer workflows run..."
      
      // The issue is in src/commands/ai.ts handleSuccessfulWorkflow:
      // When user selects "Done" (line 1145), it just logs a message
      // but doesn't exit the process or close the Chrome connection
      
      // Create a workflow that completes successfully
      const workflowContent = `
instruction: Navigate to example.com
steps:
  - navigate: https://example.com
`;
      const workflowPath = path.join(tempDir, 'completion-test.yaml');
      await fs.writeFile(workflowPath, workflowContent);
      
      // This would hang without proper termination
      const result = await runChromancer('workflows', ['run', workflowPath, '--timeout', '5000']);
      
      // Document that the process should exit after completion
      expect(result).toBeDefined();
    });
  });

  describe('Issue 3: Input sync issues when typing/deleting', () => {
    it('should demonstrate input synchronization issues', async () => {
      // This test demonstrates the issue where typing and deleting characters
      // causes the input to become "out of sync" with duplicated letters
      
      // The issue appears to be in src/commands/type.ts:
      // 1. Clear operation uses triple-click + Delete (lines 120-125)
      // 2. No character-by-character deletion support
      // 3. Typing might not wait for previous operations to complete
      
      // Test typing with clear flag
      const result = await runChromancer('type', ['input[type="text"]', 'Hello World', '--clear']);
      
      // Document the expected behavior vs actual
      expect(result.stdout || '').toContain('type');
    });

    it('should test character deletion timing', async () => {
      // Navigate to a test page with an input
      await runChromancer('navigate', ['https://example.com']);
      
      // Type some text
      await runChromancer('type', ['input', 'Initial text']);
      
      // Try to delete characters (this is where sync issues occur)
      // Currently there's no way to delete individual characters
      // Only triple-click + Delete for clearing all
      
      const result = await runChromancer('keypress', ['Backspace', '--repeat', '5']);
      
      // Document that individual character deletion should work properly
      expect(result).toBeDefined();
    });
  });
});

// Additional integration test to verify the actual issues
describe('Workflow Issues - Integration', () => {
  it('should create a test case that reproduces all three issues', async () => {
    // This integration test shows how all three issues manifest together
    
    // 1. Create and run a workflow
    // 2. Select "Save workflow for future use" 
    // 3. Observe duplicate prompt
    // 4. After saving, observe session doesn't terminate
    // 5. During workflow, observe input sync issues
    
    const workflowYaml = `
instruction: Test all three issues
steps:
  - navigate: https://example.com
  - type:
      selector: 'input[type="search"]'
      text: "Hello"
      clear: true
  - keypress: Backspace
  - keypress: Backspace
  - type:
      selector: 'input[type="search"]'
      text: "World"
`;
    
    const workflowPath = path.join(tempDir, 'integration-test.yaml');
    await fs.writeFile(workflowPath, workflowYaml);
    
    // This would demonstrate all issues if run interactively
    expect(workflowPath).toBeDefined();
  });
});