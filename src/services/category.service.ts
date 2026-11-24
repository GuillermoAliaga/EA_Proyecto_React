import { request } from './http';

export interface SubcategoryItem {
  name: string;
  slug: string;
}

export interface CategoryItem {
  _id?: string;
  name: string;
  slug: string;
  subcategories: SubcategoryItem[];
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
        const name = typeof item === 'string' ? item : String(item?.name ?? item?.slug ?? '');
        const slug = typeof item === 'string'
          ? item.toUpperCase()
          : String(item?.slug ?? item?.name ?? '').trim().toUpperCase();

        const rawSubs = Array.isArray(item?.subcategories) ? item.subcategories : [];
        const subcategories: SubcategoryItem[] = rawSubs
          .map((s: any) => ({
            name: typeof s === 'string' ? s : String(s?.name ?? s?.slug ?? ''),
            slug: typeof s === 'string'
              ? s.toUpperCase()
              : String(s?.slug ?? s?.name ?? '').trim().toUpperCase(),
          }))
          .filter((s: SubcategoryItem) => Boolean(s.slug));

        return { _id: item?._id, name, slug, subcategories };
      })
      .filter((c: CategoryItem) => Boolean(c.slug));
  },
};