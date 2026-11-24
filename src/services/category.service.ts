import { request } from './http';

export interface CategoryItem {
  _id?: string;
  name: string;
  subcategories: string[];
}

export const categoryService = {
  getAll: async (signal?: AbortSignal): Promise<CategoryItem[]> => {
    const res = await request<unknown>('/categories', { signal });
    const rawList = Array.isArray(res)
      ? res
      : ((res as { data?: unknown[]; items?: unknown[] })?.data ??
         (res as { items?: unknown[] })?.items ??
         []);

    return rawList
      .map((item: any) => {
        const name = typeof item === 'string' ? item : String(item?.name ?? item?.category ?? '');
        const rawSubs = Array.isArray(item?.subcategories) ? item.subcategories : [];
        const subcategories = rawSubs
          .map((s: any) => (typeof s === 'string' ? s : String(s?.name ?? '')))
          .filter(Boolean);
        return { _id: item?._id, name, subcategories };
      })
      .filter((c) => Boolean(c.name));
  },
};