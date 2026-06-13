'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { getWsBase } from '@/lib/api';
import { toast } from 'sonner';

export function NotificationManager() {
  useEffect(() => {
    // Request permission on mount
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let shouldReconnect = true;

    const connect = () => {
      ws = new WebSocket(`${getWsBase()}/ws/notifications`);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.title && data.message) {
            const { notificationsEnabled } = useSettingsStore.getState();
            if (notificationsEnabled) {
              toast(data.title, { description: data.message });
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(data.title, { body: data.message });
              }
            }
          }
        } catch (err) {
          console.error('Failed to parse notification payload', err);
        }
      };

      ws.onclose = () => {
        if (shouldReconnect) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
      
      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, []);

  return null; // Silent component
}
