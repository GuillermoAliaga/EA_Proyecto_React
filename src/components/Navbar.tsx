import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export function Navbar() {
  const { user, isAdmin, canPublishActivities, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="navbar">
      <nav className="nav-links" aria-label="Principal">
        {/* Visitante */}
        {!user && (
          <>
            <NavLink to="/login" className="nav-link">Iniciar sesión</NavLink>
            <NavLink to="/register" className="nav-link">Registro</NavLink>
          </>
        )}

        {/* Cualquier usuario con sesión */}
        {user && (
          <>
            <NavLink to="/" end className="nav-link">Inicio</NavLink>
            <NavLink to="/activities" end className="nav-link">Actividades</NavLink>
            <NavLink to="/chat" className="nav-link">Chat</NavLink>
            <NavLink to="/reports/new" className="nav-link">Denunciar</NavLink>
          </>
        )}

        {/* ADMIN y STORE_HOST */}
        {canPublishActivities && (
          <NavLink to="/activities/new" className="nav-link">Nueva actividad</NavLink>
        )}

        {/* Solo ADMIN */}
        {isAdmin && (
          <>
            <NavLink to="/users" className="nav-link">Usuarios</NavLink>
            <NavLink to="/reports" end className="nav-link">Reportes</NavLink>
          </>
        )}
      </nav>

      {/* Sesión: nombre y botón de salir, a la derecha del todo */}
      {user && (
        <div className="nav-session">
          <span className="nav-user">{user.name}</span>
          <button type="button" className="nav-btn nav-btn--logout" onClick={onLogout}>
            Salir
          </button>
        </div>
      )}
    </header>
  );
}
