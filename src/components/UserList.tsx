import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { userService } from '../services/user.service';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useListControls } from '../hooks/useListControls';
import { useSelection } from '../hooks/useSelection';
import { useToast } from '../context/ToastContext';
import { Pagination } from '../components/Pagination';
import { ConfirmModal } from '../components/ConfirmModal';
import { errorMessage } from '../utils/api-error';
import type { User } from '../models';
import { useAuth } from '../context/AuthContext';

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
  | { type: 'archive'; id: string; name: string }
  | { type: 'delete'; id: string; name: string }
  | { type: 'bulk-archive'; ids: string[] }
  | { type: 'bulk-delete'; ids: string[] };

export function UsersList() {
  const { user: currentUser } = useAuth();
  const { search, page, setSearch, setPage } = useListControls();
  const { selected, toggle, toggleAll, clear } = useSelection();
  const { showToast } = useToast();

  const [showArchived, setShowArchived] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [busyModal, setBusyModal] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const { items, totalPages, loading, error, reload } = usePaginatedList<User>(
    userService.getAll,
    { page, limit: PAGE_SIZE, search, showDeleted: showArchived },
  );

  // Si al archivar/eliminar el último usuario de la última página nos quedamos fuera de rango, volver a la última disponible
  useEffect(() => {
    if (!loading && page > totalPages) {
      setPage(totalPages);
    }
  }, [loading, page, totalPages, setPage]);

  // Limpiar selección al cambiar de página, búsqueda o filtro de archivados
  useEffect(() => {
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, showArchived]);

  const handleRestore = async (user: User) => {
    setRestoringId(user._id);
    try {
      await userService.restore(user._id);
      showToast(`Usuario "${user.name}" restaurado`);
      reload();
    } catch (err) {
      showToast(errorMessage(err));
    } finally {
      setRestoringId(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setBusyModal(true);
    try {
      switch (confirmAction.type) {
        case 'archive':
          await userService.softDelete(confirmAction.id);
          showToast(`Usuario "${confirmAction.name}" archivado`);
          break;
        case 'delete':
          await userService.remove(confirmAction.id);
          showToast(`Usuario "${confirmAction.name}" eliminado definitivamente`);
          break;
        case 'bulk-archive':
          await userService.bulkSoftDelete(confirmAction.ids);
          showToast(`${confirmAction.ids.length} usuarios archivados`);
          clear();
          break;
        case 'bulk-delete':
          await userService.bulkRemove(confirmAction.ids);
          showToast(`${confirmAction.ids.length} usuarios eliminados definitivamente`);
          clear();
          break;
      }
      setConfirmAction(null);
      reload();
    } catch (err) {
      showToast(errorMessage(err));
      setConfirmAction(null);
    } finally {
      setBusyModal(false);
    }
  };

  const getModalConfig = (action: ConfirmAction | null) => {
    if (!action) return { title: '', message: '', confirmText: 'Confirmar' };
    switch (action.type) {
      case 'archive':
        return {
          title: 'Archivar usuario',
          message: `¿Seguro que quieres archivar a "${action.name}"?`,
          confirmText: 'Archivar',
        };
      case 'delete':
        return {
          title: 'Eliminar definitivamente',
          message: `¿Eliminar definitivamente a "${action.name}"? Esta acción no se puede deshacer.`,
          confirmText: 'Eliminar definitivamente',
        };
      case 'bulk-archive':
        return {
          title: 'Archivar usuarios seleccionados',
          message: `¿Seguro que quieres archivar ${action.ids.length} usuarios?`,
          confirmText: 'Archivar seleccionados',
        };
      case 'bulk-delete':
        return {
          title: 'Eliminar usuarios seleccionados',
          message: `¿Eliminar definitivamente ${action.ids.length} usuarios? Esta acción no se puede deshacer.`,
          confirmText: 'Eliminar seleccionados',
        };
    }
  };

  //Excluímos ID del admin que está logueado para que no pueda eliminarse a sí mismo
  const selectableIds = items.filter((u) => u._id !== currentUser?._id).map((u) => u._id);
  const visibleItems = showArchived
    ? items.filter((u) => Boolean(u.deleted || u.deletedAt))
    : items;
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const selectedIds = Array.from(selected);
  const modalConfig = getModalConfig(confirmAction);

  return (
    <section>
      <h1>Usuarios</h1>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <input
          type="search"
          placeholder="Buscar por nombre o email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => {
              setShowArchived(e.target.checked);
              setPage(1);
            }}
          />
          Ver archivados
        </label>
          <Link to="/users/new" style={{ marginLeft: 'auto', textDecoration: 'none' }}>
            <button type="button">Nuevo usuario</button>
          </Link>
      </div>

      {/* Barra de acciones en lote */}
      {!loading && !error && selectedIds.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '0.5rem 0.75rem',
            marginBottom: '1rem',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            backgroundColor: '#f9fafb',
            color: '#111827',
          }}
        >
          <span>{selectedIds.length} seleccionados</span>
          {!showArchived ? (
            <button
              type="button"
              onClick={() => setConfirmAction({ type: 'bulk-archive', ids: selectedIds })}
            >
              Archivar seleccionados
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmAction({ type: 'bulk-delete', ids: selectedIds })}
            >
              Eliminar seleccionados
            </button>
          )}
        </div>
      )}

      {loading && <p>Cargando…</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos"
                  checked={allSelected}
                  disabled={selectableIds.length === 0}
                  onChange={(e) => toggleAll(selectableIds, e.target.checked)}
                />
              </th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.length === 0 ? (
              <tr>
                <td colSpan={5}>No hay usuarios</td>
              </tr>
            ) : (
              visibleItems.map((user) => (
                <tr key={user._id}>
                  <td>
                    {user._id !== currentUser?._id && (
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${user.name}`}
                        checked={selected.has(user._id)}
                        onChange={() => toggle(user._id)}
                      />
                    )}
                  </td>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {!showArchived ? (
                      <>
                        <Link to={`/users/${user._id}/edit`} style={{ textDecoration: 'none' }}>
                          <button type="button">Editar</button>
                        </Link>
                        {user._id !== currentUser?._id && (
                          <button
                            type="button"
                            style={archiveButtonStyle}
                            onClick={() => setConfirmAction({ type: 'archive', id: user._id, name: user.name })}
                          >
                            Archivar
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRestore(user)}
                          disabled={restoringId === user._id}
                        >
                          {restoringId === user._id ? 'Restaurando…' : 'Restaurar'}
                        </button>
                        <button
                          type="button"
                          style={deleteButtonStyle}
                          onClick={() => setConfirmAction({ type: 'delete', id: user._id, name: user.name })}
                        >
                          Eliminar definitivamente
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

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