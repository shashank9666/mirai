'use client';

import React from 'react';
import ActivityBar from '@/components/ide/ActivityBar';
import Sidebar from '@/components/ide/Sidebar';
import EditorStage from '@/components/ide/EditorStage';
import ChatPanel from '@/components/ide/ChatPanel';

export default function Home() {
  return (
    <main className="h-screen w-screen flex overflow-hidden text-[var(--color-text-normal)] select-none">
      <ActivityBar />
      <Sidebar />
      <EditorStage />
      <ChatPanel />
    </main>
  );
}
