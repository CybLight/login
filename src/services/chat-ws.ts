import { API_BASE } from '@/config/constants';

export type ChatWsEvent = {
  type: 'message.new';
  messageId: string;
  senderId: string;
  peerId: string;
  createdAt: number;
};

type ChatWsListener = (event: ChatWsEvent) => void;

const listeners = new Set<ChatWsListener>();
let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let pingTimer: number | null = null;
let connectAttempts = 0;

function getChatWebSocketUrl(): string {
  const isDev = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
  if (isDev) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/api/ws/messages`;
  }

  if (API_BASE.startsWith('http')) {
    const url = new URL(API_BASE);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws/messages';
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/api/ws/messages`;
}

function clearPingTimer(): void {
  if (pingTimer) {
    window.clearInterval(pingTimer);
    pingTimer = null;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  const delay = Math.min(30_000, 1_000 * 2 ** Math.min(connectAttempts, 5));
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connectChatWebSocket();
  }, delay);
}

function handleMessage(raw: string): void {
  try {
    const event = JSON.parse(raw) as ChatWsEvent;
    if (event?.type !== 'message.new') return;
    listeners.forEach((listener) => listener(event));
  } catch {
    // ignore malformed payloads
  }
}

export function connectChatWebSocket(): void {
  if (typeof WebSocket === 'undefined') return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  socket = new WebSocket(getChatWebSocketUrl());

  socket.addEventListener('open', () => {
    connectAttempts = 0;
    clearPingTimer();
    pingTimer = window.setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send('ping');
      }
    }, 45_000);
  });

  socket.addEventListener('message', (event) => {
    if (event.data === 'pong') return;
    handleMessage(String(event.data));
  });

  socket.addEventListener('close', () => {
    socket = null;
    clearPingTimer();
    if (listeners.size > 0) {
      connectAttempts += 1;
      scheduleReconnect();
    }
  });

  socket.addEventListener('error', () => {
    socket?.close();
  });
}

export function disconnectChatWebSocket(): void {
  listeners.clear();
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  clearPingTimer();
  connectAttempts = 0;
  socket?.close();
  socket = null;
}

export function onChatWebSocket(listener: ChatWsListener): () => void {
  listeners.add(listener);
  connectChatWebSocket();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      disconnectChatWebSocket();
    }
  };
}

export function isChatWebSocketConnected(): boolean {
  return socket?.readyState === WebSocket.OPEN;
}
