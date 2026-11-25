import { io, Socket } from 'socket.io-client';
import { environment } from '../config/environment';
import { getAccessToken, refreshAccessToken } from './http';

export interface ChatMessage {
  _id: string;
  room: string;
  user: {
    _id: string;
    name: string;
  };
  text: string;
  timestamp: string;
}

export interface ServerToClientEvents {
  'chat:history': (messages: ChatMessage[]) => void;
  'chat:message': (message: ChatMessage) => void;
  'users:online': (userIds: string[]) => void;
  'chat:error': (error: { message: string }) => void;
}

export interface ClientToServerEvents {
  'chat:join': (payload: { room: string }) => void;
  'chat:message': (payload: { room: string; text: string }) => void;
}

export interface SocketHandlers {
  onConnect?: () => void;
  onDisconnect?: (reason: Socket.DisconnectReason) => void;
  onConnectError?: (error: Error) => void;
  onHistory?: (messages: ChatMessage[]) => void;
  onMessage?: (message: ChatMessage) => void;
  onUsersOnline?: (userIds: string[]) => void;
  onChatError?: (error: { message: string }) => void;
}

/**
 * Helpers para calcular nombres de sala deterministas:
 * - "general"
 * - "activity:<activityId>"
 * - "direct:<id1>:<id2>" (ordenados en minúsculas para que ambos usuarios generen la misma sala)
 */
export const chatRooms = {
  general: () => 'general',
  activity: (activityId: string) => `activity:${activityId}`,
  direct: (userIdA?: string, userIdB?: string) => {
  if (!userIdA || !userIdB) return '';
  const [first, second] = [userIdA.toLowerCase(), userIdB.toLowerCase()].sort();
  return `direct:${first}:${second}`;
  },
};

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private hasRetriedAuth = false;

  /**
   * Abre (o reutiliza) la única conexión Socket.IO autenticada con el access token en memoria.
   */
  connect(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (this.socket) {
      if (!this.socket.connected) {
        this.socket.auth = { token: getAccessToken() };
        this.socket.connect();
      }
      return this.socket;
    }

    this.hasRetriedAuth = false;

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      environment.socketUrl,
      {
        auth: {
          token: getAccessToken(),
        },
        autoConnect: true,
        reconnection: true,
      },
    );

    socket.on('connect', () => {
      this.hasRetriedAuth = false;
    });

    socket.on('connect_error', async (err) => {
      if (err.message.includes('Authentication error') && !this.hasRetriedAuth) {
        this.hasRetriedAuth = true;
        const newToken = await refreshAccessToken();

        if (newToken && this.socket) {
          this.socket.auth = { token: newToken };
          this.socket.connect();
          return;
        }

        this.disconnect();
      }
    });

    this.socket = socket;
    return socket;
  }

  /**
   * Registra los listeners de ciclo de vida y chat sobre la conexión compartida.
   * Devuelve una función de limpieza que elimina únicamente estas suscripciones.
   */
  subscribe(handlers: SocketHandlers): () => void {
    const socket = this.connect();

    if (handlers.onConnect) socket.on('connect', handlers.onConnect);
    if (handlers.onDisconnect) socket.on('disconnect', handlers.onDisconnect);
    if (handlers.onConnectError) socket.on('connect_error', handlers.onConnectError);
    if (handlers.onHistory) socket.on('chat:history', handlers.onHistory);
    if (handlers.onMessage) socket.on('chat:message', handlers.onMessage);
    if (handlers.onUsersOnline) socket.on('users:online', handlers.onUsersOnline);
    if (handlers.onChatError) socket.on('chat:error', handlers.onChatError);

    return () => {
      if (handlers.onConnect) socket.off('connect', handlers.onConnect);
      if (handlers.onDisconnect) socket.off('disconnect', handlers.onDisconnect);
      if (handlers.onConnectError) socket.off('connect_error', handlers.onConnectError);
      if (handlers.onHistory) socket.off('chat:history', handlers.onHistory);
      if (handlers.onMessage) socket.off('chat:message', handlers.onMessage);
      if (handlers.onUsersOnline) socket.off('users:online', handlers.onUsersOnline);
      if (handlers.onChatError) socket.off('chat:error', handlers.onChatError);
    };
  }

  /**
   * Entra en una sala emitiendo "chat:join" con el payload { room }.
   */
  joinRoom(room: string): void {
    const socket = this.connect();
    socket.emit('chat:join', { room });
  }

  /**
   * Envía un mensaje emitiendo "chat:message" únicamente con la sala y el texto.
   */
  sendMessage(room: string, text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    const socket = this.connect();
    socket.emit('chat:message', { room, text: trimmed });
  }

  /**
   * Elimina todas las suscripciones y desconecta el socket (al desmontar la vista de chat).
   */
  disconnect(): void {
    if (!this.socket) return;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.hasRetriedAuth = false;
  }
}

export const socketService = new SocketService();