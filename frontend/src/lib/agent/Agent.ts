import { ChatMessage, LLMProvider, ToolCall } from '@/lib/llm';
import { AgentHooks } from './hooks';
import { tools } from './tools';
import { Policy, evaluatePolicy } from './policies';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useHistoryStore } from '@/store/useHistoryStore';

export interface AgentConfig {
  provider: LLMProvider;
  workspacePath: string | null;
  agentMode: 'plan' | 'auto' | 'review';
  persona: string;
  hooks?: AgentHooks;
  policies: Policy[];
  autoApprove: boolean;
  customRules?: string;
  sessionId?: string;
}

export class Agent {
  private config: AgentConfig;
  private currentMessages: ChatMessage[] = [];
  
  constructor(config: AgentConfig) {
    this.config = config;
  }

  private buildSystemMessage(): ChatMessage {
    const { workspacePath, agentMode, persona, customRules } = this.config;
    
    let modeText = 'You are in normal chat mode. You cannot edit files directly.';
    if (agentMode === 'plan') {
      modeText = 'You are in PLAN MODE. Your goal is to gather context and outline a strategy. Use readDir and readFile to understand the codebase. Create an implementation_plan.md with your proposed steps and stop to wait for user approval. Do not execute destructive actions.';
    } else if (agentMode === 'auto') {
      modeText = 'You are in AUTO MODE. You can read/write files and execute terminal commands automatically to achieve the goal.';
    } else if (agentMode === 'review') {
      modeText = 'You are in REVIEW MODE. You can read/write files and execute terminal commands, but every operation requires manual user approval before execution.';
    }

    let personaText = `Focus on general assistance.`;
    if (persona === 'Coordinator') personaText = 'Act as a lead engineer. Break down the task into subtasks and outline a high-level plan.';
    if (persona === 'Frontend Expert') personaText = 'Focus on React, Next.js, UI/UX, styling, and client-side logic. Produce clean and beautiful interfaces.';
    if (persona === 'Backend Expert') personaText = 'Focus on APIs, database, server performance, and robust security.';
    if (persona === 'DevOps') personaText = 'Focus on deployment, infrastructure, scripts, and build processes.';

    const systemPrompt = `You are Mirai, a powerful and autonomous AI coding assistant.
You have access to tools that can interact with the user's workspace.
The user's absolute workspace directory is: ${workspacePath || 'Not opened'}.
ALWAYS use this absolute workspace path as your default directory for all operations (readFile, writeDir, executeCommand, etc.) unless specified otherwise.

# Agent Instructions
You operate in an Agent Loop. You must ALWAYS use tools to accomplish tasks.
${modeText}
If you want to run a terminal command or write a file, you MUST use the provided tools.
Wait for tool call results to inform you if it was approved or rejected.
For replaceInFile, you MUST provide precise SEARCH blocks that exactly match the target file content, including all leading and trailing whitespace using the exact format requested.

# Artifact Guidelines
When planning or tracking tasks, ALWAYS write your findings and checklists into markdown artifacts located in the root of the workspace (e.g., \`implementation_plan.md\`, \`task.md\`, \`walkthrough.md\`). Use these artifacts to keep the user informed and to track your own progress autonomously.

# Role Instructions
You are operating under the persona of: ${persona}.
${personaText}

${customRules ? `\n# Project Rules\n${customRules}` : ''}
`;
    return { role: 'system', content: systemPrompt };
  }

  private getFormattedTools() {
    let activeTools = tools;
    if (this.config.agentMode === 'plan') {
      activeTools = tools.filter(t => ['readFile', 'readDir', 'webFetch', 'webSearch', 'searchFiles', 'listFiles'].includes(t.name));
    }
    return activeTools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }));
  }

  public async run(
    userMessage: ChatMessage,
    initialHistory: ChatMessage[],
    onUpdateMessage: (message: ChatMessage, index: number) => void
  ): Promise<string> {
    if (this.config.hooks?.onSessionStart) await this.config.hooks.onSessionStart();
    
    this.currentMessages = [this.buildSystemMessage(), ...initialHistory, userMessage];
    let done = false;
    const MAX_STEPS = 10;
    let stepCount = 0;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    let finalResult = '';
    
    let uiMsgIndex = initialHistory.length + 1; // Start after user message
    
    const formattedTools = this.getFormattedTools();

    while (!done && stepCount < MAX_STEPS) {
      stepCount++;
      if (this.config.hooks?.onTurnStart) await this.config.hooks.onTurnStart();
      
      const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
      const currentUiIndex = uiMsgIndex++;
      
      let toolCallsToExecute: ToolCall[] = [];
      if (this.config.hooks?.onStateUpdate) await this.config.hooks.onStateUpdate('Generating response...');

      const llmStart = performance.now();
      await this.streamMessageWithRetry(
        this.currentMessages,
        (chunk) => {
          assistantMessage.content += chunk;
          onUpdateMessage({ ...assistantMessage }, currentUiIndex);
        },
        formattedTools,
        (toolCalls) => {
          toolCallsToExecute = toolCalls;
        }
      );
      assistantMessage.durationMs = performance.now() - llmStart;

      if (toolCallsToExecute.length > 0) {
        toolCallsToExecute.forEach((tc, i) => {
          if (!tc.id) tc.id = `call_${Math.random().toString(36).substring(2, 9)}_${i}`;
        });
        assistantMessage.tool_calls = toolCallsToExecute.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments }
        }));
        
        onUpdateMessage({ ...assistantMessage }, currentUiIndex);
        this.currentMessages.push(assistantMessage);
        await this.saveCheckpoint(stepCount);

        for (const call of toolCallsToExecute) {
          if (this.config.hooks?.onStateUpdate) await this.config.hooks.onStateUpdate(`Executing ${call.name}...`);
          if (this.config.hooks?.onPreToolCall) await this.config.hooks.onPreToolCall(call.name, call.arguments);
          
          const toolStart = performance.now();
          let result = '';
          try {
            let args;
            if (typeof call.arguments === 'string') {
              let argsStr = call.arguments;
              if (argsStr.trim() === '') argsStr = '{}';
              args = JSON.parse(argsStr);
            } else {
              args = call.arguments || {};
            }
            const toolDef = tools.find(t => t.name === call.name);
            
            if (!call.name) {
              result = `<error>No tool name provided. You must specify the 'name' of the function you wish to call.</error>`;
            } else if (!toolDef) {
              result = `<error>Unknown tool "${call.name}". Please use one of the provided tools.</error>`;
            } else {
              const ctx = {
                workspacePath: this.config.workspacePath,
                resolvePath: (p: string) => {
                  if (!p) return p;
                  if (p.startsWith('/') || p.startsWith('\\') || p.match(/^[a-zA-Z]:[/\\]/)) return p;
                  if (!this.config.workspacePath) return p;
                  const separator = this.config.workspacePath.includes('\\') ? '\\' : '/';
                  return `${this.config.workspacePath}${separator}${p}`;
                }
              };

              let oldContent = '';
              let newContent = '';
              const isFileOp = call.name === 'writeFile' || call.name === 'replaceInFile';
              const absolutePath = isFileOp ? ctx.resolvePath(args.path) : '';
              let canExecute = true;

              if (isFileOp) {
                try {
                  oldContent = await api.readFile(absolutePath);
                } catch {
                  oldContent = '';
                }
                
                if (call.name === 'writeFile') {
                  newContent = args.content;
                } else if (call.name === 'replaceInFile') {
                  const normalizedOld = oldContent.replace(/\r\n/g, '\n');
                  newContent = normalizedOld;
                  if (args.diff) {
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
                    if (newContent === normalizedOld) {
                      throw new Error(`replaceInFile produced no changes.`);
                    }
                  }
                }

                // Stage changes transactionally: backup and immediately write modified file to disk
                try {
                  await api.backupFile(absolutePath);
                  await api.writeFile(absolutePath, newContent);
                } catch (e) {
                  console.error('Failed to stage transactional file write:', e);
                }
              }

              const approved = await evaluatePolicy(
                call.name, 
                this.config.policies, 
                call.id,
                call.arguments, 
                this.config.autoApprove, 
                oldContent, 
                newContent
              );

              if (!approved) {
                if (isFileOp) {
                  try {
                    await api.rollbackFile(absolutePath);
                  } catch (e) {
                    console.error('Rollback failed:', e);
                  }
                }
                result = `User rejected the execution of ${call.name}`;
                canExecute = false;
              } else {
                if (isFileOp) {
                  try {
                    await api.commitFile(absolutePath);
                  } catch (e) {
                    console.error('Commit failed:', e);
                  }
                  
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
                  useHistoryStore.getState().addFileChange({
                    type: call.name as "writeFile" | "replaceInFile" | "deleteItem" | "renameItem" | "createFile",
                    filePath: absolutePath,
                    summary: `${call.name === 'writeFile' ? 'Wrote' : 'Modified'} ${absolutePath}`
                  });
                  result = `<final_file_content path="${absolutePath}">\n${newContent}\n</final_file_content>`;
                }
              }

              if (canExecute && !isFileOp) {
                result = await toolDef.execute(args, ctx);
              }
            }
            if (this.config.hooks?.onPostToolCall) await this.config.hooks.onPostToolCall(call.name, result, false);
          } catch (err: unknown) {
            const error = err as Error;
            result = `<error>\nThe tool execution failed with the following error:\n${error.message || String(error)}\n</error>`;
            if (this.config.hooks?.onPostToolCall) await this.config.hooks.onPostToolCall(call.name, result, true);
          }

          const toolDuration = performance.now() - toolStart;
          const toolMessage: ChatMessage = {
            role: 'tool',
            content: result,
            name: call.name,
            tool_call_id: call.id,
            durationMs: toolDuration
          };
          this.currentMessages.push(toolMessage);
          onUpdateMessage({ ...toolMessage }, uiMsgIndex++);
          await this.saveCheckpoint(stepCount);
        }
      } else {
        if (assistantMessage.content.trim() === '') {
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            uiMsgIndex--; // Re-use the UI index for the retry
            continue;
          }
        }
        this.currentMessages.push(assistantMessage);
        await this.saveCheckpoint(stepCount);
        done = true;
        finalResult = assistantMessage.content;
      }
    }
    return finalResult;
  }

  private async streamMessageWithRetry(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    tools: Record<string, unknown>[],
    onToolCalls: (toolCalls: ToolCall[]) => void
  ): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        await this.config.provider.streamMessage(messages, onChunk, tools, onToolCalls);
        return;
      } catch (err: unknown) {
        attempt++;
        if (attempt >= maxRetries) throw err;
        const delay = Math.pow(2, attempt) * 1000;
        const errMsg = err instanceof Error ? err.message : String(err);
        if (this.config.hooks?.onStateUpdate) {
          await this.config.hooks.onStateUpdate(`LLM error: ${errMsg}. Retrying attempt ${attempt}/${maxRetries} in ${delay/1000}s...`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private async saveCheckpoint(stepCount: number) {
    const sessionId = this.config.sessionId || 'default';
    const state = {
      sessionId,
      agentMode: this.config.agentMode,
      persona: this.config.persona,
      stepCount,
      messages: this.currentMessages,
    };
    try {
      await api.saveSessionState(sessionId, state);
    } catch (err) {
      console.error('Failed to save session state:', err);
    }
  }

  public async resume(
    savedState: { messages: ChatMessage[]; stepCount: number; agentMode: 'plan' | 'auto' | 'review'; persona: string },
    onUpdateMessage: (message: ChatMessage, index: number) => void
  ): Promise<string> {
    if (this.config.hooks?.onSessionStart) await this.config.hooks.onSessionStart();

    this.currentMessages = [...savedState.messages];
    if (this.currentMessages.length > 0 && this.currentMessages[0].role === 'system') {
      this.currentMessages[0] = this.buildSystemMessage();
    } else {
      this.currentMessages.unshift(this.buildSystemMessage());
    }

    let done = false;
    const MAX_STEPS = 10;
    let stepCount = savedState.stepCount || 0;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    let finalResult = '';

    const formattedTools = this.getFormattedTools();

    // Check if the last assistant message has tool calls that have NOT been executed yet.
    let pendingToolCalls: ToolCall[] = [];
    let pendingAssistantMsg: ChatMessage | null = null;

    for (let i = this.currentMessages.length - 1; i >= 0; i--) {
      const msg = this.currentMessages[i];
      if (msg.role === 'assistant') {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          const completedIds = new Set<string>();
          for (let j = i + 1; j < this.currentMessages.length; j++) {
            const followUpMsg = this.currentMessages[j];
            if (followUpMsg.role === 'tool' && followUpMsg.tool_call_id) {
              completedIds.add(followUpMsg.tool_call_id);
            }
          }
          const incompleteCalls = msg.tool_calls.filter(tc => !completedIds.has(tc.id));
          if (incompleteCalls.length > 0) {
            pendingToolCalls = incompleteCalls.map(tc => ({
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments
            }));
            pendingAssistantMsg = msg;
          }
        }
        break;
      }
    }

    if (pendingToolCalls.length > 0 && pendingAssistantMsg) {
      if (this.config.hooks?.onTurnStart) await this.config.hooks.onTurnStart();
      let uiMsgIndex = this.currentMessages.length - 1;

      for (const call of pendingToolCalls) {
        if (this.config.hooks?.onStateUpdate) await this.config.hooks.onStateUpdate(`Executing ${call.name}...`);
        if (this.config.hooks?.onPreToolCall) await this.config.hooks.onPreToolCall(call.name, call.arguments);

        const toolStart = performance.now();
        let result = '';
        try {
          let args;
          if (typeof call.arguments === 'string') {
            let argsStr = call.arguments;
            if (argsStr.trim() === '') argsStr = '{}';
            args = JSON.parse(argsStr);
          } else {
            args = call.arguments || {};
          }
          const toolDef = tools.find(t => t.name === call.name);

          if (!call.name) {
            result = `<error>No tool name provided. You must specify the 'name' of the function you wish to call.</error>`;
          } else if (!toolDef) {
            result = `<error>Unknown tool "${call.name}". Please use one of the provided tools.</error>`;
          } else {
            const ctx = {
              workspacePath: this.config.workspacePath,
              resolvePath: (p: string) => {
                if (!p) return p;
                if (p.startsWith('/') || p.startsWith('\\') || p.match(/^[a-zA-Z]:[/\\]/)) return p;
                if (!this.config.workspacePath) return p;
                const separator = this.config.workspacePath.includes('\\') ? '\\' : '/';
                return `${this.config.workspacePath}${separator}${p}`;
              }
            };

            let oldContent = '';
            let newContent = '';
            const isFileOp = call.name === 'writeFile' || call.name === 'replaceInFile';
            const absolutePath = isFileOp ? ctx.resolvePath(args.path) : '';
            let canExecute = true;

            if (isFileOp) {
              try {
                oldContent = await api.readFile(absolutePath);
              } catch {
                oldContent = '';
              }

              if (call.name === 'writeFile') {
                newContent = args.content;
              } else if (call.name === 'replaceInFile') {
                const normalizedOld = oldContent.replace(/\r\n/g, '\n');
                newContent = normalizedOld;
                if (args.diff) {
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
                  if (newContent === normalizedOld) {
                    throw new Error(`replaceInFile produced no changes.`);
                  }
                }
              }

              try {
                await api.backupFile(absolutePath);
                await api.writeFile(absolutePath, newContent);
              } catch (e) {
                console.error('Failed to stage transactional file write:', e);
              }
            }

            const approved = await evaluatePolicy(
              call.name,
              this.config.policies,
              call.id,
              call.arguments,
              this.config.autoApprove,
              oldContent,
              newContent
            );

            if (!approved) {
              if (isFileOp) {
                try {
                  await api.rollbackFile(absolutePath);
                } catch (e) {
                  console.error('Rollback failed:', e);
                }
              }
              result = `User rejected the execution of ${call.name}`;
              canExecute = false;
            } else {
              if (isFileOp) {
                try {
                  await api.commitFile(absolutePath);
                } catch (e) {
                  console.error('Commit failed:', e);
                }

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
                useHistoryStore.getState().addFileChange({
                  type: call.name as "writeFile" | "replaceInFile" | "deleteItem" | "renameItem" | "createFile",
                  filePath: absolutePath,
                  summary: `${call.name === 'writeFile' ? 'Wrote' : 'Modified'} ${absolutePath}`
                });
                result = `<final_file_content path="${absolutePath}">\n${newContent}\n</final_file_content>`;
              }
            }

            if (canExecute && !isFileOp) {
              result = await toolDef.execute(args, ctx);
            }
          }
          if (this.config.hooks?.onPostToolCall) await this.config.hooks.onPostToolCall(call.name, result, false);
        } catch (err: unknown) {
          const error = err as Error;
          result = `<error>\nThe tool execution failed with the following error:\n${error.message || String(error)}\n</error>`;
          if (this.config.hooks?.onPostToolCall) await this.config.hooks.onPostToolCall(call.name, result, true);
        }

        const toolDuration = performance.now() - toolStart;
        const toolMessage: ChatMessage = {
          role: 'tool',
          content: result,
          name: call.name,
          tool_call_id: call.id,
          durationMs: toolDuration
        };
        this.currentMessages.push(toolMessage);
        onUpdateMessage({ ...toolMessage }, uiMsgIndex++);
        await this.saveCheckpoint(stepCount);
      }
    }

    let uiMsgIndex = this.currentMessages.length - 1;

    while (!done && stepCount < MAX_STEPS) {
      stepCount++;
      if (this.config.hooks?.onTurnStart) await this.config.hooks.onTurnStart();

      const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
      const currentUiIndex = uiMsgIndex++;

      let toolCallsToExecute: ToolCall[] = [];
      if (this.config.hooks?.onStateUpdate) await this.config.hooks.onStateUpdate('Generating response...');

      const llmStart = performance.now();
      await this.streamMessageWithRetry(
        this.currentMessages,
        (chunk) => {
          assistantMessage.content += chunk;
          onUpdateMessage({ ...assistantMessage }, currentUiIndex);
        },
        formattedTools,
        (toolCalls) => {
          toolCallsToExecute = toolCalls;
        }
      );
      assistantMessage.durationMs = performance.now() - llmStart;

      if (toolCallsToExecute.length > 0) {
        toolCallsToExecute.forEach((tc, i) => {
          if (!tc.id) tc.id = `call_${Math.random().toString(36).substring(2, 9)}_${i}`;
        });
        assistantMessage.tool_calls = toolCallsToExecute.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments }
        }));

        onUpdateMessage({ ...assistantMessage }, currentUiIndex);
        this.currentMessages.push(assistantMessage);
        await this.saveCheckpoint(stepCount);

        for (const call of toolCallsToExecute) {
          if (this.config.hooks?.onStateUpdate) await this.config.hooks.onStateUpdate(`Executing ${call.name}...`);
          if (this.config.hooks?.onPreToolCall) await this.config.hooks.onPreToolCall(call.name, call.arguments);

          const toolStart = performance.now();
          let result = '';
          try {
            let args;
            if (typeof call.arguments === 'string') {
              let argsStr = call.arguments;
              if (argsStr.trim() === '') argsStr = '{}';
              args = JSON.parse(argsStr);
            } else {
              args = call.arguments || {};
            }
            const toolDef = tools.find(t => t.name === call.name);

            if (!call.name) {
              result = `<error>No tool name provided. You must specify the 'name' of the function you wish to call.</error>`;
            } else if (!toolDef) {
              result = `<error>Unknown tool "${call.name}". Please use one of the provided tools.</error>`;
            } else {
              const ctx = {
                workspacePath: this.config.workspacePath,
                resolvePath: (p: string) => {
                  if (!p) return p;
                  if (p.startsWith('/') || p.startsWith('\\') || p.match(/^[a-zA-Z]:[/\\]/)) return p;
                  if (!this.config.workspacePath) return p;
                  const separator = this.config.workspacePath.includes('\\') ? '\\' : '/';
                  return `${this.config.workspacePath}${separator}${p}`;
                }
              };

              let oldContent = '';
              let newContent = '';
              const isFileOp = call.name === 'writeFile' || call.name === 'replaceInFile';
              const absolutePath = isFileOp ? ctx.resolvePath(args.path) : '';
              let canExecute = true;

              if (isFileOp) {
                try {
                  oldContent = await api.readFile(absolutePath);
                } catch {
                  oldContent = '';
                }

                if (call.name === 'writeFile') {
                  newContent = args.content;
                } else if (call.name === 'replaceInFile') {
                  const normalizedOld = oldContent.replace(/\r\n/g, '\n');
                  newContent = normalizedOld;
                  if (args.diff) {
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
                    if (newContent === normalizedOld) {
                      throw new Error(`replaceInFile produced no changes.`);
                    }
                  }
                }

                try {
                  await api.backupFile(absolutePath);
                  await api.writeFile(absolutePath, newContent);
                } catch (e) {
                  console.error('Failed to stage transactional file write:', e);
                }
              }

              const approved = await evaluatePolicy(
                call.name,
                this.config.policies,
                call.id,
                call.arguments,
                this.config.autoApprove,
                oldContent,
                newContent
              );

              if (!approved) {
                if (isFileOp) {
                  try {
                    await api.rollbackFile(absolutePath);
                  } catch (e) {
                    console.error('Rollback failed:', e);
                  }
                }
                result = `User rejected the execution of ${call.name}`;
                canExecute = false;
              } else {
                if (isFileOp) {
                  try {
                    await api.commitFile(absolutePath);
                  } catch (e) {
                    console.error('Commit failed:', e);
                  }

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
                  useHistoryStore.getState().addFileChange({
                    type: call.name as "writeFile" | "replaceInFile" | "deleteItem" | "renameItem" | "createFile",
                    filePath: absolutePath,
                    summary: `${call.name === 'writeFile' ? 'Wrote' : 'Modified'} ${absolutePath}`
                  });
                  result = `<final_file_content path="${absolutePath}">\n${newContent}\n</final_file_content>`;
                }
              }

              if (canExecute && !isFileOp) {
                result = await toolDef.execute(args, ctx);
              }
            }
            if (this.config.hooks?.onPostToolCall) await this.config.hooks.onPostToolCall(call.name, result, false);
          } catch (err: unknown) {
            const error = err as Error;
            result = `<error>\nThe tool execution failed with the following error:\n${error.message || String(error)}\n</error>`;
            if (this.config.hooks?.onPostToolCall) await this.config.hooks.onPostToolCall(call.name, result, true);
          }

          const toolDuration = performance.now() - toolStart;
          const toolMessage: ChatMessage = {
            role: 'tool',
            content: result,
            name: call.name,
            tool_call_id: call.id,
            durationMs: toolDuration
          };
          this.currentMessages.push(toolMessage);
          onUpdateMessage({ ...toolMessage }, uiMsgIndex++);
          await this.saveCheckpoint(stepCount);
        }
      } else {
        if (assistantMessage.content.trim() === '') {
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            uiMsgIndex--;
            continue;
          }
        }
        this.currentMessages.push(assistantMessage);
        await this.saveCheckpoint(stepCount);
        done = true;
        finalResult = assistantMessage.content;
      }
    }
    return finalResult;
  }
}
