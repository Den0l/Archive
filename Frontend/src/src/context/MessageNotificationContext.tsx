'use client';

import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import { HubConnection, HubConnectionBuilder } from '@microsoft/signalr';
import { useAuth } from '@/context/AuthContext';

interface MessageNotificationContextType {
    hasUnreadMessages: boolean;
    unreadConversationIds: string[];
    isConversationUnread: (conversationId: string) => boolean;
    markConversationRead: (conversationId: string) => void;
    clearUnreadMessages: () => void;
}

const MessageNotificationContext = createContext<
    MessageNotificationContextType | undefined
>(undefined);

const getStorageKey = (userId: string) =>
    `marketplace_unread_conversations_${userId}`;

const readUnreadConversationIds = (userId: string) => {
    try {
        const raw = localStorage.getItem(getStorageKey(userId));
        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw) as string[];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Failed to read unread conversations from storage', error);
        return [];
    }
};

const writeUnreadConversationIds = (userId: string, conversationIds: string[]) => {
    localStorage.setItem(
        getStorageKey(userId),
        JSON.stringify(conversationIds)
    );
};

const clearUnreadConversationIds = (userId: string) => {
    localStorage.removeItem(getStorageKey(userId));
};

export const MessageNotificationProvider = ({
    children,
}: {
    children: ReactNode;
}) => {
    const { user, loading } = useAuth();
    const [unreadConversationIds, setUnreadConversationIds] = useState<string[]>(
        []
    );
    const hubRef = useRef<HubConnection | null>(null);

    useEffect(() => {
        if (loading) {
            return;
        }

        if (!user) {
            setUnreadConversationIds([]);
            return;
        }

        setUnreadConversationIds(readUnreadConversationIds(user.id));
    }, [user, loading]);

    useEffect(() => {
        if (!user) {
            return;
        }

        writeUnreadConversationIds(user.id, unreadConversationIds);
    }, [user, unreadConversationIds]);

    useEffect(() => {
        if (loading || !user) {
            hubRef.current?.stop().catch(console.error);
            hubRef.current = null;
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            return;
        }

        const connection = new HubConnectionBuilder()
            .withUrl(`${process.env.NEXT_PUBLIC_API_BASE_URL}/chathub`, {
                accessTokenFactory: () => localStorage.getItem('token') || '',
            })
            .withAutomaticReconnect()
            .build();

        connection.on(
            'ReceiveMessageNotification',
            (
                senderId: string,
                message: { conversationId?: string; ConversationId?: string }
            ) => {
                if (senderId === user.id) {
                    return;
                }

                const conversationId =
                    message.conversationId ?? message.ConversationId;
                if (!conversationId) {
                    return;
                }

                setUnreadConversationIds((prev) =>
                    prev.includes(conversationId)
                        ? prev
                        : [...prev, conversationId]
                );
            }
        );

        connection
            .start()
            .catch((error) =>
                console.error('Failed to initialize message notifications', error)
            );

        hubRef.current = connection;

        return () => {
            connection.off('ReceiveMessageNotification');
            connection.stop().catch(console.error);
            if (hubRef.current === connection) {
                hubRef.current = null;
            }
        };
    }, [user, loading]);

    const isConversationUnread = useCallback(
        (conversationId: string) => unreadConversationIds.includes(conversationId),
        [unreadConversationIds]
    );

    const markConversationRead = useCallback((conversationId: string) => {
        setUnreadConversationIds((prev) =>
            prev.filter((id) => id !== conversationId)
        );
    }, []);

    const clearUnreadMessages = useCallback(() => {
        if (user) {
            clearUnreadConversationIds(user.id);
        }
        setUnreadConversationIds([]);
    }, [user]);

    return (
        <MessageNotificationContext.Provider
            value={{
                hasUnreadMessages: unreadConversationIds.length > 0,
                unreadConversationIds,
                isConversationUnread,
                markConversationRead,
                clearUnreadMessages,
            }}
        >
            {children}
        </MessageNotificationContext.Provider>
    );
};

export const useMessageNotifications = (): MessageNotificationContextType => {
    const context = useContext(MessageNotificationContext);
    if (!context) {
        throw new Error(
            'useMessageNotifications must be used within MessageNotificationProvider'
        );
    }

    return context;
};
