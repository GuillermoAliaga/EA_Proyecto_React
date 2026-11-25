import { request } from './http';
import { toQueryString } from '../models';
import type { Activity, ActivityInput, ListParams, PaginatedResponse } from '../models';

export const activityService = {
  getAll: (params: ListParams = {}, signal?: AbortSignal) =>
    request<PaginatedResponse<Activity>>(`/activities${toQueryString(params)}`, { signal }),

  getOne: (id: string, signal?: AbortSignal) =>
    request<Activity>(`/activities/${id}`, { signal }),

  create: (data: ActivityInput) =>
    request<Activity>('/activities', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<ActivityInput>) =>
    request<Activity>(`/activities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  enroll: (id: string) =>
    request<Activity>(`/activities/${id}/participants`, { method: 'POST' }),

  unenroll: (id: string) =>
    request<Activity>(`/activities/${id}/participants`, { method: 'DELETE' }),

  softDelete: (id: string) =>
    request<void>(`/activities/${id}/soft-delete`, { method: 'PATCH' }),

  restore: (id: string) =>
    request<Activity>(`/activities/${id}/restore`, { method: 'PATCH' }),

  remove: (id: string) =>
    request<void>(`/activities/${id}`, { method: 'DELETE' }),

  bulkSoftDelete: (ids: string[]) =>
    request<void>('/activities/bulk-soft-delete', {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    }),

  bulkRemove: (ids: string[]) =>
    request<void>('/activities/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    }),
};