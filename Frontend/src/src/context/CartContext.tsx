'use client';

import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    ReactNode,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchListingById } from '@/services/listingService';
import { requireContext } from '@/context/contextUtils';
import {
    readJsonFromStorage,
    removeFromStorage,
    writeJsonToStorage,
} from '@/context/storageUtils';

export interface CartItem {
    id: string;
    title: string;
    price: number;
    imageUrl: string;
    quantity: number;
}

interface CartContextType {
    items: CartItem[];
    totalItems: number;
    totalPrice: number;
    addItem: (item: Omit<CartItem, 'quantity'>) => void;
    removeItem: (id: string) => void;
    clearCart: () => void;
    isInCart: (id: string) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'marketplace_cart_items';
const GUEST_STORAGE_KEY = `${STORAGE_KEY_PREFIX}_guest`;
const isCartItemsArray = (value: unknown): value is CartItem[] =>
    Array.isArray(value);

const mergeCartItems = (
    accountItems: CartItem[],
    guestItems: CartItem[]
): CartItem[] => {
    const merged = new Map<string, CartItem>();

    for (const item of accountItems) {
        merged.set(item.id, item);
    }

    for (const item of guestItems) {
        const existing = merged.get(item.id);
        if (!existing) {
            merged.set(item.id, item);
            continue;
        }

        merged.set(item.id, {
            ...existing,
            quantity: existing.quantity + (item.quantity || 1),
        });
    }

    return Array.from(merged.values());
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [items, setItems] = useState<CartItem[]>([]);
    const [hydrated, setHydrated] = useState(false);

    const storageKey = useMemo(() => {
        return user?.id
            ? `${STORAGE_KEY_PREFIX}_${user.id}`
            : `${STORAGE_KEY_PREFIX}_guest`;
    }, [user?.id]);

    useEffect(() => {
        const readStorageItems = (key: string): CartItem[] => {
            return readJsonFromStorage<CartItem[]>(
                key,
                [],
                isCartItemsArray,
                {
                    removeOnError: true,
                    onError: (error) => {
                        console.warn('Failed to read cart from storage', error);
                    },
                }
            );
        };

        setHydrated(false);
        let cancelled = false;

        const load = async () => {
            try {
                if (user?.id) {
                    const accountItems = readStorageItems(storageKey);
                    const guestItems = readStorageItems(GUEST_STORAGE_KEY);

                    let filteredGuestItems = guestItems;
                    if (guestItems.length > 0) {
                        const keepFlags = await Promise.all(
                            guestItems.map(async (item) => {
                                try {
                                    const listing = await fetchListingById(item.id);
                                    return listing.sellerId !== user.id;
                                } catch {
                                    return true;
                                }
                            })
                        );
                        filteredGuestItems = guestItems.filter(
                            (_, index) => keepFlags[index]
                        );
                    }

                    const mergedItems = mergeCartItems(
                        accountItems,
                        filteredGuestItems
                    );

                    if (cancelled) return;
                    setItems(mergedItems);

                    if (guestItems.length > 0) {
                        writeJsonToStorage(storageKey, mergedItems);
                        removeFromStorage(GUEST_STORAGE_KEY);
                    }
                } else {
                    if (cancelled) return;
                    setItems(readStorageItems(GUEST_STORAGE_KEY));
                }
            } finally {
                if (!cancelled) {
                    setHydrated(true);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [storageKey, user?.id]);

    useEffect(() => {
        if (!hydrated) return;
        writeJsonToStorage(storageKey, items);
    }, [items, hydrated, storageKey]);

    const addItem = (item: Omit<CartItem, 'quantity'>) => {
        setItems((prev) => {
            if (prev.some((existing) => existing.id === item.id)) {
                return prev;
            }
            return [...prev, { ...item, quantity: 1 }];
        });
    };

    const removeItem = (id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    };

    const clearCart = () => {
        setItems([]);
    };

    const isInCart = (id: string) => items.some((item) => item.id === id);

    const totalItems = useMemo(
        () => items.reduce((sum, item) => sum + item.quantity, 0),
        [items]
    );

    const totalPrice = useMemo(
        () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        [items]
    );

    return (
        <CartContext.Provider
            value={{
                items,
                totalItems,
                totalPrice,
                addItem,
                removeItem,
                clearCart,
                isInCart,
            }}
        >
            {children}
        </CartContext.Provider>
    );
};

export const useCart = (): CartContextType => {
    return requireContext(useContext(CartContext), 'useCart', 'CartProvider');
};
