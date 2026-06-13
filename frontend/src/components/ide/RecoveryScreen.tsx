'use client';

import React from 'react';
import { WifiOff, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RecoveryScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a16] overflow-hidden select-none">
      {/* Background ambient glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '12s' }} />

      {/* Main glassmorphism card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative px-8 py-12 rounded-2xl bg-white/[0.02] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl max-w-md w-full mx-4 flex flex-col items-center text-center gap-6"
      >
        {/* Glow behind the icon */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-[var(--color-primary-accent,rgba(124,58,237,0.3))] rounded-full blur-2xl opacity-60" />

        {/* Floating icon wrapper */}
        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-inner relative z-10">
          <WifiOff className="w-8 h-8 text-[var(--color-primary-accent,#7C3AED)] animate-bounce" style={{ animationDuration: '3s' }} />
        </div>

        {/* Text Area */}
        <div className="space-y-3">
          <h1 className="text-xl font-bold font-mono tracking-widest text-white uppercase bg-clip-text">
            We Will be right back....
          </h1>
          <p className="text-[12px] font-mono text-white/50 leading-relaxed max-w-[280px] mx-auto">
            Mirai IDE is currently disconnected from the Python backend server.
          </p>
        </div>

        {/* Action / Reconnecting State */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 font-mono text-[10px] text-[var(--color-primary-accent,#7C3AED)] font-bold tracking-wider uppercase">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Reconnecting to server...</span>
        </div>
      </motion.div>
    </div>
  );
}
