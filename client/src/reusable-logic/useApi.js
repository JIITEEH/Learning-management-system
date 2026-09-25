import { useCallback, useEffect, useState } from 'react';

// Runs an API call when the screen opens, and again whenever `deps` change:
//   const { data, loading, error, reload } = useApi(() => api.getCourse(id), [id]);
// Keeps the previous data while reloading, so a screen does not flash back to "Loading…"
// after every save.
export default function useApi(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      setState({ data: await fetcher(), loading: false, error: null });
    } catch (error) {
      setState((previous) => ({ ...previous, loading: false, error }));
    }
    // Callers pass their own dependency list, so the fetcher is re-created only when those change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
