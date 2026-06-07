import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useHistoryStore } from '@/store/useHistoryStore';

export interface ToolContext {
  workspacePath: string | null;
  resolvePath: (p: string) => string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (args: any, context: ToolContext) => Promise<string>;
}

import { z } from 'zod';

const schemas: Record<string, z.ZodSchema> = {
  readFile: z.object({ path: z.string() }),
  writeFile: z.object({ path: z.string(), content: z.string() }),
  replaceInFile: z.object({ path: z.string(), diff: z.string() }),
  executeCommand: z.object({ command: z.string(), cwd: z.string().optional() }),
  manageTask: z.object({
    action: z.enum(['list', 'kill', 'status']),
    taskId: z.string().optional()
  }),
  readDir: z.object({ dirPath: z.string() }),
  askQuestion: z.object({
    question: z.string(),
    options: z.array(z.string())
  }),
  schedule: z.object({
    durationSeconds: z.number().optional(),
    prompt: z.string()
  }),
  generateImage: z.object({
    prompt: z.string(),
    imageName: z.string()
  }),
  browserSubagent: z.object({
    task: z.string()
  }),
  webFetch: z.object({ url: z.string() }),
  webSearch: z.object({ query: z.string() }),
  searchFiles: z.object({ pattern: z.string(), dirPath: z.string().optional() }),
};

const rawTools: ToolDefinition[] = [
  {
    name: 'readFile',
    description: 'Read the contents of a file.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path']
    },
    execute: async (args, ctx) => {
      const absolutePath = ctx.resolvePath(args.path);
      const content = await api.readFile(absolutePath);
      return `<file_content path="${absolutePath}">\n${content}\n</file_content>`;
    }
  },
  {
    name: 'writeFile',
    description: 'Write content to a file. Overwrites if it exists. Use only for new files or complete rewrites.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' }, content: { type: 'string' } },
      required: ['path', 'content']
    },
    execute: async (args, ctx) => {
      const absolutePath = ctx.resolvePath(args.path);
      await api.writeFile(absolutePath, args.content);
      
      useHistoryStore.getState().addFileChange({
        type: 'writeFile',
        filePath: absolutePath,
        summary: `Wrote ${absolutePath}`
      });

      const getLanguage = (p: string) => {
        if (p.endsWith('.ts') || p.endsWith('.tsx')) return 'typescript';
        if (p.endsWith('.js') || p.endsWith('.jsx')) return 'javascript';
        if (p.endsWith('.py')) return 'python';
        if (p.endsWith('.json')) return 'json';
        if (p.endsWith('.html')) return 'html';
        if (p.endsWith('.css')) return 'css';
        if (p.endsWith('.md')) return 'markdown';
        return 'plaintext';
      };

      useWorkspaceStore.getState().openFile({
        path: absolutePath,
        content: args.content,
        originalContent: args.content,
        language: getLanguage(absolutePath)
      });
      return `<final_file_content path="${absolutePath}">\n${args.content}\n</final_file_content>`;
    }
  },
  {
    name: 'replaceInFile',
    description: 'Replace sections of content in an existing file using robust SEARCH/REPLACE blocks. Preferred for targeted edits.',
    parameters: {
      type: 'object',
      properties: { 
        path: { type: 'string' }, 
        diff: { 
          type: 'string', 
          description: 'One or more SEARCH/REPLACE blocks following this exact format:\n<<<<\nSEARCH\n[exact content to find]\n====\nREPLACE\n[new content to replace with]\n>>>>' 
        } 
      },
      required: ['path', 'diff']
    },
    execute: async (args, ctx) => {
      const absolutePath = ctx.resolvePath(args.path);
      const oldContentRaw = await api.readFile(absolutePath);
      const oldContent = oldContentRaw.replace(/\r\n/g, '\n');
      let newContent = oldContent;
      
      const diffStr = (args.diff as string).replace(/\r\n/g, '\n');
      const blocks = diffStr.split('<<<<\nSEARCH\n');
      let replaceCount = 0;
      
      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const match = block.match(/([\s\S]*?)====\nREPLACE\n([\s\S]*?)>>>>/);
        
        if (match) {
          let search = match[1];
          if (search.endsWith('\n')) search = search.substring(0, search.length - 1);
          
          let replace = match[2];
          if (replace.endsWith('\n')) replace = replace.substring(0, replace.length - 1);
    
          if (newContent.includes(search)) {
            newContent = newContent.replace(search, replace);
            replaceCount++;
          } else {
            throw new Error(`Could not find the SEARCH block in the file. Ensure the content matches exactly.`);
          }
        } else {
          throw new Error(`Malformed SEARCH/REPLACE block.`);
        }
      }
      
      if (replaceCount === 0) {
        throw new Error(`No SEARCH blocks matched in the file. No changes applied.`);
      }
      if (newContent === oldContent) {
        throw new Error(`replaceInFile produced no changes.`);
      }
      
      await api.writeFile(absolutePath, newContent);
      
      useHistoryStore.getState().addFileChange({
        type: 'replaceInFile',
        filePath: absolutePath,
        summary: `Modified ${absolutePath}`
      });

      const getLanguage = (p: string) => {
        if (p.endsWith('.ts') || p.endsWith('.tsx')) return 'typescript';
        if (p.endsWith('.js') || p.endsWith('.jsx')) return 'javascript';
        if (p.endsWith('.py')) return 'python';
        if (p.endsWith('.json')) return 'json';
        if (p.endsWith('.html')) return 'html';
        if (p.endsWith('.css')) return 'css';
        if (p.endsWith('.md')) return 'markdown';
        return 'plaintext';
      };

      useWorkspaceStore.getState().openFile({
        path: absolutePath,
        content: newContent,
        originalContent: newContent,
        language: getLanguage(absolutePath)
      });
      return `<final_file_content path="${absolutePath}">\n${newContent}\n</final_file_content>`;
    }
  },
  {
    name: 'executeCommand',
    description: 'Execute a CLI command in the terminal. Note: For long-running commands (e.g. dev servers), this starts the command in the background and returns a task ID. Use manageTask to view its logs or kill it.',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string' }, cwd: { type: 'string' } },
      required: ['command']
    },
    execute: async (args, ctx) => {
      const cmdRes = await api.executeCommand(args.command, args.cwd ? ctx.resolvePath(args.cwd) : (ctx.workspacePath || '.'));
      return `Command executed.\nStdout:\n${cmdRes.stdout}\nStderr:\n${cmdRes.stderr}`;
    }
  },
  {
    name: 'manageTask',
    description: 'Manage background tasks (e.g., long-running terminal commands). Use this to list tasks, view their streaming logs, or kill them.',
    parameters: {
      type: 'object',
      properties: { 
        action: { type: 'string', enum: ['list', 'kill', 'status'] }, 
        taskId: { type: 'string' } 
      },
      required: ['action']
    },
    execute: async (args) => {
      if (args.action === 'list') {
        const tasks = await api.listTasks();
        if (tasks.length === 0) return 'No background tasks running.';
        return tasks.map(t => `Task ID: ${t.id} | Command: ${t.command} | Status: ${t.status}`).join('\n');
      }
      if (!args.taskId) return 'Error: taskId is required for kill or status actions.';
      if (args.action === 'kill') {
        await api.killTask(args.taskId);
        return `Successfully killed task ${args.taskId}`;
      }
      if (args.action === 'status') {
        const tasks = await api.listTasks();
        const task = tasks.find(t => t.id === args.taskId);
        if (!task) return `Error: Task ${args.taskId} not found.`;
        return `Task ID: ${task.id}\nStatus: ${task.status}\nLogs:\n${task.logs}`;
      }
      return 'Invalid action.';
    }
  },
  {
    name: 'readDir',
    description: 'List contents of a directory.',
    parameters: {
      type: 'object',
      properties: { dirPath: { type: 'string' } },
      required: ['dirPath']
    },
    execute: async (args, ctx) => {
      const absolutePath = ctx.resolvePath(args.dirPath);
      const dirRes = await api.readDir(absolutePath);
      return `Directory contents: \n${dirRes.entries.map((e: { isDirectory: boolean; name: string }) => (e.isDirectory ? '[DIR] ' : '[FILE] ') + e.name).join('\n')}`;
    }
  },
  {
    name: 'askQuestion',
    description: 'Ask the user a multiple-choice question to clarify requirements or solicit design feedback. This will block execution until the user responds.',
    parameters: {
      type: 'object',
      properties: { 
        question: { type: 'string' },
        options: { type: 'array', items: { type: 'string' } }
      },
      required: ['question', 'options']
    },
    execute: async (args) => {
      const res = await api.askQuestion(args.question, args.options);
      return `User selected: ${res}`;
    }
  },
  {
    name: 'schedule',
    description: 'Schedule a one-shot timer or a recurring cron job that sends notifications in the background.',
    parameters: {
      type: 'object',
      properties: { 
        durationSeconds: { type: 'number' },
        prompt: { type: 'string' }
      },
      required: ['prompt']
    },
    execute: async (args) => {
      await api.schedule(args.durationSeconds, args.prompt);
      return `Timer scheduled. You will be notified with "${args.prompt}".`;
    }
  },
  {
    name: 'generateImage',
    description: 'Generate an image or edit existing images based on a text prompt. The resulting image will be saved as an artifact for use.',
    parameters: {
      type: 'object',
      properties: { 
        prompt: { type: 'string' },
        imageName: { type: 'string' }
      },
      required: ['prompt', 'imageName']
    },
    execute: async (args, ctx) => {
      const res = await api.generateImage(args.prompt, args.imageName, ctx.workspacePath || '.');
      return `Image generated and saved to ${res.path}`;
    }
  },
  {
    name: 'browserSubagent',
    description: 'Start a browser subagent to perform actions in the browser with the given task description.',
    parameters: {
      type: 'object',
      properties: { 
        task: { type: 'string' }
      },
      required: ['task']
    },
    execute: async (args) => {
      const res = await api.browserSubagent(args.task);
      return `Browser subagent completed: ${res.report}`;
    }
  },
  {
    name: 'webFetch',
    description: 'Fetch the text content of a URL (useful for documentation or reading sites).',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url']
    },
    execute: async (args) => {
      const text = await api.webFetch(args.url);
      return `<web_content url="${args.url}">\n${text.substring(0, 5000)}\n</web_content>`;
    }
  },
  {
    name: 'webSearch',
    description: 'Search the web for information.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query']
    },
    execute: async (args) => {
      const searchRes = await api.webSearch(args.query);
      return `<web_search_results query="${args.query}">\n${JSON.stringify(searchRes, null, 2)}\n</web_search_results>`;
    }
  },
  {
    name: 'searchFiles',
    description: 'Search for a regex pattern across all files in a directory.',
    parameters: {
      type: 'object',
      properties: { pattern: { type: 'string' }, dirPath: { type: 'string' } },
      required: ['pattern']
    },
    execute: async (args, ctx) => {
      const absolutePath = ctx.resolvePath(args.dirPath || ctx.workspacePath || '.');
      const results = await api.searchFiles(args.pattern, absolutePath);
      return `Found pattern in ${results.length} files:\n${results.join('\n')}`;
    }
  },
];

export const tools: ToolDefinition[] = rawTools.map(t => {
  const schema = schemas[t.name];
  if (!schema) return t;
  return {
    ...t,
    execute: async (args, context) => {
      const parsed = schema.safeParse(args);
      if (!parsed.success) {
        throw new Error(`Zod validation failed for tool '${t.name}':\n${parsed.error.issues.map(e => `- ${e.path.join('.')}: ${e.message}`).join('\n')}`);
      }
      return t.execute(parsed.data, context);
    }
  };
});
