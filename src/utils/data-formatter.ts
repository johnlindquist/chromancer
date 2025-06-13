import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface DataOutputOptions {
  format?: 'json' | 'csv' | 'text';
  filename?: string;
  directory?: string;
  display?: boolean;
  useGlobalDir?: boolean;
}

export class DataFormatter {
  static async saveAndDisplay(
    data: any,
    options: DataOutputOptions = {}
  ): Promise<{ filepath: string; displayed: string }> {
    const {
      format = 'json',
      filename,
      directory,
      display = true,
      useGlobalDir = true
    } = options;

    // Determine directory - use global ~/.chromancer/data by default
    const dir = directory || (useGlobalDir 
      ? path.join(process.env.HOME || process.env.USERPROFILE || '', '.chromancer', 'data')
      : path.join(process.cwd(), 'tmp'));
    
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Generate filename if not provided
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const finalFilename = filename || `chromancer-data-${timestamp}.${format}`;
    const filepath = path.join(dir, finalFilename);

    // Format data based on type
    let formatted: string;
    let displayText: string;

    switch (format) {
      case 'json':
        formatted = JSON.stringify(data, null, 2);
        displayText = this.formatForDisplay(data);
        break;

      case 'csv':
        formatted = this.toCSV(data);
        displayText = formatted;
        break;

      case 'text':
        formatted = this.toText(data);
        displayText = formatted;
        break;

      default:
        formatted = JSON.stringify(data, null, 2);
        displayText = this.formatForDisplay(data);
    }

    // Save to file
    await fs.writeFile(filepath, formatted);

    // Display if requested
    if (display) {
      console.log('\n📊 Data extracted:');
      console.log('─'.repeat(60));
      console.log(displayText);
      console.log('─'.repeat(60));
      
      // Show user-friendly path
      const home = process.env.HOME || process.env.USERPROFILE || '';
      const displayPath = filepath.startsWith(home) 
        ? filepath.replace(home, '~')
        : filepath;
      
      console.log(`\n💾 Data saved to: ${displayPath}`);
    }

    return { filepath, displayed: displayText };
  }

  private static formatForDisplay(data: any): string {
    // If it's a string, return as-is
    if (typeof data === 'string') {
      return data;
    }

    // If it's an array, show count and first few items
    if (Array.isArray(data)) {
      const preview = data.slice(0, 5);
      let display = `Array with ${data.length} items:\n`;
      
      preview.forEach((item, index) => {
        if (typeof item === 'object') {
          display += `\n[${index}] ${JSON.stringify(item, null, 2)}`;
        } else {
          display += `\n[${index}] ${item}`;
        }
      });

      if (data.length > 5) {
        display += `\n\n... and ${data.length - 5} more items`;
      }

      return display;
    }

    // For objects, show formatted JSON
    return JSON.stringify(data, null, 2);
  }

  private static toCSV(data: any): string {
    if (!Array.isArray(data)) {
      throw new Error('CSV format requires array data');
    }

    if (data.length === 0) {
      return '';
    }

    // Handle array of objects
    if (typeof data[0] === 'object' && data[0] !== null) {
      const headers = Object.keys(data[0]);
      const csvHeaders = headers.join(',');
      
      const csvRows = data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape quotes and wrap in quotes if contains comma
          const escaped = String(value).replace(/"/g, '""');
          return escaped.includes(',') ? `"${escaped}"` : escaped;
        }).join(',')
      );

      return [csvHeaders, ...csvRows].join('\n');
    }

    // Handle array of primitives
    return data.map(item => String(item)).join('\n');
  }

  private static toText(data: any): string {
    if (typeof data === 'string') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item, index) => {
        if (typeof item === 'object') {
          return `--- Item ${index + 1} ---\n${JSON.stringify(item, null, 2)}`;
        }
        return `${index + 1}. ${item}`;
      }).join('\n\n');
    }

    return JSON.stringify(data, null, 2);
  }

  static detectFormat(instruction: string): 'json' | 'csv' | 'text' {
    const lower = instruction.toLowerCase();
    
    if (lower.includes('csv') || lower.includes('spreadsheet') || lower.includes('excel')) {
      return 'csv';
    }
    
    if (lower.includes('text') || lower.includes('plain') || lower.includes('list')) {
      return 'text';
    }
    
    return 'json';
  }
}