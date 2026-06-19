import { API_BASE } from '@/config/constants';

export type ChatWsEvent = {
  type: 'message.new' | 'message.deleted' | 'message.edited';
  messageId: string;
  senderId: string;
  peerId: string;
  createdAt: number;
};

type ChatWsListener = (event: ChatWsEvent) => void;

const listeners = new Set<ChatWsListener>();
let keepAlive = false;
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

function closeChatWebSocketGracefully(): void {
  if (!socket) return;
  if (socket.readyState === WebSocket.OPEN) {
    try {
      socket.close(1000, 'page hide');
    } catch {
      // ignore
    }
  }
  socket = null;
  clearPingTimer();
}

function bindPageLifecycleHandlers(): void {
  if (typeof window === 'undefined' || (bindPageLifecycleHandlers as { bound?: boolean }).bound) {
    return;
  }
  (bindPageLifecycleHandlers as { bound?: boolean }).bound = true;
  window.addEventListener('pagehide', closeChatWebSocketGracefully);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      closeChatWebSocketGracefully();
    }
  });
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
    if (event?.type !== 'message.new' && event?.type !== 'message.deleted' && event?.type !== 'message.edited') return;
    listeners.forEach((listener) => listener(event));
  } catch {
    // ignore malformed payloads
  }
}

export function connectChatWebSocket(): void {
  if (typeof WebSocket === 'undefined') return;
  bindPageLifecycleHandlers();
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    socket = new WebSocket(getChatWebSocketUrl());
  } catch (error) {
    console.warn('[chat-ws] WebSocket connection blocked:', error);
    socket = null;
    if (listeners.size > 0 || keepAlive) {
      connectAttempts += 1;
      scheduleReconnect();
    }
    return;
  }

  socket.addEventListener('open', () => {
    connectAttempts = 0;
    console.info('[chat-ws] connected');
    clearPingTimer();
    pingTimer = window.setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send('ping');
      }
    }, 25_000);
  });

  socket.addEventListener('message', (event) => {
    if (event.data === 'pong') return;
    handleMessage(String(event.data));
  });

  socket.addEventListener('close', (event) => {
    console.info('[chat-ws] closed', event.code, event.reason || '');
    socket = null;
    clearPingTimer();
    if (listeners.size > 0 || keepAlive) {
      connectAttempts += 1;
      scheduleReconnect();
    }
  });

  socket.addEventListener('error', () => {
    console.warn('[chat-ws] connection error');
    socket?.close();
  });
}

export function disconnectChatWebSocket(): void {
  listeners.clear();
  keepAlive = false;
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  connectAttempts = 0;
  closeChatWebSocketGracefully();
}

export function onChatWebSocket(listener: ChatWsListener): () => void {
  listeners.add(listener);
  connectChatWebSocket();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && !keepAlive) {
      disconnectChatWebSocket();
    }
  };
}

export function maintainChatWebSocket(): void {
  keepAlive = true;
  connectChatWebSocket();
}

export function isChatWebSocketConnected(): boolean {
  return socket?.readyState === WebSocket.OPEN;
}
