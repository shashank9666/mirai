'use client';

import React, { useState } from 'react';
import Editor from '@monaco-editor/react';

export default function HyprEditor() {
  const [code, setCode] = useState('import { motion } from "framer-motion";\n\nexport default function App() {\n  return (\n    <motion.div\n      initial={{ opacity: 0 }}\n      animate={{ opacity: 1 }}\n      className="awesome-hyprland-rice"\n    >\n      // The background blur bleeds right through!\n    </motion.div>\n  );\n}\n');

  return (
    <div className="hypr-panel flex-1 flex flex-col overflow-hidden relative">
      <div className="h-12 border-b border-white/5 flex items-center px-4 justify-between bg-black/10">
        <div className="flex gap-2">
          <div className="text-xs font-mono text-white/70 bg-white/10 px-3 py-1.5 rounded-lg border border-white/5 shadow-sm backdrop-blur-md">
            page.tsx
          </div>
        </div>
      </div>
      
      <div className="flex-1 relative p-2">
        <Editor
          height="100%"
          defaultLanguage="typescript"
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value || '')}
          options={{
            minimap: { enabled: true, renderCharacters: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Inter', monospace",
            padding: { top: 16 },
            lineHeight: 24,
            roundedSelection: false,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            renderLineHighlight: "none",
          }}
          onMount={(editor, monaco) => {
            // Force Monaco theme background to be transparent
            monaco.editor.defineTheme('transparent', {
              base: 'vs-dark',
              inherit: true,
              rules: [],
              colors: {
                'editor.background': '#00000000',
                'editor.lineHighlightBackground': '#ffffff0a',
                'minimap.background': '#00000000'
              }
            });
            monaco.editor.setTheme('transparent');
          }}
        />
      </div>
    </div>
  );
}
