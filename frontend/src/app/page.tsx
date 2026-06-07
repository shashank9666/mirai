'use client';

import React from 'react';
import Waybar from '@/components/ide/Waybar';
import HyprSidebar from '@/components/ide/HyprSidebar';
import HyprEditor from '@/components/ide/HyprEditor';
import HyprChat from '@/components/ide/HyprChat';
import HyprTerminal from '@/components/ide/HyprTerminal';

export default function Home() {
  return (
    <main className="h-screen w-screen flex flex-col p-4 gap-4 overflow-hidden text-[var(--color-text-normal)] select-none">
      <Waybar />
      
      <div className="flex-1 flex gap-4 min-h-0">
        <HyprSidebar />
        <HyprEditor />
        <HyprChat />
      </div>
      
      <HyprTerminal />
    </main>
  );
}
