'use client';

import React from 'react';
import { useChatStore } from '@/store/chatStore';
import {
  contextWindowUsage,
  getContextColor,
  formatTokens,
  formatCost,
  estimateCost,
  getModelPricing,
  DEFAULT_AGENT_PREFERENCES,
} from '@/lib/agent/policies';
import { AlertTriangle, DollarSign, Minimize2, Cpu } from 'lucide-react';

interface ContextWindowBarProps {
  modelName?: string;
  maxContextTokens?: number;
  onCompact?: () => void;
}

export default function ContextWindowBar({
  modelName = 'gpt-4o',
  maxContextTokens = 128000,
  onCompact,
}: ContextWindowBarProps) {
  // Subscribe to primitive values to avoid infinite re-renders from getTokenBreakdown() returning new objects
  const totalInputTokens = useChatStore((s) => s.totalInputTokens);
  const totalOutputTokens = useChatStore((s) => s.totalOutputTokens);
  const messageCount = useChatStore((s) => s.messages.length);

  const total = totalInputTokens + totalOutputTokens;
  const usagePercent = contextWindowUsage(total, maxContextTokens);
  const color = getContextColor(usagePercent, DEFAULT_AGENT_PREFERENCES.contextWarningThreshold);
  const pricing = getModelPricing(modelName);
  const estimatedCost = estimateCost(totalInputTokens, totalOutputTokens, {
    ...DEFAULT_AGENT_PREFERENCES,
    inputCostPer1K: pricing.input,
    outputCostPer1K: pricing.output,
  });

  const isNearLimit = usagePercent >= 70;
  const isCritical = usagePercent >= 95;

  return (
    <div className={`flex items-center gap-3 text-[10px] font-mono h-full px-3 ${isCritical ? 'bg-red-500/10' :
      isNearLimit ? 'bg-amber-500/5' :
        ''
      }`}>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <Cpu className="w-3 h-3 text-white/40 shrink-0" />
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.max(2, usagePercent)}%`,
              backgroundColor: color,
              boxShadow: isNearLimit ? `0 0 6px ${color}` : 'none',
            }}
          />
        </div>
        <span className="text-white/50 shrink-0 min-w-[60px] text-right">
          {formatTokens(total)} / {formatTokens(maxContextTokens)}
        </span>
        <span className="text-white/40 shrink-0" style={{ color }}>({usagePercent}%)</span>
      </div>

      <div className="flex items-center gap-2 text-white/40 shrink-0">
        <span title="Input tokens">IN: {formatTokens(totalInputTokens)}</span>
        <span title="Output tokens">OUT: {formatTokens(totalOutputTokens)}</span>
        <span title={`Estimated cost: ${formatCost(estimatedCost)}`} className="flex items-center gap-0.5">
          <DollarSign className="w-2.5 h-2.5" />
          {formatCost(estimatedCost)}
        </span>
      </div>

      {(isNearLimit || messageCount > 30) && onCompact && (
        <button
          onClick={onCompact}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${isCritical
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
            }`}
          title="Compact context to save tokens"
        >
          <Minimize2 className="w-3 h-3" />
          Compact
        </button>
      )}

      {isCritical && (
        <span className="flex items-center gap-1 text-red-400 animate-pulse shrink-0">
          <AlertTriangle className="w-3 h-3" />
          Near limit
        </span>
      )}
    </div>
  );
}