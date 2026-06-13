'use client';

import React, { useState, useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useAiStore } from '@/store/aiStore';
import { formatTokens, formatCost, estimateCost, getModelPricing } from '@/lib/agent/policies';
import { Lightbulb, TrendingDown, MessageSquare, FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface Tip {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: string;
}

export default function TokenOptimizationTips() {
  const { messages, totalInputTokens, totalOutputTokens } = useChatStore();
  const { aiProviders, activeAiProviderId } = useAiStore();
  const [isOpen, setIsOpen] = useState(false);
  const [tips, setTips] = useState<Tip[]>([]);

  const activeProvider = aiProviders.find((p) => p.id === activeAiProviderId);
  const pricing = getModelPricing(activeProvider?.model || 'gpt-4o');
  const estimatedCost = estimateCost(totalInputTokens, totalOutputTokens, {
    inputCostPer1K: pricing.input,
    outputCostPer1K: pricing.output,
  } as any);

  useEffect(() => {
    const newTips: Tip[] = [];

    if (messages.length > 30) {
      newTips.push({
        icon: <MessageSquare className="w-3.5 h-3.5 text-amber-400" />,
        title: 'Many messages accumulated',
        description: `${messages.length} messages in context. Each adds ~${formatTokens(messages.length * 100)} tokens.`,
        action: 'Clear old conversations or start a new chat.',
      });
    }

    if (totalInputTokens > 50000) {
      newTips.push({
        icon: <TrendingDown className="w-3.5 h-3.5 text-blue-400" />,
        title: 'Large input context',
        description: `${formatTokens(totalInputTokens)} input tokens used. Cost: ${formatCost(estimatedCost)}.`,
        action: 'Consider using a more efficient model for large contexts.',
      });
    }

    if (totalInputTokens > 0 && totalOutputTokens > totalInputTokens * 2) {
      newTips.push({
        icon: <TrendingDown className="w-3.5 h-3.5 text-purple-400" />,
        title: 'Output-heavy conversation',
        description: `Output (${formatTokens(totalOutputTokens)}) is >2x input (${formatTokens(totalInputTokens)}).`,
        action: 'Shorter prompts may reduce verbose responses.',
      });
    }

    const longFiles = messages.filter((m) => m.content && m.content.length > 5000);
    if (longFiles.length > 0) {
      newTips.push({
        icon: <FileText className="w-3.5 h-3.5 text-yellow-400" />,
        title: 'Large files in context',
        description: `${longFiles.length} message(s) contain >5K characters of file content.`,
        action: 'Only include relevant sections, not entire files.',
      });
    }

    if (estimatedCost > 0.05) {
      newTips.push({
        icon: <TrendingDown className="w-3.5 h-3.5 text-green-400" />,
        title: 'Cost-saving opportunity',
        description: `Estimated cost: ${formatCost(estimatedCost)}. A cheaper model could save ~70%.`,
        action: `Switch to ${activeProvider?.model?.includes('gpt-4') ? 'gpt-4o-mini' : 'a cheaper model'} for simple tasks.`,
      });
    }

    setTips(newTips);
  }, [messages.length, totalInputTokens, totalOutputTokens, estimatedCost, activeProvider]);

  if (tips.length === 0 && messages.length < 5) return null;

  return (
    <div className="border-t border-white/5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-mono text-white/40 hover:text-white/70 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Lightbulb className="w-3 h-3" />
          <span>Token Optimization Tips ({tips.length})</span>
        </div>
        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {isOpen && tips.length > 0 && (
        <div className="px-3 pb-2 space-y-1.5">
          {tips.map((tip, i) => (
            <div key={i} className="bg-white/5 rounded-lg px-2.5 py-2 text-[10px] font-mono">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">{tip.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white/70 font-medium mb-0.5">{tip.title}</div>
                  <div className="text-white/40 mb-0.5">{tip.description}</div>
                  {tip.action && (
                    <div className="text-blue-400/70 text-[9px]">{tip.action}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}