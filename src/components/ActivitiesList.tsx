import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { activityService } from '../services/activity.service';
import { categoryService, type CategoryItem } from '../services/category.service';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useListControls } from '../hooks/useListControls';
import { useSelection } from '../hooks/useSelection';
import { Pagination } from './Pagination';
import { ConfirmModal } from './ConfirmModal';
import { ACTIVITY_STATUSES, CATEGORIES, type Activity } from '../models';
import { errorMessage, isAbort } from '../utils/api-error';

const PAGE_SIZE = 10;

const archiveButtonStyle = {
  backgroundColor: '#6e7bef',
  borderColor: '#6e7bef',
  color: '#ffffff',
};

const deleteButtonStyle = {
  backgroundColor: '#9c0707',
  borderColor: '#9c0707',
  color: '#ffffff',
};

type ConfirmAction =
  | { type: 'archive'; id: string; title: string }
  | { type: 'restore'; id: string; title: string }
  | { type: 'delete'; id: string; title: string }
  | { type: 'bulk-archive'; ids: string[] }
  | { type: 'bulk-delete'; ids: string[] };

export function ActivitiesList() {
  const { user, isAdmin, canPublishActivities } = useAuth();
  const { showToast } = useToast();
  const { search, page, setSearch, setPage } = useListControls();
  const { selected, toggle, toggleAll, clear } = useSelection();

  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>(() =>
    CATEGORIES.map((slug) => ({ name: slug, slug, subcategories: [] })),
  );
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [busyModal, setBusyModal] = useState(false);

  // Cargar catálogo dinámico de categorías normalizado en mayúsculas
  useEffect(() => {
    const controller = new AbortController();
    categoryService
      .getAll(controller.signal)
      .then((items) => {
        if (items.length > 0) {
          setCategoriesList(
            items.map((c) => ({ ...c, name: c.name.trim().toUpperCase() })),
          );
        }
      })
      .catch((e) => {
        if (!isAbort(e)) console.error('Error cargando categorías:', e);
      });
    return () => controller.abort();
  }, []);

  const {
    items: activities,
    totalDocs,
    totalPages,
    loading,
    error,
    reload,
  } = usePaginatedList<Activity>(activityService.getAll, {
    page,
    limit: PAGE_SIZE,
    search,
    category: category ? category.toUpperCase() : '',
    status,
    showDeleted: isAdmin ? showArchived : false,
  });

  // Limpiar selección al cambiar de página, filtro o vista de archivados
  useEffect(() => {
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, category, status, showArchived]);

  const handleEnroll = async (id: string) => {
    setEnrollingId(id);
    try {
      await activityService.enroll(id);
      showToast('Te has inscrito correctamente en la actividad');
      reload();
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
      reload();
    } catch (err) {
      showToast(errorMessage(err));
    } finally {
      setEnrollingId(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setBusyModal(true);
    try {
      switch (confirmAction.type) {
        case 'archive':
          await activityService.softDelete(confirmAction.id);
          showToast('Actividad archivada');
          break;
        case 'restore':
          await activityService.restore(confirmAction.id);
          showToast('Actividad restaurada');
          break;
        case 'delete':
          await activityService.remove(confirmAction.id);
          showToast('Actividad eliminada definitivamente');
          break;
        case 'bulk-archive':
          await activityService.bulkSoftDelete(confirmAction.ids);
          showToast(`${confirmAction.ids.length} actividades archivadas`);
          clear();
          break;
        case 'bulk-delete':
          await activityService.bulkRemove(confirmAction.ids);
          showToast(`${confirmAction.ids.length} actividades eliminadas`);
          clear();
          break;
      }
      setConfirmAction(null);
      reload();
    } catch (err) {
      showToast(errorMessage(err));
    } finally {
      setBusyModal(false);
    }
  };

  const getModalConfig = (action: ConfirmAction | null) => {
    if (!action) return { title: '', message: '', confirmText: 'Confirmar' };
    switch (action.type) {
      case 'archive':
        return {
          title: 'Archivar actividad',
          message: `¿Seguro que quieres archivar "${action.title}"?`,
          confirmText: 'Archivar',
        };
      case 'restore':
        return {
          title: 'Restaurar actividad',
          message: `¿Quieres volver a activar "${action.title}"?`,
          confirmText: 'Restaurar',
        };
      case 'delete':
        return {
          title: 'Eliminar actividad',
          message: `¿Eliminar definitivamente "${action.title}"? Esta acción no se puede deshacer.`,
          confirmText: 'Eliminar',
        };
      case 'bulk-archive':
        return {
          title: 'Archivar seleccionadas',
          message: `¿Seguro que quieres archivar ${action.ids.length} actividades?`,
          confirmText: 'Archivar lote',
        };
      case 'bulk-delete':
        return {
          title: 'Eliminar seleccionadas',
          message: `¿Eliminar definitivamente ${action.ids.length} actividades? Esta acción no se puede deshacer.`,
          confirmText: 'Eliminar lote',
        };
    }
  };

  const allCurrentIds = activities.map((a) => a._id);
  const allSelected =
    allCurrentIds.length > 0 && allCurrentIds.every((id) => selected.has(id));
  const selectedIds = Array.from(selected);
  const modalConfig = getModalConfig(confirmAction);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Actividades</h1>
          <small style={{ color: 'var(--muted)' }}>Total: {totalDocs}</small>
        </div>
        {canPublishActivities && (
          <Link to="/activities/new">
            <button type="button">Nueva actividad</button>
          </Link>
        )}
      </div>

      {/* Buscador y filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <input
          type="search"
          placeholder="Buscar actividades…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          aria-label="Filtrar por categoría"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas las categorías</option>
          {categoriesList.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>

        <select
          aria-label="Filtrar por estado"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos los estados</option>
          {ACTIVITY_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {isAdmin && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => {
                setShowArchived(e.target.checked);
                setPage(1);
              }}
            />
            Ver archivadas
          </label>
        )}
      </div>

      {/* Barra de acciones en lote (solo ADMIN) */}
      {isAdmin && !loading && !error && activities.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '0.5rem 0.75rem',
            marginBottom: '1rem',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            backgroundColor: 'var(--surface-alt)',
            color: 'var(--text)',
          }}
        >
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => toggleAll(allCurrentIds, e.target.checked)}
            />
            Seleccionar todas ({selectedIds.length} seleccionadas)
          </label>

          {selectedIds.length > 0 && (
            <>
              {!showArchived && (
                <button
                  type="button"
                  style={archiveButtonStyle}
                  onClick={() => setConfirmAction({ type: 'bulk-archive', ids: selectedIds })}
                >
                  Archivar seleccionadas ({selectedIds.length})
                </button>
              )}
              <button
                type="button"
                style={deleteButtonStyle}
                onClick={() => setConfirmAction({ type: 'bulk-delete', ids: selectedIds })}
              >
                Eliminar seleccionadas ({selectedIds.length})
              </button>
            </>
          )}
        </div>
      )}

      {loading && <p>Cargando…</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && activities.length === 0 && (
        <p>No hay actividades disponibles.</p>
      )}

      {!loading && !error && activities.length > 0 && (
        <>
          <div style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
            {activities.map((a) => {
              const enrolledCount = a.participants?.length ?? 0;
              const maxCount = a.capacity?.maxParticipants ?? 0;
              const isJoined = Boolean(
                user &&
                  a.participants?.some((p) =>
                    typeof p === 'string' ? p === user._id : p.userId === user._id,
                  ),
              );
              const isFull = enrolledCount >= maxCount || a.status === 'FULL';
              const isUnavailable = isFull || a.status === 'COMPLETED' || a.status === 'CANCELLED';

              return (
                <article
                  key={a._id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '1rem',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                      {isAdmin && (
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${a.title}`}
                          checked={selected.has(a._id)}
                          onChange={() => toggle(a._id)}
                          style={{ marginTop: '0.35rem' }}
                        />
                      )}
                      <div>
                        <h2 style={{ margin: '0 0 0.25rem 0' }}>{a.title}</h2>
                        <small style={{ color: 'var(--muted)' }}>
                          {a.category} · {a.subcategory} · {a.modality} · Estado: <strong>{a.status}</strong>
                          {a.deleted ? ' · (ARCHIVADA)' : ''}
                        </small>
                      </div>
                    </div>
                    <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      {a.pricing?.price > 0 ? `${a.pricing.price} €` : 'Gratis'}
                    </span>
                  </div>

                  <p style={{ margin: '0.75rem 0' }}>{a.description}</p>

                  <div style={{ fontSize: '0.9rem', color: 'var(--muted)', display: 'grid', gap: '0.25rem' }}>
                    <div>
                      <strong style={{ color: 'var(--text)' }}>Ubicación:</strong> {a.location?.addressName ?? 'Sin dirección'}
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text)' }}>Horario:</strong>{' '}
                      {a.schedule?.startTime ? new Date(a.schedule.startTime).toLocaleString() : '—'}
                      {a.schedule?.endTime ? ` — ${new Date(a.schedule.endTime).toLocaleString()}` : ''}
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text)' }}>Plazas:</strong> {enrolledCount} / {maxCount}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '1rem' }}>
                    {/* Acción de inscripción (solo rol USER, el backend rechaza ADMIN con 403) */}
                    {user && !isAdmin && !showArchived && (
                      <>
                        {isJoined ? (
                          <>
                            <span
                              style={{
                                padding: '0.35rem 0.75rem',
                                backgroundColor: '#dcfce7',
                                color: '#166534',
                                borderRadius: '4px',
                                fontSize: '0.9rem',
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
                              >
                                {enrollingId === a._id ? 'Saliendo…' : 'Desapuntarme'}
                              </button>
                            )}
                          </>
                        ) : (
                          !isUnavailable &&
                          a.status === 'OPEN' && (
                            <button
                              type="button"
                              disabled={enrollingId === a._id}
                              onClick={() => handleEnroll(a._id)}
                            >
                              {enrollingId === a._id ? 'Inscribiendo…' : 'Inscribirme'}
                            </button>
                          )
                        )}
                      </>
                    )}

                    {/* Acciones exclusivas de ADMIN */}
                    {isAdmin && (
                      <>
                        {!a.deleted && (
                          <Link to={`/activities/${a._id}/edit`}>
                            <button type="button">Editar</button>
                          </Link>
                        )}

                        {!a.deleted ? (
                          <button
                            type="button"
                            style={archiveButtonStyle}
                            onClick={() => setConfirmAction({ type: 'archive', id: a._id, title: a.title })}
                          >
                            Archivar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ type: 'restore', id: a._id, title: a.title })}
                          >
                            Restaurar
                          </button>
                        )}

                        <button
                          type="button"
                          style={deleteButtonStyle}
                          onClick={() => setConfirmAction({ type: 'delete', id: a._id, title: a.title })}
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <ConfirmModal
        open={Boolean(confirmAction)}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        busy={busyModal}
        onConfirm={handleConfirmAction}
        onCancel={() => !busyModal && setConfirmAction(null)}
      />
    </section>
  );
}