'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, GitBranch, Bug, FileCode, X, Bell, Check } from 'lucide-react';
import { getBackendBase } from '@/lib/api';
import { playSound } from '@/lib/soundEffects';

export interface ProactiveEvent {
    id: string;
    type: string;
    description: string;
    file_path: string;
    metadata: Record<string, unknown>;
    timestamp: number;
    acknowledged: boolean;
    agent_responded: boolean;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
    build_failed: <Bug size={14} className="text-red-400" />,
    test_failed: <AlertTriangle size={14} className="text-orange-400" />,
    git_conflict: <GitBranch size={14} className="text-yellow-400" />,
    lint_error: <FileCode size={14} className="text-purple-400" />,
    terminal_error: <Bug size={14} className="text-red-400" />,
    file_saved: <FileCode size={14} className="text-blue-400" />,
};

const EVENT_COLORS: Record<string, string> = {
    build_failed: 'border-red-500/30 bg-red-500/5',
    test_failed: 'border-orange-500/30 bg-orange-500/5',
    git_conflict: 'border-yellow-500/30 bg-yellow-500/5',
    lint_error: 'border-purple-500/30 bg-purple-500/5',
    terminal_error: 'border-red-500/30 bg-red-500/5',
    file_saved: 'border-blue-500/30 bg-blue-500/5',
};

interface ProactiveNotificationsProps {
    onEventClick?: (event: ProactiveEvent) => void;
    maxVisible?: number;
}

export default function ProactiveNotifications({
    onEventClick,
    maxVisible = 3,
}: ProactiveNotificationsProps) {
    const [events, setEvents] = useState<ProactiveEvent[]>([]);
    const [unackCount, setUnackCount] = useState(0);
    const [expanded, setExpanded] = useState(false);

    const fetchEvents = useCallback(async () => {
        try {
            const res = await fetch(`${getBackendBase()}/api/events?unacknowledged=true&limit=10`);
            const data = await res.json();
            const newEvents = data.events || [];
            setEvents(newEvents);
            setUnackCount(newEvents.length);

            // Play sound for new events
            if (newEvents.length > 0 && newEvents.length > events.length) {
                playSound('notification');
            }
        } catch {
            // Backend may not be running
        }
    }, [events.length]);

    // Poll for events
    useEffect(() => {
        const id = setInterval(fetchEvents, 5000);
        return () => clearInterval(id);
    }, [fetchEvents]);

    const handleAcknowledge = async (eventId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await fetch(`${getBackendBase()}/api/events/ack/${eventId}`, {
                method: 'POST',
            });
            setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
            setUnackCount((prev) => Math.max(0, prev - 1));
        } catch {
            // Ignore
        }
    };

    const handleDismissAll = async () => {
        try {
            await fetch(`${getBackendBase()}/api/events/clear`, {
                method: 'POST',
            });
            setEvents([]);
            setUnackCount(0);
        } catch {
            // Ignore
        }
    };

    const visibleEvents = expanded ? events : events.slice(0, maxVisible);

    if (events.length === 0) return null;

    return (
        <div className="flex flex-col gap-1.5">
            {/* Header */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-1.5">
                    <Bell size={12} className="text-zinc-400" />
                    <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                        Events
                    </span>
                    {unackCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-500/20 text-red-400 rounded-full">
                            {unackCount}
                        </span>
                    )}
                </div>
                <button
                    onClick={handleDismissAll}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                    Clear all
                </button>
            </div>

            {/* Event cards */}
            <AnimatePresence>
                {visibleEvents.map((event) => (
                    <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: -10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, x: 50, height: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => onEventClick?.(event)}
                        className={`relative cursor-pointer border rounded-md px-3 py-2 transition-colors hover:brightness-110 ${EVENT_COLORS[event.type] || 'border-zinc-700/30 bg-zinc-800/30'
                            }`}
                    >
                        <div className="flex items-start gap-2">
                            <div className="mt-0.5 shrink-0">
                                {EVENT_ICONS[event.type] || (
                                    <Bell size={14} className="text-zinc-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-medium text-zinc-200 truncate">
                                    {event.description}
                                </div>
                                {event.file_path && (
                                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                                        {event.file_path}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={(e) => handleAcknowledge(event.id, e)}
                                className="shrink-0 p-1 rounded hover:bg-zinc-700/50 transition-colors"
                                title="Dismiss"
                            >
                                <X size={10} className="text-zinc-500" />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Show more */}
            {events.length > maxVisible && !expanded && (
                <button
                    onClick={() => setExpanded(true)}
                    className="text-[10px] text-blue-400 hover:text-blue-300 text-center"
                >
                    +{events.length - maxVisible} more
                </button>
            )}
        </div>
    );
}