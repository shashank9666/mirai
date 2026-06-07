import React from 'react';

export default function CanvasBackground() {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-background">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] mix-blend-screen" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[120px] mix-blend-screen" />
    </div>
  );
}
