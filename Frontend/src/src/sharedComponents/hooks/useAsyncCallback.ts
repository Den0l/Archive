import { useCallback, useRef, useState } from 'react';

type UseAsyncCallbackResult<Args extends unknown[], R> = {
    invoke: (...args: Args) => Promise<R | undefined>;
    loading: boolean;
};

/**
 * Wraps an async function so callers get a stable invoke() and a loading flag,
 * and a single onError hook absorbs failures (returning undefined). Without
 * onError, errors propagate from invoke().
 *
 * Use when the load should fire on demand (a button click, a gated useEffect)
 * — for fire-on-mount, prefer useAsyncData.
 */
export function useAsyncCallback<Args extends unknown[], R>(
    fn: (...args: Args) => Promise<R>,
    options: {
        onError?: (error: unknown) => void;
        initialLoading?: boolean;
    } = {}
): UseAsyncCallbackResult<Args, R> {
    const [loading, setLoading] = useState(options.initialLoading ?? false);

    const fnRef = useRef(fn);
    fnRef.current = fn;

    const onErrorRef = useRef(options.onError);
    onErrorRef.current = options.onError;

    const invoke = useCallback(async (...args: Args) => {
        setLoading(true);
        try {
            return await fnRef.current(...args);
        } catch (error) {
            if (onErrorRef.current) {
                onErrorRef.current(error);
                return undefined;
            }
            throw error;
        } finally {
            setLoading(false);
        }
    }, []);

    return { invoke, loading };
}
