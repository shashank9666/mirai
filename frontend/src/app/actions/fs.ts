'use server';

import fs from 'fs/promises';
import path from 'path';

export type FileNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
};

const ROOT_DIR = 'c:\\Users\\shett\\Desktop\\Mirai';

export async function readDirectory(dirPath: string = ROOT_DIR): Promise<FileNode[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    // Sort directories first, then files
    const sortedEntries = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    const nodes: FileNode[] = [];
    
    for (const entry of sortedEntries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') continue;
      
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: fullPath,
          type: 'directory',
          // We won't load children recursively here for performance, 
          // we'll load them dynamically on click in the UI.
        });
      } else {
        nodes.push({
          name: entry.name,
          path: fullPath,
          type: 'file',
        });
      }
    }
    
    return nodes;
  } catch (error) {
    console.error('Failed to read directory:', error);
    return [];
  }
}

export async function readFileContent(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Failed to read file:', error);
    return `// Failed to load file: ${filePath}`;
  }
}
