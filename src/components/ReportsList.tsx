import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { REPORT_STATUSES } from '../models';
import type { Report } from '../models';
import { reportService } from '../services/report.service';
import { useToast } from '../context/ToastContext';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useListControls } from '../hooks/useListControls';
import { useSelection } from '../hooks/useSelection';
import { Pagination } from './Pagination';
import { ConfirmModal } from './ConfirmModal';
import { errorMessage } from '../utils/api-error';

const PAGE_SIZE = 10;

type Pending = { action: 'archive' | 'remove'; ids: string[] };

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('es-ES') : '-';

export function ReportsList() {
  const { showToast } = useToast();
  const { search, page, setSearch, setPage } = useListControls();
  const { selected, toggle, toggleAll, clear } = useSelection();

  const [status, setStatus] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { items, totalPages, loading, error, reload } = usePaginatedList<Report>(
    reportService.getAll,
    { page, limit: PAGE_SIZE, search: search.trim(), status, deleted: showArchived },
  );

  useEffect(() => {
    if (!loading && page > totalPages) setPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, page, totalPages]);

  const selectedIds = items.filter((r) => selected.has(r._id)).map((r) => r._id);
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  const onRestore = async (id: string) => {
    setActionError(null);
    try {
      await reportService.restore(id);
      showToast('Reporte restaurado');
      reload();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  };

  const onConfirm = async () => {
    if (!pending) return;
    const { action, ids } = pending;
    setBusy(true);
    setActionError(null);
    try {
      if (action === 'archive') {
        if (ids.length === 1) await reportService.softDelete(ids[0]);
        else await reportService.bulkSoftDelete(ids);
      } else if (ids.length === 1) {
        await reportService.remove(ids[0]);
      } else {
        await reportService.bulkRemove(ids);
      }
      showToast(action === 'archive' ? 'Reportes archivados' : 'Reportes eliminados');
      clear();
      setPending(null);
      reload();
    } catch (e) {
      setActionError(errorMessage(e));
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  const modalText = pending
    ? pending.action === 'archive'
      ? { title: 'Archivar', message: `¿Archivar ${pending.ids.length} reporte(s)?`, confirm: 'Archivar' }
      : { title: 'Eliminar definitivamente', message: `¿Eliminar ${pending.ids.length} reporte(s)? No se puede deshacer.`, confirm: 'Eliminar' }
    : { title: '', message: '', confirm: '' };

  return (
    <section>
      <h1>Reportes</h1>

      <input
        type="search"
        placeholder="Buscar reportes"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <select
        value={status}
        onChange={(e) => { setStatus(e.target.value); setPage(1); clear(); }}
        aria-label="Filtrar por estado"
      >
        <option value="">Todos los estados</option>
        {REPORT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <label>
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => { setShowArchived(e.target.checked); setPage(1); clear(); }}
        />
        Ver archivados
      </label>

      {selectedIds.length > 0 && (
        <button
          type="button"
          onClick={() => setPending({ action: showArchived ? 'remove' : 'archive', ids: selectedIds })}
        >
          {showArchived ? 'Eliminar' : 'Archivar'} seleccionados ({selectedIds.length})
        </button>
      )}

      <Link to="/reports/new">Nuevo reporte</Link>

      {loading && <p>Cargando…</p>}
      {error && <p role="alert">{error}</p>}
      {actionError && <p role="alert">{actionError}</p>}

      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos"
                  checked={allSelected}
                  onChange={(e) => toggleAll(items.map((r) => r._id), e.target.checked)}
                />
              </th>
              <th>Objetivo</th><th>Motivo</th><th>Estado</th><th>Fecha</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6}>No hay reportes</td></tr>
            ) : items.map((r) => (
              <tr key={r._id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar reporte ${r._id}`}
                    checked={selected.has(r._id)}
                    onChange={() => toggle(r._id)}
                  />
                </td>
                <td>{r.targetType}</td>
                <td>{r.reason}</td>
                <td>{r.status}</td>
                <td>{formatDate(r.createdAt)}</td>
                <td>
                  {!r.deleted && (
                    <>
                      <Link to={`/reports/${r._id}/edit`}>Revisar</Link>
                      <button type="button" onClick={() => setPending({ action: 'archive', ids: [r._id] })}>
                        Archivar
                      </button>
                    </>
                  )}
                  {r.deleted && (
                    <>
                      <button type="button" onClick={() => onRestore(r._id)}>Restaurar</button>
                      <button type="button" onClick={() => setPending({ action: 'remove', ids: [r._id] })}>
                        Eliminar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={(p) => { setPage(p); clear(); }} />

      <ConfirmModal
        open={pending !== null}
        title={modalText.title}
        message={modalText.message}
        confirmText={modalText.confirm}
        busy={busy}
        onConfirm={onConfirm}
        onCancel={() => setPending(null)}
      />
    </section>
  );
}