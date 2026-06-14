import re

with open('c:/Users/shett/Desktop/Mirai Landing Website/Mirai/frontend/src/components/ide/HyprChat.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace(
'''import VoiceOrb from './VoiceOrb';
import AgentReviewPanel from './AgentReviewPanel';''',
'''import VoiceOrb from './VoiceOrb';
import AgentReviewPanel from './AgentReviewPanel';
import PermissionModal from './PermissionModal';'''
)

# 2. activeChatTab removal
content = re.sub(
r"const \[activeChatTab, setActiveChatTab\] = useState\<'chat' \| 'changes'\>\('chat'\);\n\s*",
"",
content
)

content = content.replace(
'''        if (existing) {
          setActiveChatTab('changes');
          openDiffForReview(existing.id);
          return;
        }''',
'''        if (existing) {
          openDiffForReview(existing.id);
          return;
        }'''
)

content = content.replace(
'''        } else {
          const fileName = absPath.split(/[/\\]/).pop() || absPath;
          setActiveFile(absPath, fileName, originalContent);
          openDiffForReview(changeId);
          setActiveChatTab('changes');
        }''',
'''        } else {
          const fileName = absPath.split(/[/\\\\]/).pop() || absPath;
          setActiveFile(absPath, fileName, originalContent);
          openDiffForReview(changeId);
        }'''
)

# 3. Add workspacePath
content = content.replace(
'''            autoApproveSettings,
          }),''',
'''            autoApproveSettings,
            workspacePath,
          }),'''
)

# 4. Remove Chat/Changes tab switcher
content = re.sub(
r'<div className="flex border-b border-white/5 bg-black/10 px-2 py-1">\s*<button\s*type="button"\s*onClick=\{\(\) => setActiveChatTab\(\'chat\'\)\}.*?</button>\s*</div>',
'',
content,
flags=re.DOTALL
)

# 5. Replace activeChatTab ternary and add PermissionModal
content = re.sub(
r'\{\s*/\* Content Area \*/\s*\}\s*\{activeChatTab === \'changes\' \? \(\s*<div className="flex-1 min-h-0">\s*<AgentReviewPanel />\s*</div>\s*\) : \(',
'''{/* Content Area */}''',
content
)

content = content.replace(
'''          {/* Attached Files display */}
  {
    (attachedFiles.length > 0 || attachedPaths.length > 0) && (''',
'''    {pendingChangeCount > 0 && (
      <div className="shrink-0 border-t border-white/5 bg-[#1E1E1E]/95 backdrop-blur-md max-h-[40%] flex flex-col z-40 relative">
        <AgentReviewPanel />
      </div>
    )}

          {/* Attached Files display */}
  {
    (attachedFiles.length > 0 || attachedPaths.length > 0) && ('''
)

content = content.replace(
'''          </button>
        )}
      </div>
    </div>
  );
}''',
'''          </button>
        )}
      </div>

      <PermissionModal />
    </div>
  );
}'''
)

# Replace the closing parenthesis of the ternary we removed
content = content.replace(
'''        <div ref={messagesEndRef} className="h-4 w-full shrink-0" />
      </>
            )}
    </SimpleBar>
          )}''',
'''        <div ref={messagesEndRef} className="h-4 w-full shrink-0" />
      </>
            )}
    </SimpleBar>'''
)

# 6. AgentSteps redesign
old_agent_steps = '''function AgentSteps({ steps }: { steps?: import('@/store/chatStore').AgentStep[] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="mt-1 flex max-w-[90%] flex-col gap-1 rounded-lg border border-white/10 bg-black/20 p-2">
      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-2 text-[10px] font-mono text-white/55">
          {step.status === 'running' ? (
            <CircleDashed className="h-3 w-3 animate-spin text-blue-300" />
          ) : step.status === 'waiting_approval' ? (
            <Clock className="h-3 w-3 text-amber-300" />
          ) : step.status === 'failed' ? (
            <X className="h-3 w-3 text-red-300" />
          ) : (
            <Check className="h-3 w-3 text-emerald-300" />
          )}
          <span className={step.status === 'waiting_approval' ? 'text-amber-200/80' : ''}>{step.title}</span>
          {step.detail && typeof step.detail === 'string' && (
            <span className="truncate text-white/25">{step.detail}</span>
          )}
        </div>
      ))}
    </div>
  );
}'''

new_agent_steps = '''function AgentSteps({ steps }: { steps?: import('@/store/chatStore').AgentStep[] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="my-2 flex flex-col gap-3 px-1">
      {steps.map((step) => (
        <div key={step.id} className="flex flex-col gap-1">
          <div className="flex items-center text-[12px] font-mono tracking-wide text-white/80">
            <div className="flex items-center gap-2">
              <span className={step.status === 'running' ? 'text-blue-300' : step.status === 'waiting_approval' ? 'text-amber-300' : 'text-white/80'}>
                {step.title}
              </span>
            </div>
            {step.status === 'running' && <span className="ml-2 text-[10px] text-white/30 uppercase tracking-widest animate-pulse">Working...</span>}
            <ChevronRight className="w-3.5 h-3.5 text-white/30 ml-auto" />
          </div>
          {step.detail && typeof step.detail === 'string' && (
            <div className="text-[11px] font-mono text-white/40 truncate max-w-[90%] opacity-70">
              {step.detail}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}'''
content = content.replace(old_agent_steps, new_agent_steps)

with open('c:/Users/shett/Desktop/Mirai Landing Website/Mirai/frontend/src/components/ide/HyprChat.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
