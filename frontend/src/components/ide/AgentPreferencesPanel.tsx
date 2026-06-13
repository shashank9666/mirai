'use client';

import React, { useState } from 'react';
import {
  AgentPreferences,
  DEFAULT_AGENT_PREFERENCES,
  getModelPricing,
  formatTokens,
  MODEL_PRICING,
} from '@/lib/agent/policies';
import { Settings2, Cpu, DollarSign, RefreshCw, Brain, Zap, Shield } from 'lucide-react';

interface AgentPreferencesPanelProps {
  prefs: AgentPreferences;
  onSave: (prefs: AgentPreferences) => void;
  onClose?: () => void;
  selectedModel?: string;
}

export default function AgentPreferencesPanel({
  prefs,
  onSave,
  onClose,
  selectedModel = 'gpt-4o',
}: AgentPreferencesPanelProps) {
  const [local, setLocal] = useState<AgentPreferences>({ ...prefs });
  const pricing = getModelPricing(selectedModel);

  const update = (key: keyof AgentPreferences, value: number | boolean) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setLocal({ ...DEFAULT_AGENT_PREFERENCES });
  };

  const handleSave = () => {
    onSave(local);
    onClose?.();
  };

  const estCostPer1KInput = pricing.input;
  const estCostPer1KOutput = pricing.output;

  return (
    <div className="flex flex-col h-full text-[11px] font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold text-white/90">Agent Preferences</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-2 py-1 rounded-md bg-white/5 text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors text-[10px]"
          >
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 rounded-md bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors text-[10px]"
          >
            Save
          </button>
          {onClose && (
            <button onClick={onClose} className="text-white/40 hover:text-white/80">✕</button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
        {/* Model Pricing Info */}
        <div className="bg-white/5 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-white/70 font-semibold mb-2">
            <DollarSign className="w-3.5 h-3.5" />
            Model Pricing ({selectedModel})
          </div>
          <div className="flex gap-4 text-[10px]">
            <div className="bg-white/5 rounded px-2 py-1.5">
              <div className="text-white/40">Input</div>
              <div className="text-white/80">${estCostPer1KInput.toFixed(4)} / 1K tokens</div>
            </div>
            <div className="bg-white/5 rounded px-2 py-1.5">
              <div className="text-white/40">Output</div>
              <div className="text-white/80">${estCostPer1KOutput.toFixed(4)} / 1K tokens</div>
            </div>
          </div>
        </div>

        {/* Context Window */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-white/70 font-semibold">
            <Cpu className="w-3.5 h-3.5" />
            Context Window
          </div>

          <div className="space-y-2 pl-1">
            <div className="flex items-center justify-between">
              <label className="text-white/50">Max Context Tokens</label>
              <select
                className="bg-white/10 border border-white/10 rounded px-2 py-1 text-white/80 text-[10px]"
                value={local.maxContextTokens}
                onChange={(e) => update('maxContextTokens', parseInt(e.target.value))}
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
              <label className="text-white/50">Warning Threshold</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0.3}
                  max={0.95}
                  step={0.05}
                  value={local.contextWarningThreshold}
                  onChange={(e) => update('contextWarningThreshold', parseFloat(e.target.value))}
                  className="w-20"
                />
                <span className="text-white/80 w-8 text-right">{Math.round(local.contextWarningThreshold * 100)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Token Management */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-white/70 font-semibold">
            <RefreshCw className="w-3.5 h-3.5" />
            Token Management
          </div>

          <div className="space-y-2 pl-1">
            <ToggleRow
              label="Auto-compact context"
              desc="Automatically compact old messages when nearing limit"
              checked={local.autoCompact}
              onChange={(v) => update('autoCompact', v)}
            />
            <ToggleRow
              label="Smart pruning"
              desc="Remove redundant context instead of oldest messages"
              checked={local.smartPruning}
              onChange={(v) => update('smartPruning', v)}
            />
            <ToggleRow
              label="Use compact summaries"
              desc="Summarize old messages to save tokens"
              checked={local.useCompactSummaries}
              onChange={(v) => update('useCompactSummaries', v)}
            />
            <ToggleRow
              label="Always include system prompt"
              checked={local.alwaysIncludeSystemPrompt}
              onChange={(v) => update('alwaysIncludeSystemPrompt', v)}
            />
          </div>
        </div>

        {/* Display */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-white/70 font-semibold">
            <Zap className="w-3.5 h-3.5" />
            Display
          </div>

          <div className="space-y-2 pl-1">
            <ToggleRow
              label="Show token usage"
              desc="Display token counts per message"
              checked={local.showTokenUsage}
              onChange={(v) => update('showTokenUsage', v)}
            />
            <ToggleRow
              label="Show estimated cost"
              checked={local.showCost}
              onChange={(v) => update('showCost', v)}
            />
          </div>
        </div>

        {/* Safety */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-white/70 font-semibold">
            <Shield className="w-3.5 h-3.5" />
            Limits
          </div>

          <div className="space-y-2 pl-1">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white/50">Max messages before compact</div>
                <div className="text-white/30 text-[9px]">Auto-compact when this many messages accumulate</div>
              </div>
              <select
                className="bg-white/10 border border-white/10 rounded px-2 py-1 text-white/80 text-[10px]"
                value={local.maxMessagesBeforeCompact}
                onChange={(e) => update('maxMessagesBeforeCompact', parseInt(e.target.value))}
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
    </div>
  );
}

function ToggleRow({
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
    <label className="flex items-center justify-between cursor-pointer group">
      <div>
        <div className="text-white/50 group-hover:text-white/70 transition-colors">{label}</div>
        {desc && <div className="text-white/30 text-[9px]">{desc}</div>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded bg-white/10 border-white/20 checked:bg-purple-500 checked:border-transparent focus:ring-0 cursor-pointer"
      />
    </label>
  );
}