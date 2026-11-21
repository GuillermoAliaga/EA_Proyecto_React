import { useCallback, useEffect, useState } from 'react';
import { toQueryString } from '../models';
import type { ListParams, PaginatedResponse } from '../models';
import { errorMessage, isAbort } from '../utils/api-error';

type Fetcher<T> = (params: ListParams, signal?: AbortSignal) => Promise<PaginatedResponse<T>>;

export function usePaginatedList<T>(fetcher: Fetcher<T>, params: ListParams) {
  const [items, setItems] = useState<T[]>([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // params es un objeto nuevo en cada render, pero su texto solo cambia si cambian los valores
  const paramsKey = toQueryString(params);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetcher(params, controller.signal)
      .then((res) => {
        setItems(res.data);
        setTotalDocs(res.totalDocs);
        setTotalPages(Math.max(res.totalPages, 1));
      })
      .catch((e) => {
        if (isAbort(e)) return;
        setError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher, paramsKey, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { items, totalDocs, totalPages, loading, error, reload };
}