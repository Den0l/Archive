"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    ReactNode,
    useRef,
    useState,
} from 'react';
import { subscribeGlobalNotification } from '@/context/notificationBus';
import { requireContext } from '@/context/contextUtils';

export type NotificationLevel = 'info' | 'warning' | 'error' | 'success';
export type NotificationImportance = 'normal' | 'high';

export type NotificationLegacyVariant =
    | 'primary'
    | 'secondary'
    | 'success'
    | 'danger'
    | 'warning'
    | 'info'
    | 'light'
    | 'dark';

export interface Notification {
    id: number;
    message: string;
    level: NotificationLevel;
    importance: NotificationImportance;
    title?: string;
    durationMs: number;
    createdAt: number;
}

export interface NotificationOptions {
    level?: NotificationLevel;
    importance?: NotificationImportance;
    title?: string;
    durationMs?: number;
}

interface NotificationContextType {
    notifications: Notification[];
    addNotification: (
        message: string,
        options?: NotificationOptions | NotificationLegacyVariant
    ) => void;
    removeNotification: (id: number) => void;
}

const DEDUPE_WINDOW_MS = 2000;

const NotificationContext = createContext<NotificationContextType | undefined>(
    undefined
);

const mapLegacyVariantToLevel = (
    variant: NotificationLegacyVariant
): NotificationLevel => {
    switch (variant) {
        case 'success':
            return 'success';
        case 'danger':
            return 'error';
        case 'warning':
            return 'warning';
        case 'primary':
        case 'secondary':
        case 'light':
        case 'dark':
        case 'info':
        default:
            return 'info';
    }
};

const resolveNotificationInput = (
    options?: NotificationOptions | NotificationLegacyVariant
): NotificationOptions => {
    if (!options) {
        return {};
    }

    if (typeof options === 'string') {
        return { level: mapLegacyVariantToLevel(options) };
    }

    return options;
};

const normalizeNotificationMessage = (
    message: string,
    level: NotificationLevel
) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
        return '';
    }

    if (level !== 'error') {
        return trimmedMessage;
    }

    const messageWithoutTrailingDots = trimmedMessage
        .replace(/\.+\s*$/, '')
        .trimEnd();

    return messageWithoutTrailingDots || trimmedMessage;
};

export const useNotification = () => {
    return requireContext(
        useContext(NotificationContext),
        'useNotification',
        'NotificationProvider'
    );
};

interface NotificationProviderProps {
    children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
    children,
}) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const nextIdRef = useRef(1);
    const recentKeyMapRef = useRef<Record<string, number>>({});

    const addNotification = useCallback((
        message: string,
        options?: NotificationOptions | NotificationLegacyVariant
    ) => {
        const resolvedOptions = resolveNotificationInput(options);
        const level = resolvedOptions.level ?? 'info';
        const normalizedMessage = normalizeNotificationMessage(message, level);
        if (!normalizedMessage) {
            return;
        }

        const importance =
            resolvedOptions.importance ?? (level === 'error' ? 'high' : 'normal');
        const durationMs =
            resolvedOptions.durationMs ??
            (importance === 'high' || level === 'error' ? 8000 : 5000);

        const dedupeKey = `${level}:${normalizedMessage.toLowerCase()}`;
        const now = Date.now();
        const lastShownAt = recentKeyMapRef.current[dedupeKey] ?? 0;
        if (now - lastShownAt < DEDUPE_WINDOW_MS) {
            return;
        }

        recentKeyMapRef.current[dedupeKey] = now;

        const newNotification: Notification = {
            id: nextIdRef.current++,
            message: normalizedMessage,
            level,
            importance,
            title: resolvedOptions.title,
            durationMs,
            createdAt: now,
        };

        setNotifications((prev) => [...prev, newNotification]);
    }, []);

    const removeNotification = useCallback((id: number) => {
        setNotifications((prev) => prev.filter((notification) => notification.id !== id));
    }, []);

    useEffect(() => {
        return subscribeGlobalNotification((event) => {
            addNotification(event.message, {
                level: event.level,
                importance: event.importance,
                title: event.title,
                durationMs: event.durationMs,
            });
        });
    }, [addNotification]);

    return (
        <NotificationContext.Provider
            value={{ notifications, addNotification, removeNotification }}
        >
            {children}
        </NotificationContext.Provider>
    );
};
