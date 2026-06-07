'use client';

import React from 'react';
import CanvasBackground from '@/components/layout/CanvasBackground';
import FloatingSidebar from '@/components/layout/FloatingSidebar';
import HeroEditor from '@/components/layout/HeroEditor';
import AgentOverlay from '@/components/layout/AgentOverlay';

export default function Home() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 lg:p-8">
      <CanvasBackground />
      <div className="w-full max-w-[1400px] h-[90vh] flex overflow-hidden">
        <FloatingSidebar />
        <HeroEditor />
        <AgentOverlay />
      </div>
    </main>
  );
}
