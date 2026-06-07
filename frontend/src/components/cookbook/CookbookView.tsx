import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, Cpu, HardDrive, RefreshCw } from 'lucide-react';

export default function CookbookView() {
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'running' | 'offline'>('checking');
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<{ total: number; completed: number; status: string } | null>(null);

  const RECOMMENDED_MODELS = [
    { name: 'llama3.2', description: 'Meta\'s latest compact model. Fast and capable.', size: '2.0 GB' },
    { name: 'qwen2.5-coder:7b', description: 'Excellent for coding tasks.', size: '4.7 GB' },
    { name: 'mistral', description: 'Strong general purpose open model.', size: '4.1 GB' }
  ];

  const checkOllama = async () => {
    try {
      const res = await fetch('http://localhost:11434/api/tags');
      if (res.ok) {
        const data = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setInstalledModels(data.models.map((m: any) => m.name));
        setOllamaStatus('running');
      } else {
        setOllamaStatus('offline');
      }
    } catch {
      setOllamaStatus('offline');
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      checkOllama();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const pullModel = async (modelName: string) => {
    try {
      setPullingModel(modelName);
      setPullProgress({ total: 100, completed: 0, status: 'Starting download...' });
      
      const response = await fetch('http://localhost:11434/api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName })
      });
      
      if (!response.body) throw new Error('No response body');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            setPullProgress({
              total: data.total || 100,
              completed: data.completed || 0,
              status: data.status || 'Downloading...'
            });
          } catch {
            // ignore JSON parse errors on partial chunks
          }
        }
      }
      
      await checkOllama();
    } catch (err) {
      console.error(err);
    } finally {
      setPullingModel(null);
      setPullProgress(null);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-background p-4 md:p-8 flex flex-col gap-6 text-foreground">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#a855f7] to-blue-500 bg-clip-text text-transparent break-words">
          Model Cookbook
        </h1>
        <p className="text-muted-foreground text-sm">Discover, download, and manage local open-source models directly into your workspace.</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-border bg-card shadow-sm">
        <div className={`p-3 rounded-full shrink-0 ${ollamaStatus === 'running' ? 'bg-green-500/10 text-green-500' : ollamaStatus === 'offline' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500 animate-pulse'}`}>
          <Cpu size={24} />
        </div>
        <div className="flex-1 min-w-[150px]">
          <h3 className="font-semibold text-base md:text-lg flex flex-wrap items-center gap-2">
            Local Ollama Engine
            {ollamaStatus === 'running' && <span className="text-[10px] md:text-xs font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-500 uppercase">Online</span>}
            {ollamaStatus === 'offline' && <span className="text-[10px] md:text-xs font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-500 uppercase">Offline</span>}
            {ollamaStatus === 'checking' && <span className="text-[10px] md:text-xs font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-500 uppercase">Checking...</span>}
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground break-words mt-1">
            {ollamaStatus === 'running' ? 'Connected to local engine. Ready to serve models.' : ollamaStatus === 'offline' ? 'Ollama is not running. Please install and start Ollama to use local models.' : 'Verifying connection...'}
          </p>
        </div>
        <button onClick={() => { setOllamaStatus('checking'); checkOllama(); }} className="p-2 hover:bg-muted rounded-lg transition-colors shrink-0">
          <RefreshCw size={18} className={ollamaStatus === 'checking' ? 'animate-spin' : ''} />
        </button>
      </div>

      <div 
        className="grid gap-4 md:gap-6" 
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}
      >
        {RECOMMENDED_MODELS.map((model) => {
          const isInstalled = installedModels.some(m => m.startsWith(model.name));
          const isPulling = pullingModel === model.name;
          
          return (
            <div key={model.name} className="relative group overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-all flex flex-col">
              <div className="absolute inset-0 bg-gradient-to-br from-[#a855f7]/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative z-10 flex flex-col h-full gap-3">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <h4 className="font-bold text-base md:text-lg font-mono break-all">{model.name}</h4>
                  <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full shrink-0">
                    <HardDrive size={12} />
                    {model.size}
                  </div>
                </div>
                
                <p className="text-xs md:text-sm text-muted-foreground flex-1">
                  {model.description}
                </p>

                {isPulling && pullProgress ? (
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="text-[10px] md:text-xs font-medium flex justify-between">
                      <span className="truncate pr-2">{pullProgress.status}</span>
                      <span className="shrink-0">{pullProgress.total > 100 ? Math.round((pullProgress.completed / pullProgress.total) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#a855f7] transition-all duration-300"
                        style={{ width: `${pullProgress.total > 100 ? (pullProgress.completed / pullProgress.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    disabled={isInstalled || ollamaStatus !== 'running'}
                    onClick={() => pullModel(model.name)}
                    className={`mt-2 flex items-center justify-center gap-2 w-full py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all ${
                      isInstalled
                        ? 'bg-green-500/10 text-green-500 cursor-default'
                        : ollamaStatus !== 'running'
                        ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] shadow-sm'
                    }`}
                  >
                    {isInstalled ? (
                      <>
                        <CheckCircle size={14} className="md:w-4 md:h-4" />
                        Installed
                      </>
                    ) : (
                      <>
                        <Download size={14} className="md:w-4 md:h-4" />
                        Download
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
