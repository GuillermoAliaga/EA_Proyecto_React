import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { activityService } from '../services/activity.service';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ActivitiesMap } from './ActivitiesMap';
import type { Activity } from '../models';
import { errorMessage, isAbort } from '../utils/api-error';

const SUBCATEGORY_LABELS: Record<string, string> = {
  BASKETBALL: 'Baloncesto',
  RUNNING: 'Running',
  ARCADE: 'Arcade & Lucha',
  TCG_BOARDGAMES: 'TCG y Juegos de Mesa',
};

export function Home() {
  const { user, isAdmin, canPublishActivities } = useAuth();
  const { showToast } = useToast();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapCategory, setMapCategory] = useState<'ALL' | 'SPORT' | 'LEISURE'>('ALL');
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const loadActivities = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    activityService
      .getAll({ page: 1, limit: 30 }, signal)
      .then((res) => {
        const list = (res as { items?: Activity[]; docs?: Activity[]; data?: Activity[] }).items
          ?? (res as { docs?: Activity[] }).docs
          ?? (res as { data?: Activity[] }).data
          ?? [];
        setActivities(list);
      })
      .catch((err) => {
        if (!isAbort(err)) setError(errorMessage(err));
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadActivities(controller.signal);
    return () => controller.abort();
  }, [loadActivities]);

  const handleEnroll = async (id: string) => {
    setEnrollingId(id);
    try {
      await activityService.enroll(id);
      showToast('Te has inscrito correctamente en la actividad');
      loadActivities();
    } catch (err) {
      showToast(errorMessage(err));
    } finally {
      setEnrollingId(null);
    }
  };

  const handleUnenroll = async (id: string) => {
    setEnrollingId(id);
    try {
      await activityService.unenroll(id);
      showToast('Has cancelado tu inscripción en la actividad');
      loadActivities();
    } catch (err) {
      showToast(errorMessage(err));
    } finally {
      setEnrollingId(null);
    }
  };

  const openActivities = useMemo(
    () => activities.filter((a) => a.status === 'OPEN'),
    [activities],
  );

  const myJoinedActivities = useMemo(() => {
    if (!user) return [];
    return activities.filter((a) =>
      a.participants?.some((p) =>
        typeof p === 'string' ? p === user._id : p.userId === user._id,
      ),
    );
  }, [activities, user]);

  const storeHostedCount = useMemo(
    () => activities.filter((a) => a.location?.isStoreLocation).length,
    [activities],
  );

  const mapActivities = useMemo(() => {
    if (mapCategory === 'ALL') return activities;
    return activities.filter((a) => a.category.toUpperCase() === mapCategory);
  }, [activities, mapCategory]);

  const featuredActivities = useMemo(
    () => (openActivities.length > 0 ? openActivities : activities).slice(0, 4),
    [openActivities, activities],
  );

  return (
    <section style={{ display: 'grid', gap: '1.75rem' }}>
      {/* Hero / Bienvenida */}
      <div
        style={{
          padding: '1.75rem',
          borderRadius: '10px',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          display: 'grid',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ maxWidth: '650px' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '0.2rem 0.65rem',
                borderRadius: '999px',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                marginBottom: '0.5rem',
              }}
            >
              Comunidad · Deporte y Ocio Presencial
            </span>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.75rem' }}>
              Hola, {user?.name ?? 'jugador'}
            </h1>
            <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.5 }}>
              Encuentra partidas de arcade, torneos de cartas y juegos de mesa, quedadas de running o partidos de baloncesto cerca de ti, tanto al aire libre como en tiendas colaboradoras.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <Link to="/activities" className="button">
              Explorar actividades
            </Link>
            <Link to="/chat" className="button secondary">
              Abrir chat
            </Link>
            {canPublishActivities && (
              <Link to="/activities/new" className="button secondary">
                + Publicar actividad
              </Link>
            )}
          </div>
        </div>

        {/* Tarjetas de resumen rápido */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.85rem',
            marginTop: '0.5rem',
          }}
        >
          <div
            style={{
              padding: '0.9rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-alt)',
            }}
          >
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Actividades abiertas</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.2rem' }}>
              {loading ? '—' : openActivities.length}
            </div>
          </div>

          <div
            style={{
              padding: '0.9rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-alt)',
            }}
          >
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
              {isAdmin ? 'Total publicadas' : 'Tus inscripciones'}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.2rem' }}>
              {loading ? '—' : isAdmin ? activities.length : myJoinedActivities.length}
            </div>
          </div>

          <div
            style={{
              padding: '0.9rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-alt)',
            }}
          >
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>En tiendas locales</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.2rem' }}>
              {loading ? '—' : storeHostedCount}
            </div>
          </div>

          {isAdmin && (
            <div
              style={{
                padding: '0.9rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface-alt)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Gestión rápida</div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem', fontSize: '0.9rem', fontWeight: 600 }}>
                <Link to="/users">Usuarios</Link>
                <Link to="/reports">Reportes</Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mapa interactivo de actividades */}
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Mapa de quedadas y eventos</h2>
            <small style={{ color: 'var(--muted)' }}>
              Pulsa sobre cualquier marcador para ver los detalles, plazas e inscribirte.
            </small>
          </div>

          {/* Filtro rápido del mapa */}
          <div className="view-toggle" role="group" aria-label="Filtrar mapa por categoría">
            <button
              type="button"
              className={mapCategory === 'ALL' ? 'active' : ''}
              onClick={() => setMapCategory('ALL')}
            >
              Todas ({activities.length})
            </button>
            <button
              type="button"
              className={mapCategory === 'SPORT' ? 'active' : ''}
              onClick={() => setMapCategory('SPORT')}
            >
              Deporte
            </button>
            <button
              type="button"
              className={mapCategory === 'LEISURE' ? 'active' : ''}
              onClick={() => setMapCategory('LEISURE')}
            >
              Ocio
            </button>
          </div>
        </div>

        {error ? (
          <div className="alert" role="alert">{error}</div>
        ) : (
          <ActivitiesMap
            activities={mapActivities}
            currentUserId={user?._id}
            isAdmin={isAdmin}
            enrollingId={enrollingId}
            onEnroll={handleEnroll}
            onUnenroll={handleUnenroll}
          />
        )}
      </div>

      {/* Próximas actividades destacadas */}
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Próximas actividades</h2>
          <Link to="/activities" style={{ fontSize: '0.9rem', fontWeight: 500 }}>
            Ver todas →
          </Link>
        </div>

        {loading && <p style={{ color: 'var(--muted)' }}>Cargando actividades…</p>}

        {!loading && !error && featuredActivities.length === 0 && (
          <p style={{ color: 'var(--muted)' }}>Aún no hay actividades publicadas.</p>
        )}

        {!loading && !error && featuredActivities.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '1rem',
            }}
          >
            {featuredActivities.map((a) => {
              const enrolledCount = a.participants?.length ?? 0;
              const maxCount = a.capacity?.maxParticipants ?? 0;
              const isJoined = Boolean(
                user &&
                  a.participants?.some((p) =>
                    typeof p === 'string' ? p === user._id : p.userId === user._id,
                  ),
              );
              const isFull = enrolledCount >= maxCount || a.status === 'FULL';

              return (
                <article
                  key={a._id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '1rem',
                    backgroundColor: 'var(--surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'grid', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="tag" style={{ margin: 0 }}>
                        {SUBCATEGORY_LABELS[a.subcategory] ?? a.subcategory}
                      </span>
                      <strong style={{ fontSize: '0.9rem' }}>
                        {a.pricing?.price > 0 ? `${a.pricing.price} €` : 'Gratis'}
                      </strong>
                    </div>

                    <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.05rem' }}>{a.title}</h3>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.88rem',
                        color: 'var(--muted)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {a.description}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.65rem' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                      <div>
                        {a.location?.isStoreLocation ? 'Tienda: ' : 'Lugar: '}
                        {a.location?.addressName ?? 'Sin dirección'}
                      </div>
                      <div>
                        {a.schedule?.startTime
                          ? new Date(a.schedule.startTime).toLocaleDateString([], {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Fecha por confirmar'}{' '}
                        · Plazas: {enrolledCount}/{maxCount}
                      </div>
                    </div>

                    {user && !isAdmin && (
                      <div>
                        {isJoined ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.3rem 0.65rem',
                                backgroundColor: '#dcfce7',
                                color: '#166534',
                                borderRadius: '4px',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                              }}
                            >
                              Inscrito
                            </span>

                            {a.status !== 'COMPLETED' && a.status !== 'CANCELLED' && (
                              <button
                                type="button"
                                className="danger"
                                disabled={enrollingId === a._id}
                                onClick={() => handleUnenroll(a._id)}
                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.85rem' }}
                              >
                                {enrollingId === a._id ? 'Saliendo…' : 'Desapuntarme'}
                              </button>
                            )}
                          </div>
                        ) : (
                          !isFull &&
                          a.status === 'OPEN' && (
                            <button
                              type="button"
                              disabled={enrollingId === a._id}
                              onClick={() => handleEnroll(a._id)}
                              style={{ width: '100%' }}
                            >
                              {enrollingId === a._id ? 'Inscribiendo…' : 'Inscribirme'}
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}