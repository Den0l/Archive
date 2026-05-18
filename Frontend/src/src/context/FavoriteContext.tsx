'use client';

import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    ReactNode,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { requireContext } from '@/context/contextUtils';
import {
    readJsonFromStorage,
    removeFromStorage,
    writeJsonToStorage,
} from '@/context/storageUtils';
import {
    addFavorite as addFavoriteApi,
    fetchFavorites,
    removeFavorite as removeFavoriteApi,
} from '@/services/favoriteService';
import { FavoriteItemDto } from '@/types/api/favorites';
import { resolveApiAssetUrl } from '@/utils/assetUrl';

export interface FavoriteItem {
    id: string;
    title: string;
    price: number;
    imageUrl: string;
    isSold: boolean;
    isArchived: boolean;
}

interface FavoriteContextType {
    items: FavoriteItem[];
    totalItems: number;
    addFavorite: (item: Omit<FavoriteItem, 'id'> & { id: string }) => void;
    removeFavorite: (id: string) => void;
    isFavorite: (id: string) => boolean;
}

const FavoriteContext = createContext<FavoriteContextType | undefined>(
    undefined
);

const STORAGE_KEY = 'marketplace_favorites';

const isFavoriteItemsArray = (value: unknown): value is FavoriteItem[] =>
    Array.isArray(value);

const mapDtoToFavorite = (dto: FavoriteItemDto): FavoriteItem => ({
    id: dto.listingId,
    title: dto.listing?.title ?? 'Объявление удалено',
    price: dto.listing?.price ?? 0,
    imageUrl:
        resolveApiAssetUrl(dto.listing?.images?.[0]?.imageUrl) ||
        '/default-image.jpg',
    isSold: dto.listing?.isSold ?? true,
    isArchived: dto.listing?.isArchived ?? true,
});

const readLocal = (): FavoriteItem[] => {
    return readJsonFromStorage<FavoriteItem[]>(
        STORAGE_KEY,
        [],
        isFavoriteItemsArray,
        {
            onError: (error) => {
                console.warn('Failed to read favorites from storage', error);
            },
        }
    );
};

const writeLocal = (items: FavoriteItem[]) => {
    writeJsonToStorage(STORAGE_KEY, items);
};

const clearLocal = () => {
    removeFromStorage(STORAGE_KEY);
};

export const FavoriteProvider = ({ children }: { children: ReactNode }) => {
    const { user, loading } = useAuth();
    const [items, setItems] = useState<FavoriteItem[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const hasSyncedRef = useRef(false);

    useEffect(() => {
        setItems(readLocal());
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated || loading) return;
        if (!user) {
            hasSyncedRef.current = false;
            setItems(readLocal());
            return;
        }
        if (hasSyncedRef.current) return;
        hasSyncedRef.current = true;
        const sync = async () => {
            const localItems = readLocal();
            for (const item of localItems) {
                try {
                    await addFavoriteApi(item.id);
                } catch {
                    // ignore individual failures during merge
                }
            }
            clearLocal();
            const serverItems = await fetchFavorites();
            setItems(serverItems.map(mapDtoToFavorite));
        };
        sync();
    }, [user, loading, hydrated]);

    useEffect(() => {
        if (!hydrated || loading) return;
        if (!user) {
            writeLocal(items);
        }
    }, [items, user, loading, hydrated]);

    const addFavorite = (item: Omit<FavoriteItem, 'id'> & { id: string }) => {
        if (!user) {
            setItems((prev) => {
                if (prev.some((existing) => existing.id === item.id)) {
                    return prev;
                }
                return [...prev, { ...item }];
            });
            return;
        }

        const addServer = async () => {
            try {
                const dto = await addFavoriteApi(item.id);
                const mapped = mapDtoToFavorite(dto);
                setItems((prev) => {
                    if (prev.some((existing) => existing.id === mapped.id)) {
                        return prev;
                    }
                    return [...prev, mapped];
                });
            } catch (error) {
                console.error('Failed to add favorite', error);
            }
        };

        addServer();
    };

    const removeFavorite = (id: string) => {
        if (!user) {
            setItems((prev) => prev.filter((item) => item.id !== id));
            return;
        }

        const removeServer = async () => {
            try {
                await removeFavoriteApi(id);
                setItems((prev) => prev.filter((item) => item.id !== id));
            } catch (error) {
                console.error('Failed to remove favorite', error);
            }
        };

        removeServer();
    };

    const isFavorite = (id: string) => items.some((item) => item.id === id);

    const totalItems = useMemo(() => items.length, [items]);

    return (
        <FavoriteContext.Provider
            value={{
                items,
                totalItems,
                addFavorite,
                removeFavorite,
                isFavorite,
            }}
        >
            {children}
        </FavoriteContext.Provider>
    );
};

export const useFavorites = (): FavoriteContextType => {
    return requireContext(
        useContext(FavoriteContext),
        'useFavorites',
        'FavoriteProvider'
    );
};

