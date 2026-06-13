import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';

export default function ShikiHighlighter({ code, language }: { code: string; language: string }) {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    let active = true;
    const highlight = async () => {
      try {
        const result = await codeToHtml(code, {
          lang: language || 'text',
          theme: 'vitesse-dark'
        });
        if (active) setHtml(result);
      } catch {
        // Fallback if language isn't supported or fails
        if (active) setHtml(`<pre><code>${code}</code></pre>`);
      }
    };
    highlight();
    return () => { active = false; };
  }, [code, language]);

  if (!html) return <div className="animate-pulse bg-white/5 rounded min-h-[4rem] w-full" />;

  return (
    <div 
      dangerouslySetInnerHTML={{ __html: html }} 
      className="shiki-container text-[11px] overflow-x-auto custom-scrollbar rounded-md bg-black/40 border border-white/5 my-2 p-3" 
    />
  );
}
