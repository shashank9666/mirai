'use client';

import { ProactiveEvent } from '@/components/ide/ProactiveNotifications';

/**
 * API utilities for frontend-backend communication
 */

export const getBackendBase = (): string => {
  if (typeof window !== 'undefined') {
    // Check if we're in Electron
    if (window.electronAPI) {
      return 'http://localhost:5000';
    }
    // Check if backend is running locally
    try {
      return process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';
    } catch {
      return 'http://localhost:5000';
    }
  }
  return 'http://localhost:5000';
};

/**
 * Voice API - Speech to Text
 */
export const voiceSTT = async (audioBlob: Blob): Promise<string> => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');

  try {
    const response = await fetch(`${getBackendBase()}/api/voice/stt`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    return data.text || '';
  } catch (error) {
    console.error('STT error:', error);
    return '';
  }
};

/**
 * Voice API - Text to Speech
 */
export const voiceTTS = async (text: string): Promise<Blob> => {
  try {
    const response = await fetch(`${getBackendBase()}/api/voice/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    return await response.blob();
  } catch (error) {
    console.error('TTS error:', error);
    throw error;
  }
};

/**
 * Memory API - Save memory
 */
export const saveMemory = async (key: string, value: unknown): Promise<void> => {
  try {
    await fetch(`${getBackendBase()}/api/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key, value }),
    });
  } catch (error) {
    console.error('Save memory error:', error);
  }
};

/**
 * Memory API - Get memory
 */
export const getMemory = async (key: string): Promise<unknown> => {
  try {
    const response = await fetch(`${getBackendBase()}/api/memory/${key}`);
    const data = await response.json();
    return data.value;
  } catch (error) {
    console.error('Get memory error:', error);
    return null;
  }
};

/**
 * Memory API - Get all memory
 */
export const getAllMemory = async (): Promise<Record<string, unknown>> => {
  try {
    const response = await fetch(`${getBackendBase()}/api/memory`);
    const data = await response.json();
    return data.memory || {};
  } catch (error) {
    console.error('Get all memory error:', error);
    return {};
  }
};

/**
 * Events API - Get events
 */
export const getEvents = async (params: { unacknowledged?: boolean; limit?: number } = {}): Promise<{ events: ProactiveEvent[] }> => {
  const query = new URLSearchParams();
  if (params.unacknowledged) query.append('unacknowledged', 'true');
  if (params.limit) query.append('limit', params.limit.toString());

  try {
    const response = await fetch(`${getBackendBase()}/api/events?${query.toString()}`);
    return await response.json();
  } catch (error) {
    console.error('Get events error:', error);
    return { events: [] };
  }
};

/**
 * Events API - Acknowledge event
 */
export const acknowledgeEvent = async (eventId: string): Promise<void> => {
  try {
    await fetch(`${getBackendBase()}/api/events/ack/${eventId}`, {
      method: 'POST',
    });
  } catch (error) {
    console.error('Acknowledge event error:', error);
  }
};

/**
 * Events API - Clear all events
 */
export const clearEvents = async (): Promise<void> => {
  try {
    await fetch(`${getBackendBase()}/api/events/clear`, {
      method: 'POST',
    });
  } catch (error) {
    console.error('Clear events error:', error);
  }
};

/**
 * Context API - Get workspace context
 */
export const getWorkspaceContext = async (): Promise<Record<string, unknown>> => {
  try {
    const response = await fetch(`${getBackendBase()}/api/context`);
    return await response.json();
  } catch (error) {
    console.error('Get context error:', error);
    return {};
  }
};

/**
 * Agent API - Send message with context
 */
export const sendAgentMessage = async (message: string, context?: Record<string, unknown>): Promise<{ response: string }> => {
  try {
    const response = await fetch(`${getBackendBase()}/api/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        context: context || {},
      }),
    });
    return await response.json();
  } catch (error) {
    console.error('Send agent message error:', error);
    return { response: 'Error communicating with agent' };
  }
};