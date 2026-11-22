import { request } from './http';
import { toQueryString, type ListParams, type PaginatedResponse } from '../models';
import type { Report, ReportInput, ReportReviewInput } from '../models';

const BASE = '/reports';

export const reportService = {
  getAll: (params: ListParams = {}, signal?: AbortSignal) =>
    request<PaginatedResponse<Report>>(`${BASE}${toQueryString(params)}`, { signal }),

  getOne: (id: string, signal?: AbortSignal) =>
    request<Report>(`${BASE}/${id}`, { signal }),

  create: (payload: ReportInput) =>
    request<Report>(BASE, { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: string, payload: Partial<ReportInput> | ReportReviewInput) =>
  request<Report>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

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
};