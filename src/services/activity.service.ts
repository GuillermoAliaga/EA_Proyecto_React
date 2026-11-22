import { request } from './http';
import { toQueryString, type ListParams, type PaginatedResponse } from '../models';
import type { Activity, ActivityInput } from '../models';

const BASE = '/activities';

export const activityService = {
  getAll: (params: ListParams = {}, signal?: AbortSignal) =>
    request<PaginatedResponse<Activity>>(`${BASE}${toQueryString(params)}`, { signal }),

  getOne: (id: string, signal?: AbortSignal) =>
    request<Activity>(`${BASE}/${id}`, { signal }),

  create: (payload: ActivityInput) =>
    request<Activity>(BASE, { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: string, payload: Partial<ActivityInput>) =>
    request<Activity>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  softDelete: (id: string) =>
    request<void>(`${BASE}/${id}/soft-delete`, { method: 'PATCH' }),

  restore: (id: string) =>
    request<void>(`${BASE}/${id}/restore`, { method: 'PATCH' }),

  remove: (id: string) =>
    request<void>(`${BASE}/${id}`, { method: 'DELETE' }),

  bulkSoftDelete: (ids: string[]) =>
    request<void>(`${BASE}/bulk-soft-delete`, { method: 'PATCH', body: JSON.stringify({ ids }) }),

  bulkRemove: (ids: string[]) =>
    request<void>(`${BASE}/bulk`, { method: 'DELETE', body: JSON.stringify({ ids }) }),
  
  enroll: (id: string) =>
  request<Activity>(`${BASE}/${id}/participants`, { method: 'POST' }),
};