import {
    Dispatch,
    SetStateAction,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

type UseAsyncDataResult<T> = {
    data: T;
    setData: Dispatch<SetStateAction<T>>;
    loading: boolean;
    reload: () => Promise<void>;
};

/**
 * Loads async data on mount, exposes the resulting data + loading flag,
 * and a reload() callback. Loader and onError are read through refs so
 * the returned reload identity is stable across renders, which keeps
 * dependant useEffect/useCallback chains from re-firing.
 */
export function useAsyncData<T>(
    loader: () => Promise<T>,
    initial: T,
    options: { onError?: (error: unknown) => void } = {}
): UseAsyncDataResult<T> {
    const [data, setData] = useState<T>(initial);
    const [loading, setLoading] = useState(false);

    const loaderRef = useRef(loader);
    loaderRef.current = loader;

    const onErrorRef = useRef(options.onError);
    onErrorRef.current = options.onError;

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const result = await loaderRef.current();
            setData(result);
        } catch (error) {
            onErrorRef.current?.(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    return { data, setData, loading, reload };
}
