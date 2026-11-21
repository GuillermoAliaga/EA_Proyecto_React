import { useSearchParams } from 'react-router-dom';

export function useListControls() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('q') ?? '';
  const page = Math.max(Number(searchParams.get('page')) || 1, 1);

  const setSearch = (q: string) => {
    const next = new URLSearchParams(searchParams);
    if (q) next.set('q', q); else next.delete('q');
    next.set('page', '1'); // al buscar, vuelve a la página 1
    setSearchParams(next, { replace: true });
  };

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  };

  return { search, page, setSearch, setPage };
}