import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import type { SavedWorkflow, WorkflowVersion } from '../types/workflow.js';

export class WorkflowStorage {
  private storageDir: string;
  private indexFile: string;

  constructor(baseDir?: string) {
    this.storageDir = baseDir || path.join(os.homedir(), '.chromancer', 'workflows');
    this.indexFile = path.join(this.storageDir, 'index.json');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.storageDir, { recursive: true });
    
    // Create index file if it doesn't exist
    try {
      await fs.access(this.indexFile);
    } catch {
      await fs.writeFile(this.indexFile, JSON.stringify([], null, 2));
    }
  }

  async save(
    name: string,
    prompt: string,
    yaml: string,
    description?: string,
    tags?: string[]
  ): Promise<SavedWorkflow> {
    await this.init();

    const workflow: SavedWorkflow = {
      id: uuidv4(),
      name,
      description,
      prompt,
      yaml,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags,
      executions: 0,
      versions: [{
        version: 1,
        yaml,
        prompt,
        createdAt: new Date().toISOString(),
        reason: 'Initial version'
      }]
    };

    // Save workflow file
    const workflowFile = path.join(this.storageDir, `${workflow.id}.json`);
    await fs.writeFile(workflowFile, JSON.stringify(workflow, null, 2));

    // Update index
    const index = await this.loadIndex();
    index.push({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      tags: workflow.tags,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      executions: workflow.executions
    });
    await fs.writeFile(this.indexFile, JSON.stringify(index, null, 2));

    return workflow;
  }

  async update(
    id: string,
    updates: {
      yaml?: string;
      prompt?: string;
      name?: string;
      description?: string;
      tags?: string[];
      reason?: string;
    }
  ): Promise<SavedWorkflow> {
    const workflow = await this.load(id);
    
    if (updates.yaml && updates.yaml !== workflow.yaml) {
      // Add new version
      const newVersion: WorkflowVersion = {
        version: (workflow.versions?.length || 0) + 1,
        yaml: updates.yaml,
        prompt: updates.prompt || workflow.prompt,
        createdAt: new Date().toISOString(),
        reason: updates.reason || 'Manual update'
      };
      
      workflow.versions = workflow.versions || [];
      workflow.versions.push(newVersion);
      workflow.yaml = updates.yaml;
    }

    if (updates.prompt) workflow.prompt = updates.prompt;
    if (updates.name) workflow.name = updates.name;
    if (updates.description !== undefined) workflow.description = updates.description;
    if (updates.tags) workflow.tags = updates.tags;
    
    workflow.updatedAt = new Date().toISOString();

    // Save updated workflow
    const workflowFile = path.join(this.storageDir, `${id}.json`);
    await fs.writeFile(workflowFile, JSON.stringify(workflow, null, 2));

    // Update index
    const index = await this.loadIndex();
    const indexItem = index.find(item => item.id === id);
    if (indexItem) {
      if (updates.name) indexItem.name = updates.name;
      if (updates.description !== undefined) indexItem.description = updates.description;
      if (updates.tags) indexItem.tags = updates.tags;
      indexItem.updatedAt = workflow.updatedAt;
      await fs.writeFile(this.indexFile, JSON.stringify(index, null, 2));
    }

    return workflow;
  }

  async load(idOrName: string): Promise<SavedWorkflow> {
    await this.init();

    // Try to find by ID first
    let workflowFile = path.join(this.storageDir, `${idOrName}.json`);
    
    try {
      const content = await fs.readFile(workflowFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      // Try to find by name
      const index = await this.loadIndex();
      const item = index.find(w => w.name.toLowerCase() === idOrName.toLowerCase());
      
      if (!item) {
        throw new Error(`Workflow not found: ${idOrName}`);
      }

      workflowFile = path.join(this.storageDir, `${item.id}.json`);
      const content = await fs.readFile(workflowFile, 'utf-8');
      return JSON.parse(content);
    }
  }

  async list(filter?: { tags?: string[] }): Promise<SavedWorkflow[]> {
    await this.init();
    const index = await this.loadIndex();
    
    let workflows = index;
    
    if (filter?.tags && filter.tags.length > 0) {
      workflows = workflows.filter(w => 
        w.tags && filter.tags!.some(tag => w.tags!.includes(tag))
      );
    }

    return workflows;
  }

  async delete(idOrName: string): Promise<void> {
    await this.init();
    
    const workflow = await this.load(idOrName);
    
    // Delete workflow file
    const workflowFile = path.join(this.storageDir, `${workflow.id}.json`);
    await fs.unlink(workflowFile);

    // Update index
    const index = await this.loadIndex();
    const filtered = index.filter(item => item.id !== workflow.id);
    await fs.writeFile(this.indexFile, JSON.stringify(filtered, null, 2));
  }

  async recordExecution(id: string): Promise<void> {
    const workflow = await this.load(id);
    workflow.executions = (workflow.executions || 0) + 1;
    workflow.lastExecuted = new Date().toISOString();
    
    const workflowFile = path.join(this.storageDir, `${id}.json`);
    await fs.writeFile(workflowFile, JSON.stringify(workflow, null, 2));
  }

  private async loadIndex(): Promise<any[]> {
    try {
      const content = await fs.readFile(this.indexFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }
}