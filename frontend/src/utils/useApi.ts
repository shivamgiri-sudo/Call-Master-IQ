/**
 * useApi — minimal data-fetching hook.
 *
 * Returns the discriminated ApiResult<T> along with a manual `reload` trigger.
 * Designed for honest UI states: callers must render based on result.kind.
 *
 * Usage:
 *   const { result, reload } = useApi(() => getSplitKpis(filters.toQuery()));
 *   if (result.kind === 'loading') return <LoadingSkeleton />;
 *   if (result.kind === 'error')   return <ErrorState onRetry={reload} />;
 *   if (result.kind === 'unsupported') return <UnsupportedState ... />;
 *   if (result.kind === 'empty')   return <EmptyState />;
 *   return <RealData data={result.data} />;
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiResult } from '../api/types';

export type AsyncResult<T> =
  | { kind: 'loading' }
  | { kind: 'ready'; result: ApiResult<T> };

export function useApi<T>(
  fetcher: () => Promise<ApiResult<T>>,
  deps: ReadonlyArray<unknown> = [],
): { state: AsyncResult<T>; reload: () => void } {
  const [state, setState] = useState<AsyncResult<T>>({ kind: 'loading' });
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);

  // Keep ref current without re-running effect on identity changes
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const reload = useCallback(() => {
    setTick(t => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    fetcherRef.current().then(result => {
      if (cancelled) return;
      setState({ kind: 'ready', result });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { state, reload };
}