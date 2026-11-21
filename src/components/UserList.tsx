import { useState } from 'react';
import { Link } from 'react-router-dom';
import { userService } from '../services/user.service';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useListControls } from '../hooks/useListControls';
import { Pagination } from '../components/Pagination';
import type { User } from '../models';

const PAGE_SIZE = 10;

export function UsersList() {
  const { search, page, setSearch, setPage } = useListControls();
  const [showArchived, setShowArchived] = useState(false);

  const { items, totalPages, loading, error } = usePaginatedList<User>(
    userService.getAll,
    { page, limit: PAGE_SIZE, search, deleted: showArchived },
  );

  return (
    <section>
      <h1>Usuarios</h1>

      <input
        type="search"
        placeholder="Buscar por nombre o email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <label>
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => { setShowArchived(e.target.checked); setPage(1); }}
        />
        Ver archivados
      </label>
      <Link to="/users/new">Nuevo usuario</Link>

      {loading && <p>Cargando…</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && (
        <table>
          <thead>
            <tr><th>Nombre</th><th>Email</th><th>Rol</th><th></th></tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4}>No hay usuarios</td></tr>
            ) : items.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td><Link to={`/users/${u._id}/edit`}>Editar</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </section>
  );
}