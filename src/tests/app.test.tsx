import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  request,
  setAccessToken,
  setOnSessionExpired,
} from '../services/http';
import { toQueryString, type ListParams } from '../models/paginated.model';
import { ProtectedRoute } from '../components/ProtectedRoutes';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Cliente HTTP y sesión (http.ts)', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    setAccessToken(null);
    setOnSessionExpired(() => {});
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('añade la cabecera "Authorization: Bearer <token>" en peticiones protegidas cuando hay access token en memoria', async () => {
    setAccessToken('token-secreto-123');
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await request('/activities');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer token-secreto-123');
  });

  it('no envía la cabecera "Authorization" en rutas "/auth/..." aunque haya token en memoria', async () => {
    setAccessToken('token-secreto-123');
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: 'nuevo' }));

    await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: '123' }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.has('Authorization')).toBe(false);
  });

  it('renueva el token en un 401 y repite la petición una sola vez con el token nuevo', async () => {
    setAccessToken('token-caducado');

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: 'Expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ token: 'token-renovado' }, 200))
      .mockResolvedValueOnce(jsonResponse({ data: 'ok' }, 200));

    const result = await request<{ data: string }>('/users/me');

    expect(result).toEqual({ data: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh');

    const retryHeaders = new Headers(fetchMock.mock.calls[2][1]?.headers);
    expect(retryHeaders.get('Authorization')).toBe('Bearer token-renovado');
  });

  it('omite valores undefined, null o vacíos en toQueryString()', () => {
    const params: ListParams = {
      page: 1,
      search: 'padel',
      category: undefined,
      status: null as unknown as string,
      role: '',
    };

    const qs = toQueryString(params);

    expect(qs).toBe('?page=1&search=padel');
    expect(qs).not.toContain('category');
    expect(qs).not.toContain('status');
    expect(qs).not.toContain('role');
  });

  it('devuelve una cadena vacía en toQueryString() cuando todos los parámetros son omitidos', () => {
    const qs = toQueryString({
      page: undefined,
      search: '',
      category: null as unknown as string,
    });

    expect(qs).toBe('');
  });
});

describe('ProtectedRoute', () => {
  afterEach(() => {
    cleanup();
    mockedUseAuth.mockReset();
  });

  function renderWithRouter(roles?: ('USER' | 'ADMIN' | 'STORE_HOST')[]) {
    return render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/" element={<div>Página Inicio</div>} />
          <Route path="/login" element={<div>Página Login</div>} />
          <Route element={<ProtectedRoute roles={roles} />}>
            <Route path="/admin" element={<div>Panel Privado</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  }

  it('redirige a "/login" cuando no hay sesión iniciada', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      loading: false,
      isAdmin: false,
      canPublishActivities: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderWithRouter();

    expect(screen.getByText('Página Login')).toBeTruthy();
  });

  it('redirige a "/" cuando el rol del usuario no coincide con los permitidos', () => {
    mockedUseAuth.mockReturnValue({
      user: {
        _id: '1',
        name: 'Erik',
        email: 'erik@test.com',
        role: 'USER',
      } as never,
      loading: false,
      isAdmin: false,
      canPublishActivities: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderWithRouter(['ADMIN']);

    expect(screen.getByText('Página Inicio')).toBeTruthy();
  });

  it('renderiza la ruta protegida cuando hay sesión y el rol coincide', () => {
    mockedUseAuth.mockReturnValue({
      user: {
        _id: '1',
        name: 'Admin',
        email: 'admin@test.com',
        role: 'ADMIN',
      } as never,
      loading: false,
      isAdmin: true,
      canPublishActivities: true,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderWithRouter(['ADMIN']);

    expect(screen.getByText('Panel Privado')).toBeTruthy();
  });
});