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
        setHydrated(false);
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored) as CartItem[];
                if (Array.isArray(parsed)) {
                    setItems(parsed);
                } else {
                    setItems([]);
                }
            } else {
                setItems([]);
            }
        } catch (error) {
            console.warn('Failed to read cart from storage', error);
            localStorage.removeItem(storageKey);
            setItems([]);
        } finally {
            setHydrated(true);
        }
    }, [storageKey]);

    useEffect(() => {
        if (!hydrated) return;
        localStorage.setItem(storageKey, JSON.stringify(items));
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
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within CartProvider');
    }
    return context;
};
