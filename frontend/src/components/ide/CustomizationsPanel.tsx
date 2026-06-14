'use client';

import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, Plus, Play, Search, Trash2, Check, AlertCircle, Brain, Cpu, Shield, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAgentPrefsStore } from '@/store/agentPrefsStore';

interface CustomizationsPanelProps {
  onClose: () => void;
  defaultTab?: 'rules' | 'workflows' | 'preferences';
}

interface Rule {
  id: string;
  text: string;
  scope: 'global' | 'workspace';
  enabled: boolean;
}

interface Workflow {
  id: string;
  name: string;
  trigger: string;
  stepsCount: number;
  active: boolean;
}

export default function CustomizationsPanel({ onClose, defaultTab = 'rules' }: CustomizationsPanelProps) {
  const [activeTab, setActiveTab] = useState<'rules' | 'workflows' | 'preferences'>(defaultTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { prefs, updatePrefs, resetPrefs } = useAgentPrefsStore();

  // Initial Rules
  const [rules, setRules] = useState<Rule[]>([
    { id: '1', text: 'Prefer React 19 functional components and typescript types.', scope: 'global', enabled: true },
    { id: '2', text: 'Exclude build folders like .next/, dist/, out/ from search indexes.', scope: 'workspace', enabled: true },
    { id: '3', text: 'Write styling using vanilla CSS custom properties for dark/light mode.', scope: 'workspace', enabled: true },
    { id: '4', text: 'Ensure all tests run successfully before proposing commits.', scope: 'global', enabled: false },
    { id: '5', text: 'Keep helper functions inside /src/lib/ and export cleanly.', scope: 'workspace', enabled: true },
  ]);

  // Initial Workflows
  const [workflows, setWorkflows] = useState<Workflow[]>([
    { id: 'w1', name: 'Lint & Format Verification', trigger: 'pre-commit', stepsCount: 3, active: true },
    { id: 'w2', name: 'Build Production Artifacts', trigger: 'on-release', stepsCount: 5, active: true },
    { id: 'w3', name: 'Run Vitest Unit Suite', trigger: 'manual / push', stepsCount: 2, active: false },
  ]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const deleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleWorkflow = (id: string) => {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, active: !w.active } : w))
    );
  };

  const addRule = (scope: 'global' | 'workspace') => {
    const text = prompt(`Enter new ${scope} rule:`);
    if (text && text.trim()) {
      const newRule: Rule = {
        id: crypto.randomUUID(),
        text: text.trim(),
        scope,
        enabled: true,
      };
      setRules((prev) => [newRule, ...prev]);
    }
  };

  const filteredRules = rules.filter((r) =>
    r.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWorkflows = workflows.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-0 bg-[#0d0f12] z-50 flex flex-col font-sans"
    >
      {/* Top Header Navigation */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/[0.01]">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-2 py-1 text-white/50 hover:text-white/95 rounded hover:bg-white/5 transition-all text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Agent</span>
        </button>
      </div>

      {/* Main Content Title */}
      <div className="px-4 py-4 space-y-1">
        <h2 className="text-sm font-semibold text-white/95">Customizations</h2>
        <p className="text-[10px] text-white/40 font-mono">
          Configure rule sets, ignore behaviors, and custom workflows for the AI.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex px-4 border-b border-white/5 gap-4">
        <button
          onClick={() => setActiveTab('rules')}
          className={`pb-2 text-xs font-semibold relative transition-all ${
            activeTab === 'rules' ? 'text-white/95' : 'text-white/40 hover:text-white/70'
          }`}
        >
          Rules
          {activeTab === 'rules' && (
            <motion.div
              layoutId="customizations-tab-line"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('workflows')}
          className={`pb-2 text-xs font-semibold relative transition-all ${
            activeTab === 'workflows' ? 'text-white/95' : 'text-white/40 hover:text-white/70'
          }`}
        >
          Workflows
          {activeTab === 'workflows' && (
            <motion.div
              layoutId="customizations-tab-line"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={`pb-2 text-xs font-semibold relative transition-all ${
            activeTab === 'preferences' ? 'text-white/95' : 'text-white/40 hover:text-white/70'
          }`}
        >
          Preferences
          {activeTab === 'preferences' && (
            <motion.div
              layoutId="customizations-tab-line"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
            />
          )}
        </button>
      </div>

      {/* Filter and controls bar */}
      {activeTab !== 'preferences' && (
        <div className="px-4 py-3 flex gap-2 border-b border-white/5 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2 w-3.5 h-3.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder={activeTab === 'rules' ? 'Filter rules...' : 'Filter workflows...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1 bg-white/[0.02] border border-white/5 rounded text-[11px] text-white placeholder-white/30 focus:outline-none focus:border-white/10"
            />
          </div>

          <button
            onClick={handleRefresh}
            className="p-1.5 bg-white/[0.02] border border-white/5 rounded text-white/50 hover:text-white hover:bg-white/5 transition-all"
            title="Refresh view"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      )}

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
        {activeTab === 'rules' ? (
          <div className="space-y-4">
            {/* Scope Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => addRule('global')}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white/[0.03] border border-white/10 hover:border-white/20 hover:bg-white/[0.06] text-white/90 rounded text-[10px] font-mono transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                + Global Rule
              </button>
              <button
                onClick={() => addRule('workspace')}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white/[0.03] border border-white/10 hover:border-white/20 hover:bg-white/[0.06] text-white/90 rounded text-[10px] font-mono transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-purple-400" />
                + Workspace Rule
              </button>
            </div>

            {/* Rules items */}
            <div className="space-y-2.5">
              {filteredRules.length === 0 ? (
                <div className="text-center text-white/30 py-8 text-[11px] font-mono">
                  No rules found
                </div>
              ) : (
                filteredRules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-200 bg-white/[0.01] ${
                      rule.enabled
                        ? 'border-white/5'
                        : 'border-white/5 opacity-40 hover:opacity-75'
                    }`}
                  >
                    {/* Toggle button */}
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className={`mt-0.5 flex h-4.5 w-4.5 items-center justify-center rounded border transition-all shrink-0 ${
                        rule.enabled
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                          : 'bg-white/5 border-white/10 text-transparent'
                      }`}
                    >
                      <Check className="w-3 h-3 stroke-[3px]" />
                    </button>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-[11px] leading-relaxed text-white/80 select-all font-mono break-words">
                        {rule.text}
                      </p>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded font-mono ${
                            rule.scope === 'global'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-purple-500/10 text-purple-400'
                          }`}
                        >
                          {rule.scope}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="text-white/30 hover:text-red-400 p-1 rounded hover:bg-white/5 transition-all shrink-0"
                      title="Delete rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : activeTab === 'workflows' ? (
          <div className="space-y-3">
            {/* Workflows items */}
            {filteredWorkflows.length === 0 ? (
              <div className="text-center text-white/30 py-8 text-[11px] font-mono">
                No workflows found
              </div>
            ) : (
              filteredWorkflows.map((flow) => (
                <div
                  key={flow.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 bg-white/[0.01] ${
                    flow.active
                      ? 'border-white/5'
                      : 'border-white/5 opacity-40 hover:opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-md bg-white/[0.03] text-white/50 shrink-0">
                      <Play className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <h4 className="text-[11px] font-medium text-white/90 truncate">{flow.name}</h4>
                      <p className="text-[9px] text-white/40 font-mono">
                        Trigger: <span className="text-white/60">{flow.trigger}</span> • {flow.stepsCount} steps
                      </p>
                    </div>
                  </div>

                  {/* Switch toggle */}
                  <button
                    onClick={() => toggleWorkflow(flow.id)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      flow.active ? 'bg-blue-500' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        flow.active ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))
            )}

            <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg flex gap-2.5 items-start">
              <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <h5 className="text-[10px] font-semibold text-white/90">System Workflows</h5>
                <p className="text-[9px] text-white/50 font-mono leading-normal">
                  Workflows automate multi-step tasks like checking codebase formatting, verifying compilation, or running test-suites prior to generating responses.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header / Actions */}
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-white/90">Agent Preferences</span>
              </div>
              <button
                onClick={resetPrefs}
                className="px-2 py-1 rounded bg-white/[0.04] border border-white/5 hover:bg-white/[0.08] text-white/50 hover:text-white/80 transition-colors text-[9px] font-mono"
              >
                Reset Defaults
              </button>
            </div>

            {/* Context Window Settings */}
            <div className="space-y-3 p-3 rounded-lg border border-white/5 bg-white/[0.01]">
              <div className="flex items-center gap-1.5 text-white/70 font-semibold font-mono text-[10px]">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                Context Window
              </div>
              <div className="space-y-3 pl-1 font-mono text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="text-white/50">Max Context Tokens</span>
                  <select
                    className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded px-2.5 py-1 text-white/80 text-[10px] focus:outline-none focus:border-blue-500/50"
                    value={prefs.maxContextTokens}
                    onChange={(e) => updatePrefs({ maxContextTokens: parseInt(e.target.value) })}
                  >
                    <option value={32000}>32K</option>
                    <option value={64000}>64K</option>
                    <option value={128000}>128K</option>
                    <option value={256000}>256K</option>
                    <option value={512000}>512K</option>
                    <option value={1000000}>1M</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-white/50">Warning Threshold</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0.3}
                      max={0.95}
                      step={0.05}
                      value={prefs.contextWarningThreshold}
                      onChange={(e) => updatePrefs({ contextWarningThreshold: parseFloat(e.target.value) })}
                      className="w-20 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-white/80 w-8 text-right">{Math.round(prefs.contextWarningThreshold * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Token Management Settings */}
            <div className="space-y-3 p-3 rounded-lg border border-white/5 bg-white/[0.01]">
              <div className="flex items-center gap-1.5 text-white/70 font-semibold font-mono text-[10px]">
                <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                Token Management
              </div>
              <div className="space-y-3.5 pl-1">
                <PreferenceToggleRow
                  label="Auto-compact context"
                  desc="Automatically compact old messages when nearing limit"
                  checked={prefs.autoCompact}
                  onChange={(v) => updatePrefs({ autoCompact: v })}
                />
                <PreferenceToggleRow
                  label="Smart pruning"
                  desc="Remove redundant context instead of oldest messages"
                  checked={prefs.smartPruning}
                  onChange={(v) => updatePrefs({ smartPruning: v })}
                />
                <PreferenceToggleRow
                  label="Use compact summaries"
                  desc="Summarize old messages to save tokens"
                  checked={prefs.useCompactSummaries}
                  onChange={(v) => updatePrefs({ useCompactSummaries: v })}
                />
                <PreferenceToggleRow
                  label="Always include system prompt"
                  desc="Keep the system instructions in the request"
                  checked={prefs.alwaysIncludeSystemPrompt}
                  onChange={(v) => updatePrefs({ alwaysIncludeSystemPrompt: v })}
                />
              </div>
            </div>

            {/* Display Options */}
            <div className="space-y-3 p-3 rounded-lg border border-white/5 bg-white/[0.01]">
              <div className="flex items-center gap-1.5 text-white/70 font-semibold font-mono text-[10px]">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                Display Options
              </div>
              <div className="space-y-3.5 pl-1">
                <PreferenceToggleRow
                  label="Show token usage"
                  desc="Display token counts per message"
                  checked={prefs.showTokenUsage}
                  onChange={(v) => updatePrefs({ showTokenUsage: v })}
                />
                <PreferenceToggleRow
                  label="Show estimated cost"
                  desc="Calculate price of current session"
                  checked={prefs.showCost}
                  onChange={(v) => updatePrefs({ showCost: v })}
                />
              </div>
            </div>

            {/* Limits Settings */}
            <div className="space-y-3 p-3 rounded-lg border border-white/5 bg-white/[0.01]">
              <div className="flex items-center gap-1.5 text-white/70 font-semibold font-mono text-[10px]">
                <Shield className="w-3.5 h-3.5 text-red-400" />
                Limits
              </div>
              <div className="space-y-3 pl-1 font-mono text-[10px]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white/50">Max messages before compact</span>
                    <div className="text-white/30 text-[8px] font-sans mt-0.5">Auto-compact when this many messages accumulate</div>
                  </div>
                  <select
                    className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded px-2.5 py-1 text-white/80 text-[10px] focus:outline-none focus:border-blue-500/50"
                    value={prefs.maxMessagesBeforeCompact}
                    onChange={(e) => updatePrefs({ maxMessagesBeforeCompact: parseInt(e.target.value) })}
                  >
                    <option value={20}>20</option>
                    <option value={30}>30</option>
                    <option value={50}>50</option>
                    <option value={75}>75</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PreferenceToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between cursor-pointer group select-none">
      <div className="min-w-0 pr-2">
        <div className="text-white/50 group-hover:text-white/70 transition-colors font-mono text-[10px]">{label}</div>
        {desc && <div className="text-white/30 text-[8px] mt-0.5 leading-normal">{desc}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? 'bg-blue-500' : 'bg-white/10'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-3.5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
