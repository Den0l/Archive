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
import { requireContext } from '@/context/contextUtils';
import {
    readJsonFromStorage,
    removeFromStorage,
    writeJsonToStorage,
} from '@/context/storageUtils';
import {
    fetchAllConversations,
    fetchMessagesByConversationId,
} from '@/services/conversationService';
import { getToken } from '@/services/tokenService';

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
const getLastReadStorageKey = (userId: string) =>
    `marketplace_last_read_conversations_${userId}`;

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === 'string');

const readUnreadConversationIds = (userId: string) => {
    return readJsonFromStorage<string[]>(
        getStorageKey(userId),
        [],
        isStringArray,
        {
            onError: (error) => {
                console.warn(
                    'Failed to read unread conversations from storage',
                    error
                );
            },
        }
    );
};

type LastReadByConversation = Record<string, string>;

const isObjectRecord = (
    value: unknown
): value is Record<string, unknown> => {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const readLastReadByConversation = (userId: string): LastReadByConversation => {
    const parsedRecord = readJsonFromStorage<Record<string, unknown>>(
        getLastReadStorageKey(userId),
        {},
        isObjectRecord,
        {
            onError: (error) => {
                console.warn(
                    'Failed to read last read conversations from storage',
                    error
                );
            },
        }
    );

    return Object.entries(parsedRecord).reduce<LastReadByConversation>(
        (acc, [conversationId, readAt]) => {
            if (typeof readAt === 'string') {
                acc[conversationId] = readAt;
            }
            return acc;
        },
        {}
    );
};

const writeUnreadConversationIds = (userId: string, conversationIds: string[]) => {
    writeJsonToStorage(getStorageKey(userId), conversationIds);
};

const writeLastReadByConversation = (
    userId: string,
    lastReadByConversation: LastReadByConversation
) => {
    writeJsonToStorage(getLastReadStorageKey(userId), lastReadByConversation);
};

const clearUnreadConversationIds = (userId: string) => {
    removeFromStorage(getStorageKey(userId));
};

const mergeUnreadConversationIds = (...collections: string[][]) =>
    Array.from(new Set(collections.flat()));

const toTimestamp = (value: string | null | undefined) => {
    if (!value) {
        return 0;
    }

    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
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
    const [lastReadByConversation, setLastReadByConversation] =
        useState<LastReadByConversation>({});
    const hubRef = useRef<HubConnection | null>(null);
    const hasHydratedUnreadRef = useRef(false);

    useEffect(() => {
        if (loading) {
            return;
        }

        if (!user) {
            hasHydratedUnreadRef.current = false;
            setUnreadConversationIds([]);
            setLastReadByConversation({});
            return;
        }

        let isActive = true;

        const initializeUnreadConversations = async () => {
            const storedUnreadConversationIds = readUnreadConversationIds(user.id);
            const storedLastReadByConversation = readLastReadByConversation(user.id);
            setUnreadConversationIds(storedUnreadConversationIds);
            setLastReadByConversation(storedLastReadByConversation);

            try {
                const conversations = await fetchAllConversations();
                const messagesByConversation = await Promise.all(
                    conversations.map(async (conversation) => {
                        try {
                            return await fetchMessagesByConversationId(
                                conversation.id
                            );
                        } catch (error) {
                            console.error(
                                `Failed to load messages for conversation ${conversation.id}`,
                                error
                            );
                            return [];
                        }
                    })
                );

                if (!isActive) {
                    return;
                }

                const serverUnreadConversationIds = conversations
                    .filter((conversation, index) => {
                        const lastMessage = messagesByConversation[index].at(-1);
                        if (!lastMessage || lastMessage.senderId === user.id) {
                            return false;
                        }

                        const lastReadAt =
                            storedLastReadByConversation[conversation.id];
                        return (
                            toTimestamp(lastMessage.createdAt) >
                            toTimestamp(lastReadAt)
                        );
                    })
                    .map((conversation) => conversation.id);

                setUnreadConversationIds((prev) =>
                    mergeUnreadConversationIds(prev, serverUnreadConversationIds)
                );
            } catch (error) {
                console.error('Failed to initialize unread conversations', error);

                if (!isActive) {
                    return;
                }
            } finally {
                if (isActive) {
                    hasHydratedUnreadRef.current = true;
                }
            }
        };

        void initializeUnreadConversations();

        return () => {
            isActive = false;
        };
    }, [user, loading]);

    useEffect(() => {
        if (!user || !hasHydratedUnreadRef.current) {
            return;
        }

        writeUnreadConversationIds(user.id, unreadConversationIds);
        writeLastReadByConversation(user.id, lastReadByConversation);
    }, [user, unreadConversationIds, lastReadByConversation]);

    useEffect(() => {
        if (loading || !user) {
            hubRef.current?.stop().catch(console.error);
            hubRef.current = null;
            return;
        }

        const token = getToken();
        if (!token) {
            return;
        }

        const connection = new HubConnectionBuilder()
            .withUrl(`${process.env.NEXT_PUBLIC_API_BASE_URL}/chathub`, {
                accessTokenFactory: () => getToken() || '',
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
        const readAt = new Date().toISOString();
        setUnreadConversationIds((prev) =>
            prev.filter((id) => id !== conversationId)
        );
        setLastReadByConversation((prev) => ({
            ...prev,
            [conversationId]: readAt,
        }));
    }, []);

    const clearUnreadMessages = useCallback(() => {
        if (user) {
            clearUnreadConversationIds(user.id);
        }
        if (unreadConversationIds.length > 0) {
            const readAt = new Date().toISOString();
            setLastReadByConversation((prev) => {
                const next = { ...prev };
                unreadConversationIds.forEach((conversationId) => {
                    next[conversationId] = readAt;
                });
                return next;
            });
        }
        setUnreadConversationIds([]);
    }, [user, unreadConversationIds]);

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
    return requireContext(
        useContext(MessageNotificationContext),
        'useMessageNotifications',
        'MessageNotificationProvider'
    );
};
