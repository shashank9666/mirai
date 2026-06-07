'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Image as ImageIcon, KeyRound, Palette, Eye, EyeOff, ChevronDown, ChevronRight, Check, Upload, Cpu, Bell, Plus, Trash2, Edit2, Save } from 'lucide-react';
import { useSettingsStore, AIProvider, DEFAULT_BASE_URLS, Skill } from '@/store/useSettingsStore';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import Image from 'next/image';

export default function SettingsView() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'appearance' | 'mcp-skills' | 'notifications' | AIProvider>('appearance');

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const isNarrow = width < 550;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // In Electron, File objects have a `path` property. Store the path instead of Base64 to save space.
    const filePath = (file as File & { path?: string }).path;
    if (filePath) {
      const normalizedPath = filePath.replace(/\\/g, '/');
      const url = normalizedPath.startsWith('/') ? `file://${normalizedPath}` : `file:///${normalizedPath}`;
      setBackgroundImage(url);
      return;
    }

    // Fallback for web mode
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setBackgroundImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };
  
  const { 
    themeMode, setThemeMode,
    accentColor, setAccentColor,
    backgroundImage, setBackgroundImage,
    formatOnSave, setFormatOnSave,
    codeAutocomplete, setCodeAutocomplete,
    autoApprove, setAutoApprove,
    checkpointsEnabled, setCheckpointsEnabled,
    aiProvider, setAiProvider,
    providerConfigs, updateProviderConfig,
    skills, notificationPrefs, addSkill, editSkill, deleteSkill, updateNotificationPrefs
  } = useSettingsStore();

  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [newSkillCode, setNewSkillCode] = useState('');
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editSkillName, setEditSkillName] = useState('');
  const [editSkillDesc, setEditSkillDesc] = useState('');
  const [editSkillCode, setEditSkillCode] = useState('');

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim() || !newSkillCode.trim()) return;
    addSkill({
      name: newSkillName.trim(),
      description: newSkillDesc.trim(),
      code: newSkillCode.trim()
    });
    setNewSkillName('');
    setNewSkillDesc('');
    setNewSkillCode('');
  };

  const handleStartEdit = (skill: Skill) => {
    setEditingSkillId(skill.id);
    setEditSkillName(skill.name);
    setEditSkillDesc(skill.description);
    setEditSkillCode(skill.code);
  };

  const handleSaveSkillEdit = (id: string) => {
    if (!editSkillName.trim() || !editSkillCode.trim()) return;
    editSkill(id, {
      name: editSkillName.trim(),
      description: editSkillDesc.trim(),
      code: editSkillCode.trim()
    });
    setEditingSkillId(null);
  };

  const providerNames: Record<AIProvider, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google (Gemini)',
    mistral: 'Mistral',
    openrouter: 'OpenRouter',
    groq: 'Groq',
    together: 'Together AI',
    fireworks: 'Fireworks',
    deepinfra: 'DeepInfra',
    novita: 'Novita',
    cerebras: 'Cerebras',
    perplexity: 'Perplexity',
    ollama: 'Ollama (Local)',
    opencode: 'OpenCode',
    deepseek: 'DeepSeek'
  };

  const renderAppearance = () => (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-foreground">
        <Palette size={20} className="text-muted-foreground" />
        Appearance
      </h2>
      <div className="space-y-6">
        <div className="p-5 rounded-xl border border-border bg-card shadow-sm">
          <label className="block text-sm font-medium text-foreground mb-3">Theme Mode</label>
          <div className="flex gap-3">
            <button 
              onClick={() => setThemeMode('light')}
              className={cn(
                "flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all",
                themeMode === 'light' ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-black/5"
              )}
            >
              Light
            </button>
            <button 
              onClick={() => setThemeMode('dark')}
              className={cn(
                "flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all",
                themeMode === 'dark' ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-white/5"
              )}
            >
              Dark
            </button>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-border bg-card shadow-sm">
          <label className="block text-sm font-medium text-foreground mb-3">Accent Color</label>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <input 
              type="color" 
              value={accentColor} 
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border-0 p-0 bg-transparent"
            />
            <div className="text-sm font-mono text-muted-foreground">{accentColor}</div>
            <button 
              onClick={() => setAccentColor('#007acc')}
              className="text-xs px-2 py-1 bg-black/5 dark:bg-white/5 rounded-md hover:opacity-80"
            >
              Reset
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { color: '#007acc', label: 'Blue' },
              { color: '#8b5cf6', label: 'Purple' },
              { color: '#10b981', label: 'Emerald' },
              { color: '#f59e0b', label: 'Amber' },
              { color: '#f43f5e', label: 'Rose' },
              { color: '#06b6d4', label: 'Cyan' },
              { color: '#84cc16', label: 'Lime' },
              { color: '#a855f7', label: 'Violet' },
            ].map(({ color, label }) => (
              <button
                key={color}
                onClick={() => setAccentColor(color)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:opacity-80 transition-opacity"
                style={{ backgroundColor: color + '20', color: color, borderColor: color + '40' }}
              >
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-xl border border-border bg-card shadow-sm">
          <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-2">
            <ImageIcon size={16} className="text-muted-foreground" />
            Custom Background Image
          </label>
          <p className="text-xs text-muted-foreground mb-3">Upload an image to set as your app background.</p>
          
          <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm text-muted-foreground hover:text-foreground mb-3">
            <Upload size={16} />
            Upload Image
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>

          {backgroundImage && (
            <div className="mt-3 relative">
              <Image
                src={backgroundImage}
                alt="Background preview"
                width={400}
                height={128}
                className="w-full h-32 object-cover rounded-lg border border-border"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                unoptimized
              />
              <button
                onClick={() => setBackgroundImage('')}
                className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                title="Remove background"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="p-5 rounded-xl border border-border bg-card shadow-sm">
          <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            Editor Settings
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={formatOnSave}
              onChange={(e) => setFormatOnSave(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-black/10 text-primary focus:ring-primary/20"
            />
            <span className="text-sm font-medium text-foreground">Format on Save</span>
          </label>
          <p className="text-xs text-muted-foreground mt-2 pl-7">Automatically format files using Prettier when saving (Ctrl+S).</p>

          <label className="flex items-center gap-3 cursor-pointer mt-4">
            <input 
              type="checkbox" 
              checked={codeAutocomplete}
              onChange={(e) => setCodeAutocomplete(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-black/10 text-primary focus:ring-primary/20"
            />
            <span className="text-sm font-medium text-foreground">Autocomplete Code</span>
          </label>
          <p className="text-xs text-muted-foreground mt-2 pl-7">Show inline code suggestions while typing in the editor.</p>
        </div>

        <div className="p-5 rounded-xl border border-border bg-card shadow-sm">
          <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            Agent Settings
          </label>
          
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={autoApprove}
                  onChange={(e) => setAutoApprove(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-black/10 text-primary focus:ring-primary/20"
                />
                <span className="text-sm font-medium text-foreground">Auto-Approve Tool Executions</span>
              </label>
              <p className="text-xs text-muted-foreground mt-2 pl-7">If disabled, the agent will ask for your permission before writing files, running commands, or deleting files.</p>
            </div>
            
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={checkpointsEnabled}
                  onChange={(e) => setCheckpointsEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-black/10 text-primary focus:ring-primary/20"
                />
                <span className="text-sm font-medium text-foreground">Auto-Checkpoints</span>
              </label>
              <p className="text-xs text-muted-foreground mt-2 pl-7">Automatically commit changes to Git before destructive actions.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMcpSkills = () => (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2 text-foreground">
          <Cpu size={20} className="text-muted-foreground" />
          MCP Servers & Tools
        </h2>
        <p className="text-xs text-muted-foreground mb-4">View integrated Model Context Protocol server capabilities.</p>
        
        <div className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">StitchMCP Server</span>
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] uppercase font-bold rounded">Connected</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">Registered Lazy Tools:</div>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
              {[
                'create_project', 'get_project', 'list_projects', 'list_screens',
                'get_screen', 'generate_screen_from_text', 'edit_screens', 'generate_variants',
                'upload_design_md', 'create_design_system', 'create_design_system_from_design_md',
                'update_design_system', 'list_design_systems', 'apply_design_system'
              ].map(t => (
                <span key={t} className="px-2 py-1 bg-muted border border-border rounded font-mono text-[10px] text-foreground/80 hover:text-foreground hover:bg-muted/80 cursor-default">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2 text-foreground">
          <Plus size={20} className="text-muted-foreground" />
          Custom Agent Skills
        </h2>
        <p className="text-xs text-muted-foreground mb-4">Add, edit, or delete short script routines the agent can run.</p>

        {/* Add Skill Form */}
        <form onSubmit={handleAddSkill} className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-3 mb-4">
          <div className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">Create New Skill</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              placeholder="Skill Name (e.g. Build Project)"
              className="bg-transparent border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary w-full"
            />
            <input
              type="text"
              value={newSkillDesc}
              onChange={(e) => setNewSkillDesc(e.target.value)}
              placeholder="Description of what this skill does"
              className="bg-transparent border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary w-full"
            />
          </div>
          <textarea
            value={newSkillCode}
            onChange={(e) => setNewSkillCode(e.target.value)}
            placeholder="Command or code to run (e.g. npm run build)"
            rows={2}
            className="bg-transparent border border-border rounded-lg px-3 py-1.5 text-xs text-foreground font-mono outline-none focus:ring-1 focus:ring-primary w-full resize-none"
          />
          <button type="submit" className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground hover:opacity-95 rounded text-xs font-semibold">
            <Plus size={12} />
            Add Skill
          </button>
        </form>

        {/* Skills List */}
        <div className="space-y-3">
          {skills.map((skill) => {
            const isEditing = editingSkillId === skill.id;
            return (
              <div key={skill.id} className="p-4 rounded-xl border border-border bg-card/50 shadow-sm flex flex-col gap-2">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editSkillName}
                        onChange={(e) => setEditSkillName(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground outline-none"
                      />
                      <input
                        type="text"
                        value={editSkillDesc}
                        onChange={(e) => setEditSkillDesc(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground outline-none"
                      />
                    </div>
                    <textarea
                      value={editSkillCode}
                      onChange={(e) => setEditSkillCode(e.target.value)}
                      rows={2}
                      className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground font-mono outline-none w-full resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setEditingSkillId(null)} className="px-2.5 py-1 hover:bg-muted border border-border text-xs rounded text-muted-foreground font-semibold">Cancel</button>
                      <button type="button" onClick={() => handleSaveSkillEdit(skill.id)} className="px-2.5 py-1 bg-primary text-primary-foreground text-xs rounded font-semibold flex items-center gap-1"><Save size={12} /> Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-bold text-foreground">{skill.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{skill.description}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => handleStartEdit(skill)} className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted" title="Edit Skill"><Edit2 size={12} /></button>
                        <button type="button" onClick={() => deleteSkill(skill.id)} className="p-1 text-muted-foreground hover:text-red-400 rounded hover:bg-muted" title="Delete Skill"><Trash2 size={12} /></button>
                      </div>
                    </div>
                    <div className="bg-muted border border-border px-2.5 py-1.5 rounded font-mono text-[10.5px] text-foreground/80 overflow-x-auto">{skill.code}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-foreground">
        <Bell size={20} className="text-muted-foreground" />
        Notification Preferences
      </h2>
      <div className="space-y-4">
        <div className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground block">Tool Approvals Required</label>
              <span className="text-xs text-muted-foreground block mt-0.5">Alerts when a background agent requests file access or execution validation.</span>
            </div>
            <input
              type="checkbox"
              checked={notificationPrefs?.toolExecution ?? true}
              onChange={(e) => updateNotificationPrefs({ toolExecution: e.target.checked })}
              className="w-4 h-4 rounded border-border bg-black/10 text-primary focus:ring-primary/20 shrink-0 cursor-pointer mt-1"
            />
          </div>
          
          <div className="h-px bg-border" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground block">Task Completion Notification</label>
              <span className="text-xs text-muted-foreground block mt-0.5">Alerts when long-running builds or multi-step agent actions complete.</span>
            </div>
            <input
              type="checkbox"
              checked={notificationPrefs?.completion ?? true}
              onChange={(e) => updateNotificationPrefs({ completion: e.target.checked })}
              className="w-4 h-4 rounded border-border bg-black/10 text-primary focus:ring-primary/20 shrink-0 cursor-pointer mt-1"
            />
          </div>
          
          <div className="h-px bg-border" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground block">Workspace Sync Logging</label>
              <span className="text-xs text-muted-foreground block mt-0.5">Show notifications when the background socket synchronization registers a file write/delete.</span>
            </div>
            <input
              type="checkbox"
              checked={notificationPrefs?.fsChange ?? false}
              onChange={(e) => updateNotificationPrefs({ fsChange: e.target.checked })}
              className="w-4 h-4 rounded border-border bg-black/10 text-primary focus:ring-primary/20 shrink-0 cursor-pointer mt-1"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderProviderConfig = (provider: AIProvider) => {
    const config = providerConfigs[provider] || { apiKey: '', baseUrl: '', model: '' };
    const isLocal = provider === 'ollama';

    return (
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground">
            <KeyRound size={20} className="text-muted-foreground" />
            {providerNames[provider]} Configuration
          </h2>
          {aiProvider !== provider && (
            <button
              onClick={() => setAiProvider(provider)}
              className="px-4 py-1.5 bg-primary hover:opacity-90 text-primary-foreground text-sm font-medium rounded-md transition-all"
            >
              Set as Active
            </button>
          )}
        </div>

        <div className="space-y-6">
          {!isLocal && (
            <div className="p-5 rounded-xl border border-border bg-card shadow-sm">
              <label className="block text-sm font-medium text-foreground mb-1">API Key</label>
              <p className="text-xs text-muted-foreground mb-3">Your API key for {providerNames[provider]}.</p>
              <div className="relative">
                <input 
                  type={showApiKey ? "text" : "password"} 
                  value={config.apiKey} 
                  onChange={(e) => updateProviderConfig(provider, { apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full bg-transparent border border-border rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          <div className="p-5 rounded-xl border border-border bg-card shadow-sm">
            <label className="block text-sm font-medium text-foreground mb-1">Model Name</label>
            <p className="text-xs text-muted-foreground mb-3">Enter the specific model ID to use.</p>
            <input 
              type="text" 
              value={config.model} 
              onChange={(e) => updateProviderConfig(provider, { model: e.target.value })}
              placeholder={isLocal ? "llama3" : "gpt-4o"}
              className="w-full bg-transparent border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="p-5 rounded-xl border border-border bg-card shadow-sm">
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium text-foreground w-full text-left"
            >
              {showAdvanced ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              Advanced Settings
            </button>
            
            {showAdvanced && (
              <div className="mt-4 pt-4 border-t border-border">
                <label className="block text-sm font-medium text-foreground mb-1">Base URL</label>
                <p className="text-xs text-muted-foreground mb-3">Override the default API endpoint.</p>
                <input 
                  type="text" 
                  value={config.baseUrl} 
                  onChange={(e) => updateProviderConfig(provider, { baseUrl: e.target.value })}
                  placeholder={DEFAULT_BASE_URLS[provider]}
                  className="w-full bg-transparent border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "flex-1 w-full h-full bg-background flex overflow-hidden z-50 relative",
        isNarrow ? "flex-col" : "flex-row"
      )}
    >
      {/* Settings Sidebar */}
      {!isNarrow && (
        <div className="w-64 border-r border-border bg-sidebar text-sidebar-foreground flex flex-col pt-6 shrink-0 min-w-0 max-w-[250px] transition-colors duration-200">
          <div className="px-6 mb-6 flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground truncate">Settings</h1>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1">
            <div className="mb-4 space-y-1">
              <button
                onClick={() => setActiveCategory('appearance')}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left",
                  activeCategory === 'appearance' 
                    ? "bg-primary/15 text-primary font-semibold" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Palette size={16} className="shrink-0" />
                <span className="truncate">Appearance</span>
              </button>

              <button
                onClick={() => setActiveCategory('mcp-skills')}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left",
                  activeCategory === 'mcp-skills' 
                    ? "bg-primary/15 text-primary font-semibold" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Cpu size={16} className="shrink-0" />
                <span className="truncate">MCP & Skills</span>
              </button>

              <button
                onClick={() => setActiveCategory('notifications')}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left",
                  activeCategory === 'notifications' 
                    ? "bg-primary/15 text-primary font-semibold" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Bell size={16} className="shrink-0" />
                <span className="truncate">Notifications</span>
              </button>
            </div>

            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
              AI Providers
            </div>
            
            {Object.entries(providerNames).map(([key, label]) => {
              const isProvider = key as AIProvider;
              const isActiveProvider = aiProvider === isProvider;
              const isSelected = activeCategory === isProvider;
              
              return (
                <button
                  key={key}
                  onClick={() => setActiveCategory(isProvider)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left group min-w-0",
                    isSelected 
                      ? "bg-primary/15 text-primary font-semibold" 
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    isActiveProvider && !isSelected && "text-primary"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", isActiveProvider ? "bg-primary" : "bg-transparent")} />
                    <span className="truncate flex-1">{label}</span>
                  </div>
                  {isActiveProvider && <Check size={14} className="text-primary opacity-80 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings Content Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Dropdown for Narrow Layouts */}
        {isNarrow && (
          <div className="p-4 border-b border-border bg-sidebar/50 shrink-0">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Settings Category
            </label>
            <div className="relative">
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value as 'appearance' | 'mcp-skills' | 'notifications' | AIProvider)}
                className="w-full bg-background border border-border rounded-lg pl-3 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground appearance-none cursor-pointer font-medium"
              >
                <option value="appearance">Appearance</option>
                <option value="mcp-skills">MCP & Skills</option>
                <option value="notifications">Notifications</option>
                <optgroup label="AI Providers">
                  {Object.entries(providerNames).map(([key, label]) => (
                    <option key={key} value={key as AIProvider}>
                      {label} {aiProvider === key ? ' (Active)' : ''}
                    </option>
                  ))}
                </optgroup>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                <ChevronDown size={16} />
              </div>
            </div>
          </div>
        )}

        {/* Settings Content Scroll Area */}
        <div className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-w-0",
          isNarrow ? "p-4" : "p-6 sm:p-8"
        )}>
          {activeCategory === 'appearance' 
            ? renderAppearance() 
            : activeCategory === 'mcp-skills'
              ? renderMcpSkills()
              : activeCategory === 'notifications'
                ? renderNotifications()
                : renderProviderConfig(activeCategory as AIProvider)
          }
        </div>
      </div>
    </motion.div>
  );
}
