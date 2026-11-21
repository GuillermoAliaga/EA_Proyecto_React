export interface PaginatedResponse<T> {
  data: T[];
  totalDocs: number;
  totalPages: number;
  currentPage: number;
}

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;         
  deleted?: boolean;      
  role?: string;
  status?: string;
  category?: string;
  subcategory?: string;
  reason?: string;
  targetType?: string;
}

// Equivalente al toHttpParams() de Angular: omite undefined, null y ''
export function toQueryString(params: ListParams): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value));
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}