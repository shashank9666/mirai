'use client';

import React from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import Waybar from '@/components/ide/Waybar';
import HyprSidebar from '@/components/ide/HyprSidebar';
import HyprEditor from '@/components/ide/HyprEditor';
import HyprChat from '@/components/ide/HyprChat';
import HyprTerminal from '@/components/ide/HyprTerminal';
import HyprStatusBar from '@/components/ide/HyprStatusBar';
import CommandPalette from '@/components/ide/CommandPalette';

// A styled resize handle for the glassmorphic aesthetic
const ResizeHandle = ({ direction = "horizontal" }: { direction?: "horizontal" | "vertical" }) => (
  <Separator className={`relative flex items-center justify-center transition-colors hover:bg-[var(--color-primary-accent)]/20 active:bg-[var(--color-primary-accent)]/40 ${direction === "horizontal" ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize"}`}>
    <div className={`rounded-full bg-white/20 ${direction === "horizontal" ? "w-1 h-8" : "w-8 h-1"}`} />
  </Separator>
);

export default function Home() {
  return (
    <main className="h-screen w-screen flex flex-col p-2 gap-2 overflow-hidden text-[var(--color-text-normal)] select-none">
      <CommandPalette />
      <Waybar />
      
      <div className="flex-1 min-h-0 w-full rounded-[20px] overflow-hidden">
        <Group orientation="vertical">
          {/* Main Top Area */}
          <Panel defaultSize={75} minSize={30}>
            <Group orientation="horizontal">
              {/* Left Sidebar */}
              <Panel defaultSize={20} minSize={10} maxSize={40} className="rounded-[20px] overflow-hidden shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]">
                <HyprSidebar />
              </Panel>

              <ResizeHandle />

              {/* Center Editor */}
              <Panel defaultSize={55} minSize={30} className="rounded-[20px] overflow-hidden shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]">
                <HyprEditor />
              </Panel>

              <ResizeHandle />

              {/* Right Assistant */}
              <Panel defaultSize={25} minSize={15} maxSize={40} className="rounded-[20px] overflow-hidden shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]">
                <HyprChat />
              </Panel>
            </Group>
          </Panel>

          <ResizeHandle direction="vertical" />

          {/* Bottom Terminal */}
          <Panel defaultSize={25} minSize={10} className="rounded-[20px] overflow-hidden shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]">
            <HyprTerminal />
          </Panel>
        </Group>
      </div>
      
      <HyprStatusBar />
    </main>
  );
}
