'use client';

import dynamic from 'next/dynamic';

const ClientHome = dynamic(() => import('./ClientHome'), { 
  ssr: false,
  loading: () => (
    <div className="h-screen w-screen flex items-center justify-center bg-background text-foreground">
      Loading workspace...
    </div>
  )
});

export default function Page() {
  return <ClientHome />;
}
