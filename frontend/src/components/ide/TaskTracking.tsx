'use client';

import { useTaskStore } from '@/store/taskStore';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2, XCircle, Clock, Code, FileSearch, Terminal, Globe, Brain } from 'lucide-react';

const typeIcons: Record<string, React.ReactNode> = {
    read: <FileSearch className="w-3 h-3" />,
    write: <Code className="w-3 h-3" />,
    edit: <Code className="w-3 h-3" />,
    search: <FileSearch className="w-3 h-3" />,
    execute: <Terminal className="w-3 h-3" />,
    browse: <Globe className="w-3 h-3" />,
    think: <Brain className="w-3 h-3" />,
    other: <Brain className="w-3 h-3" />,
};

const statusColors: Record<string, string> = {
    'in-progress': 'text-blue-400',
    pending: 'text-yellow-400',
    completed: 'text-emerald-400',
    failed: 'text-red-400',
    cancelled: 'text-gray-500',
};

export default function TaskTracking({ compact = false }: { compact?: boolean }) {
    const { tasks, getActiveTasks, currentTaskId } = useTaskStore();
    const activeTasks = getActiveTasks();
    const currentTask = tasks.find(t => t.id === currentTaskId);

    if (tasks.length === 0 && !currentTask) return null;

    return (
        <div className="flex flex-col gap-1">
            {/* Current active task with thinking animation */}
            <AnimatePresence>
                {currentTask && (
                    <motion.div
                        key={currentTask.id}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20"
                    >
                        <div className="relative w-4 h-4 flex items-center justify-center">
                            <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                            <motion.div
                                className="absolute inset-0 rounded-full border-2 border-blue-400/30"
                                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-blue-300">{typeIcons[currentTask.type]}</span>
                                <span className="text-[11px] font-mono text-blue-200 truncate">{currentTask.title}</span>
                            </div>
                            {currentTask.description && (
                                <p className="text-[9px] font-mono text-blue-300/60 truncate">{currentTask.description}</p>
                            )}
                        </div>
                        {currentTask.progress !== undefined && (
                            <div className="w-12 h-1 bg-blue-500/20 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-blue-400 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${currentTask.progress}%` }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Recent tasks list */}
            {!compact && tasks.length > 0 && (
                <div className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {[...tasks].reverse().slice(0, 20).map((task) => (
                        <div
                            key={task.id}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 transition-colors"
                        >
                            {task.status === 'completed' && <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />}
                            {task.status === 'failed' && <XCircle className="w-3 h-3 text-red-400 shrink-0" />}
                            {task.status === 'in-progress' && <Loader2 className="w-3 h-3 text-blue-400 animate-spin shrink-0" />}
                            {task.status === 'pending' && <Clock className="w-3 h-3 text-yellow-400 shrink-0" />}
                            <span className={`text-[10px] font-mono truncate ${statusColors[task.status] || 'text-white/50'}`}>
                                {task.title}
                            </span>
                            {task.progress !== undefined && task.status === 'in-progress' && (
                                <span className="text-[9px] text-white/30 ml-auto">{task.progress}%</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}