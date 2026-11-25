import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { activityService } from '../services/activity.service';
import {
  socketService,
  chatRooms,
  type ChatMessage,
} from '../services/socket.service';
import type { Activity } from '../models';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function Chat() {
  const { user } = useAuth();
  const currentUserId = user?._id ?? (user as { id?: string } | null)?.id ?? '';

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeRoom, setActiveRoom] = useState<string>(() => chatRooms.general());
  const [activeRoomTitle, setActiveRoomTitle] = useState<string>('Chat general');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');

  const [joinedActivities, setJoinedActivities] = useState<Activity[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  const activeRoomRef = useRef<string>(activeRoom);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const requestedMissingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  // Cargar actividades y diccionario inicial de nombres
  useEffect(() => {
    if (!currentUserId || !user) return;
    const controller = new AbortController();

    setUserNames((prev) => ({ ...prev, [currentUserId]: user.name }));

    activityService
      .getAll({ limit: 100 }, controller.signal)
      .then((res) => {
        const namesFromActivities: Record<string, string> = {};
        const mine: Activity[] = [];

        for (const act of res.data) {
          if (typeof act.creatorId === 'object' && act.creatorId?._id && act.creatorId?.name) {
            namesFromActivities[act.creatorId._id] = act.creatorId.name;
          }
          for (const p of act.participants) {
            if (p.userId && p.name) {
              namesFromActivities[p.userId] = p.name;
            }
          }
          if (!act.deleted && act.participants.some((p) => p.userId === currentUserId)) {
            mine.push(act);
          }
        }

        setJoinedActivities(mine);
        if (Object.keys(namesFromActivities).length > 0) {
          setUserNames((prev) => ({ ...prev, ...namesFromActivities }));
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [currentUserId, user]);

  // Si entra un usuario nuevo conectado cuyo nombre aún no tenemos, refrescar actividades
  useEffect(() => {
    const unknownIds = onlineUserIds.filter(
      (id) => Boolean(id) && !userNames[id] && !requestedMissingIdsRef.current.has(id),
    );
    if (unknownIds.length === 0) return;

    unknownIds.forEach((id) => requestedMissingIdsRef.current.add(id));

    activityService
      .getAll({ limit: 100 })
      .then((res) => {
        const resolved: Record<string, string> = {};
        for (const act of res.data) {
          if (typeof act.creatorId === 'object' && act.creatorId?._id && act.creatorId?.name) {
            resolved[act.creatorId._id] = act.creatorId.name;
          }
          for (const p of act.participants) {
            if (p.userId && p.name) resolved[p.userId] = p.name;
          }
        }
        if (Object.keys(resolved).length > 0) {
          setUserNames((prev) => ({ ...prev, ...resolved }));
        }
      })
      .catch(() => {});
  }, [onlineUserIds, userNames]);

  // Suscripción principal a Socket.IO y cierre limpio al desmontar
  useEffect(() => {
    setConnectionStatus('connecting');
    setErrorMessage(null);

    const unsubscribe = socketService.subscribe({
      onConnect: () => {
        setConnectionStatus('connected');
        setErrorMessage(null);
        socketService.joinRoom(activeRoomRef.current);
      },
      onDisconnect: () => {
        setConnectionStatus('disconnected');
      },
      onConnectError: (err) => {
        setConnectionStatus('error');
        setErrorMessage(
          err.message || 'No se pudo conectar con el servidor de chat.',
        );
      },
      onHistory: (history) => {
        setMessages(history);
        setErrorMessage(null);

        const historyNames: Record<string, string> = {};
        for (const msg of history) {
          if (msg.user?._id && msg.user?.name) {
            historyNames[msg.user._id] = msg.user.name;
          }
        }
        if (Object.keys(historyNames).length > 0) {
          setUserNames((prev) => ({ ...prev, ...historyNames }));
        }
      },
      onMessage: (message) => {
        if (message.user?._id && message.user?.name) {
          setUserNames((prev) => ({
            ...prev,
            [message.user._id]: message.user.name,
          }));
        }

        if (message.room === activeRoomRef.current) {
          setMessages((prev) => {
            if (prev.some((m) => m._id === message._id)) return prev;
            return [...prev, message];
          });
        }
      },
      onUsersOnline: (ids) => {
        setOnlineUserIds(Array.isArray(ids) ? ids.filter(Boolean) : []);
      },
      onChatError: (err) => {
        setErrorMessage(err.message);
      },
    });

    return () => {
      unsubscribe();
      socketService.disconnect();
    };
  }, []);

  // Auto-scroll hasta el último mensaje al actualizar la conversación
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectRoom = (room: string, title: string) => {
    if (!room || room === activeRoom) return;
    setActiveRoom(room);
    setActiveRoomTitle(title);
    setMessages([]);
    setErrorMessage(null);
    socketService.joinRoom(room);
  };

  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    socketService.sendMessage(activeRoom, trimmed);
    setText('');
  };

  const statusConfig: Record<
    ConnectionStatus,
    { label: string; bg: string; color: string }
  > = {
    connected: { label: 'Conectado', bg: '#dcfce7', color: '#166534' },
    connecting: { label: 'Conectando…', bg: '#fef9c3', color: '#854d0e' },
    disconnected: { label: 'Desconectado', bg: '#f1f5f9', color: '#475569' },
    error: { label: 'Error de conexión', bg: '#fee2e2', color: '#991b1b' },
  };

  const currentStatus = statusConfig[connectionStatus];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
      {/* Cabecera e indicador de estado */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          textAlign: 'left',
        }}
      >
        <div style={{ flex: '1 1 260px' }}>
          <h2 style={{ margin: 0 }}>Chat en tiempo real</h2>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            Habla con la comunidad, con los grupos de tus actividades o por mensaje directo.
          </p>
        </div>

        <span
          style={{
            padding: '0.35rem 0.85rem',
            borderRadius: '999px',
            fontSize: '0.85rem',
            fontWeight: 600,
            backgroundColor: currentStatus.bg,
            color: currentStatus.color,
            whiteSpace: 'nowrap',
          }}
        >
          ● {currentStatus.label}
        </span>
      </div>

      {/* Banner de error de conexión o de sala */}
      {errorMessage && (
        <div
          className="card"
          role="alert"
          style={{
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Layout responsive: Salas + Conversación + Usuarios online */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'stretch',
        }}
      >
        {/* Columna izquierda: Salas */}
        <aside
          className="card"
          style={{
            flex: '1 1 220px',
            minWidth: '220px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            textAlign: 'left',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Salas</h3>
            <button
              type="button"
              onClick={() =>
                handleSelectRoom(chatRooms.general(), 'Chat general')
              }
              style={{
                width: '100%',
                textAlign: 'left',
                fontWeight: activeRoom === chatRooms.general() ? 700 : 400,
                opacity: activeRoom === chatRooms.general() ? 1 : 0.8,
              }}
            >
              # General
            </button>
          </div>

          <div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>
              Mis actividades ({joinedActivities.length})
            </h3>

            {joinedActivities.length === 0 ? (
              <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                No estás inscrito en ninguna actividad todavía.
              </p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                {joinedActivities.map((activity) => {
                  const roomId = chatRooms.activity(activity._id);
                  const isActive = activeRoom === roomId;
                  return (
                    <button
                      key={activity._id}
                      type="button"
                      onClick={() => handleSelectRoom(roomId, activity.title)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        fontWeight: isActive ? 700 : 400,
                        opacity: isActive ? 1 : 0.8,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={activity.title}
                    >
                      {activity.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Columna central: Hilo de mensajes */}
        <section
          className="card"
          style={{
            flex: '999 1 360px',
            minWidth: 'min(100%, 320px)',
            display: 'flex',
            flexDirection: 'column',
            height: '520px',
            padding: 0,
            overflow: 'hidden',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.25rem',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontSize: '1rem' }}>{activeRoomTitle}</strong>
              <span
                className="muted"
                style={{
                  fontSize: '0.8rem',
                  marginLeft: '0.5rem',
                  wordBreak: 'break-all',
                }}
              >
                ({activeRoom})
              </span>
            </div>
          </div>

          {/* Lista de mensajes */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            {messages.length === 0 ? (
              <p
                className="muted"
                style={{ textAlign: 'center', margin: 'auto 0' }}
              >
                Aún no hay mensajes en esta sala. ¡Sé el primero en escribir!
              </p>
            ) : (
              messages.map((msg) => {
                const isMine = currentUserId === msg.user._id;
                const time = new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={msg._id}
                    style={{
                      alignSelf: isMine ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      padding: '0.55rem 0.85rem',
                      borderRadius: '10px',
                      backgroundColor: isMine
                        ? 'var(--primary, #2563eb)'
                        : 'var(--bg-subtle, rgba(148, 163, 184, 0.16))',
                      color: isMine ? '#ffffff' : 'inherit',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        fontSize: '0.75rem',
                        opacity: 0.85,
                        marginBottom: '0.2rem',
                      }}
                    >
                      <strong>{isMine ? 'Tú' : msg.user.name}</strong>
                      <span>{time}</span>
                    </div>
                    <div
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: '0.95rem',
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Formulario de envío */}
          <form
            onSubmit={handleSendMessage}
            style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid var(--border, #e2e8f0)',
              display: 'flex',
              gap: '0.5rem',
            }}
          >
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Escribe un mensaje en ${activeRoomTitle}…`}
              maxLength={2000}
              disabled={connectionStatus !== 'connected'}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              type="submit"
              disabled={connectionStatus !== 'connected' || !text.trim()}
            >
              Enviar
            </button>
          </form>
        </section>

        {/* Columna derecha: Usuarios conectados */}
        <aside
          className="card"
          style={{
            flex: '1 1 200px',
            minWidth: '200px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            textAlign: 'left',
          }}
        >
          <h3 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem' }}>
            Conectados ({onlineUserIds.length})
          </h3>

          {onlineUserIds.length === 0 ? (
            <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
              Ningún usuario conectado.
            </p>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              {onlineUserIds.map((onlineId) => {
                const isMe = currentUserId === onlineId;
                const displayName =
                  userNames[onlineId] ?? `Usuario ${onlineId.slice(-4)}`;
                const directRoom = currentUserId
                  ? chatRooms.direct(currentUserId, onlineId)
                  : '';
                const isActiveDirect = !isMe && activeRoom === directRoom;

                return (
                  <li key={onlineId}>
                    {isMe ? (
                      <div
                        style={{
                          padding: '0.35rem 0.5rem',
                          fontSize: '0.88rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                        }}
                      >
                        <span style={{ color: '#22c55e' }}>●</span>
                        <span>{displayName} (tú)</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!directRoom}
                        onClick={() =>
                          handleSelectRoom(directRoom, `Directo con ${displayName}`)
                        }
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.35rem 0.55rem',
                          fontSize: '0.88rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          fontWeight: isActiveDirect ? 700 : 400,
                          opacity: isActiveDirect ? 1 : 0.85,
                        }}
                        title={`Abrir chat directo con ${displayName}`}
                      >
                        <span style={{ color: '#22c55e' }}>●</span>
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {displayName}
                        </span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}