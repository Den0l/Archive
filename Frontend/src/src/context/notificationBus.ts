export type GlobalNotificationLevel = 'info' | 'warning' | 'error' | 'success';
export type GlobalNotificationImportance = 'normal' | 'high';

export interface GlobalNotificationEvent {
    message: string;
    level?: GlobalNotificationLevel;
    importance?: GlobalNotificationImportance;
    title?: string;
    durationMs?: number;
}

type GlobalNotificationListener = (event: GlobalNotificationEvent) => void;

const listeners = new Set<GlobalNotificationListener>();

export const emitGlobalNotification = (event: GlobalNotificationEvent) => {
    if (typeof window === 'undefined') {
        return;
    }

    listeners.forEach((listener) => listener(event));
};

export const subscribeGlobalNotification = (
    listener: GlobalNotificationListener
) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};
