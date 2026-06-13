'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, XCircle, Zap } from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import TaskTracking from './TaskTracking';

interface EditModalProps {
    isOpen: boolean;
    onClose: () => void;
    children?: React.ReactNode;
}

const THOUGHTS = [
    'Analyzing your request...',
    'Reading project files...',
    'Understanding codebase structure...',
    'Planning the best approach...',
    'Generating code changes...',
    'Reviewing for quality...',
    'Applying transformations...',
    'Almost done...',
];

export default function EditModal({ isOpen, onClose, children }: EditModalProps) {
    const isAgentRunning = useTaskStore((s) => s.isAgentRunning);
    const [thoughtIdx, setThoughtIdx] = useState(0);

    useEffect(() => {
        if (!isAgentRunning) return;
        const id = setInterval(() => {
            setThoughtIdx((prev) => (prev + 1) % THOUGHTS.length);
        }, 4000);
        return () => { clearInterval(id); setThoughtIdx(0); };
    }, [isAgentRunning]);

    if (!isOpen && !isAgentRunning) return null;

    return (
        <AnimatePresence>
            {(isOpen || isAgentRunning) && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
                    <motion.div initial={{ y: 20 }} animate={{ y: 0 }} exit={{ y: 20 }} className="relative w-full max-w-lg mx-4"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/80 backdrop-blur-2xl shadow-2xl">
                            <motion.div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20"
                                animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }} transition={{ duration: 3, repeat: Infinity }}
                                style={{ backgroundSize: '200% 200%' }} />
                            <div className="relative p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="relative w-10 h-10 flex items-center justify-center">
                                        <motion.div className="absolute inset-0 rounded-full bg-blue-500/20"
                                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
                                        <motion.div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600"
                                            animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                                            <Sparkles className="w-4 h-4 text-white" />
                                        </motion.div>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-semibold text-white/90">AI Agent Working</h3>
                                        <motion.p key={THOUGHTS[thoughtIdx]} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                                            className="text-[11px] font-mono text-blue-300/70">
                                            {THOUGHTS[thoughtIdx]}
                                        </motion.p>
                                    </div>
                                    <motion.div className="flex gap-1" animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                                        {[0, 1, 2].map((i) => (
                                            <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400" animate={{ y: [0, -4, 0] }}
                                                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                                        ))}
                                    </motion.div>
                                </div>
                                <TaskTracking />
                                {children && <div className="my-3 border-t border-white/5" />}
                                {children}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export function ApproveDisapproveButtons({ onChangeAccepted, onChangeRejected }: { changeId: string; onChangeAccepted: () => void; onChangeRejected: () => void; }) {
    return (
        <div className="flex items-center gap-1.5">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onChangeAccepted}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 text-[10px] font-mono transition-colors">
                <Zap className="w-3 h-3" /> Approve
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onChangeRejected}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 text-[10px] font-mono transition-colors">
                <XCircle className="w-3 h-3" /> Disapprove
            </motion.button>
        </div>
    );
}