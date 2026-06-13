'use client';

import { useLayoutEffect } from 'react';

export default function ThemeHydration() {
  useLayoutEffect(() => {
    try {
      const data = localStorage.getItem('mirai-ide-storage');
      if (!data) return;

      const parsed = JSON.parse(data);
      const settings = parsed?.state?.editorSettings;
      const zoom = parsed?.state?.zoom || 1.0;

      if (settings) {
        if (settings.appTheme === 'light') {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
        } else {
          document.documentElement.classList.remove('light');
          document.documentElement.classList.add('dark');
        }

        if (settings.accentColor) {
          document.documentElement.style.setProperty('--color-primary-accent', settings.accentColor);
        }

        document.documentElement.style.setProperty(
          '--bg-image',
          settings.backgroundImage
            ? `url(${settings.backgroundImage})`
            : (settings.wallpaperPreset && settings.wallpaperPreset !== 'none'
              ? `url(/wallpapers/${settings.wallpaperPreset}.svg)`
              : 'none')
        );

        let bg = `rgba(26, 26, 46, ${settings.panelOpacity ?? 0.6})`;
        if (settings.appTheme === 'solid') bg = '#1a1a2e';
        if (settings.appTheme === 'dark') bg = '#050505';
        if (settings.appTheme === 'light') bg = '#f8fafc';

        document.documentElement.style.setProperty('--panel-bg', bg);
        document.documentElement.style.setProperty(
          '--panel-backdrop',
          settings.appTheme === 'glass' ? `blur(${settings.panelBlur ?? 16}px)` : 'none'
        );
      }

      if (zoom) {
        document.documentElement.style.setProperty('--app-zoom', zoom !== 1.0 ? `scale(${zoom})` : 'none');
        document.documentElement.style.setProperty('--app-width', zoom !== 1.0 ? `${100 / zoom}vw` : '100vw');
        document.documentElement.style.setProperty('--app-height', zoom !== 1.0 ? `${100 / zoom}vh` : '100vh');
      }
    } catch {
      // Theme hydration should never block app rendering.
    }
  }, []);

  return null;
}
