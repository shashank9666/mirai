'use client';

import { useEffect } from 'react';

export function NotificationManager() {
  useEffect(() => {
    // Request permission on mount
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket('ws://localhost:8000/ws/notifications');

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.title && data.message) {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(data.title, { body: data.message });
            }
          }
        } catch (err) {
          console.error('Failed to parse notification payload', err);
        }
      };

      ws.onclose = () => {
        // Reconnect logic
        reconnectTimeout = setTimeout(connect, 3000);
      };
      
      ws.onerror = (err) => {
        console.error('Notification WS error:', err);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, []);

  return null; // Silent component
}
