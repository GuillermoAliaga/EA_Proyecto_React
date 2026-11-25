import { environment } from '../config/environment';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// El access token vive solo en memoria (nunca en localStorage)
let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => { accessToken = t; };
export const getAccessToken = () => accessToken;

let onSessionExpired: (() => void) | null = null;
export const setOnSessionExpired = (fn: () => void) => { onSessionExpired = fn; };

// Si hay varias peticiones a la vez con 401, solo se hace UN refresh
let refreshing: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${environment.apiUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // envía la cookie HttpOnly
      });
      if (!res.ok) return null;
      const data = await res.json();
      accessToken = data.token; 
      return accessToken;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const isAuthRoute = path.startsWith('/auth/');
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (accessToken && !isAuthRoute) headers.set('Authorization', `Bearer ${accessToken}`);

  let res: Response;
  try {
    res = await fetch(`${environment.apiUrl}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError('No se puede conectar con la API', 0);
  }

  if (res.status === 401 && retry && !isAuthRoute) {
    const token = await refreshAccessToken();
    if (token) return request<T>(path, options, false); // se reintenta una sola vez
    onSessionExpired?.();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? `Error ${res.status}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
  
}