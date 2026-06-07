'use client';

import React, { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { themeMode, accentColor, backgroundImage } = useSettingsStore();

  useEffect(() => {
    const root = document.documentElement;
    
    // Apply dark/light mode class
    if (themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Notify Electron about theme change
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== 'undefined' && (window as any).electronAPI?.themeChanged) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).electronAPI.themeChanged(themeMode);
    }
    
    // Apply custom accent color
    if (accentColor && accentColor !== '#007acc') {
      root.style.setProperty('--primary', accentColor);
      root.style.setProperty('--ring', accentColor);
      root.style.setProperty('--mirai-accent', accentColor);
    } else {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
      root.style.removeProperty('--mirai-accent');
    }

    // Apply background image globally
    if (backgroundImage) {
      document.body.style.backgroundImage = `url(${backgroundImage})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
      
      if (themeMode === 'dark') {
        root.style.setProperty('--background', 'rgba(30, 30, 30, 0.5)');
      } else {
        root.style.setProperty('--background', 'rgba(255, 255, 255, 0.5)');
      }
    } else {
      document.body.style.backgroundImage = '';
      root.style.removeProperty('--background');
    }
  }, [themeMode, accentColor, backgroundImage]);

  return <>{children}</>;
}
