'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { HubConnection, HubConnectionBuilder } from '@microsoft/signalr';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import { Conversation } from '@/types/api/conversations';
import { Message } from '@/types/api/messages';
import { User } from '@/types/api/users';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { useMessageNotifications } from '@/context/MessageNotificationContext';
import {
    ensureSystemConversation,
    fetchAllConversations,
    fetchMessagesByConversationId,
    fetchSystemUserId,
} from '@/services/conversationService';
import { fetchUserById } from '@/services/userService';
import RequireAuth from '@/sharedComponents/RequireAuth';
import {
    getApiErrorMessage,
    normalizeMultiline,
    validateReviewText,
    VALIDATION_LIMITS,
} from '@/utils/validation';
import { createReview } from '@/services/reviewService';
import styles from './InboxPage.module.css';

const LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;

const getTimeValue = (value: string | Date | null | undefined) => {
    if (!value) return 0;
    const date = value instanceof Date ? value : new Date(value);
    const time = date.getTime();
    return Number.isNaN(time) ? 0 : time;
};

const formatDate = (value: string | Date | null | undefined) => {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('ru-RU');
};

const resolveConversationId = (
    message: Partial<Message> & { ConversationId?: string }
) => message.conversationId ?? message.ConversationId ?? null;

function renderMessageContent(content: string, linkClassName: string) {
    LINK_REGEX.lastIndex = 0;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = LINK_REGEX.exec(content)) !== null) {
        if (match.index > lastIndex) {
            parts.push(content.slice(lastIndex, match.index));
        }
        parts.push(
            <a
                key={match.index}
                href={match[2]}
                className={linkClassName}
            >
                {match[1]}
            </a>
        );
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
    }

    return parts.length > 0 ? parts : content;
}

function InboxContent() {
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { isConversationUnread, markConversationRead } =
        useMessageNotifications();
    const currentUserId = user?.id ?? null;
    const selectedConversationIdFromQuery = searchParams.get('conversationId');

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [users, setUsers] = useState<Record<string, User>>({});
    const [selectedConversationId, setSelectedConversationId] = useState<
        string | null
    >(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageText, setMessageText] = useState('');
    const [reviewText, setReviewText] = useState('');
    const [reviewError, setReviewError] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [loadingConversations, setLoadingConversations] = useState(true);
    const [systemUserId, setSystemUserId] = useState<string | null>(null);
    const [isHubConnected, setIsHubConnected] = useState(false);

    const hubRef = useRef<HubConnection | null>(null);
    const selectedConversationIdRef = useRef<string | null>(null);
    const messagesAreaRef = useRef<HTMLDivElement | null>(null);
    const isMessagesAreaNearBottomRef = useRef(true);

    useEffect(() => {
        selectedConversationIdRef.current = selectedConversationId;
    }, [selectedConversationId]);

    const hydrateUsers = useCallback(
        (conversationList: Conversation[]) => {
            conversationList.forEach((conversation) => {
                const otherUserId = conversation.conversationParticipants.find(
                    (participant) => participant.userId !== currentUserId
                )?.userId;

                if (!otherUserId) {
                    return;
                }

                setUsers((prev) => {
                    if (prev[otherUserId]) {
                        return prev;
                    }

                    void fetchUserById(otherUserId)
                        .then((loadedUser) => {
                            setUsers((next) => ({
                                ...next,
                                [otherUserId]: loadedUser,
                            }));
                        })
                        .catch((error) => {
                            console.error(
                                `Failed to load user ${otherUserId}`,
                                error
                            );
                        });

                    return prev;
                });
            });
        },
        [currentUserId]
    );

    const loadConversations = useCallback(async () => {
        setLoadingConversations(true);

        try {
            await ensureSystemConversation().catch(() => {});
            const loadedConversations = await fetchAllConversations();
            const sorted = loadedConversations.sort(
                (a, b) =>
                    getTimeValue(b.lastUpdatedAt) - getTimeValue(a.lastUpdatedAt)
            );

            setConversations(sorted);
            hydrateUsers(sorted);
        } catch (error) {
            console.error('Failed to load conversations', error);
        } finally {
            setLoadingConversations(false);
        }
    }, [hydrateUsers]);

    useEffect(() => {
        void loadConversations();
    }, [loadConversations]);

    useEffect(() => {
        if (!selectedConversationIdFromQuery || conversations.length === 0) {
            return;
        }

        const exists = conversations.some(
            (conversation) => conversation.id === selectedConversationIdFromQuery
        );
        if (!exists) {
            return;
        }

        setSelectedConversationId(selectedConversationIdFromQuery);
    }, [selectedConversationIdFromQuery, conversations]);

    useEffect(() => {
        if (!selectedConversationId || conversations.length === 0) {
            return;
        }

        const exists = conversations.some(
            (conversation) => conversation.id === selectedConversationId
        );
        if (!exists) {
            setSelectedConversationId(null);
            setMessages([]);
        }
    }, [selectedConversationId, conversations]);

    useEffect(() => {
        if (!currentUserId) {
            return;
        }

        fetchSystemUserId()
            .then((id) => setSystemUserId(id))
            .catch((error) => {
                console.error('Failed to load system user id', error);
                setSystemUserId(null);
            });
    }, [currentUserId]);

    useEffect(() => {
        if (!selectedConversationId) {
            setMessages([]);
            return;
        }

        let isActive = true;

        const loadMessages = async () => {
            setLoadingMessages(true);

            try {
                const data = await fetchMessagesByConversationId(
                    selectedConversationId
                );
                if (!isActive) {
                    return;
                }

                setMessages(data);
                markConversationRead(selectedConversationId);
            } catch (error) {
                if (!isActive) {
                    return;
                }

                console.error(
                    `Failed to load messages for ${selectedConversationId}`,
                    error
                );
                setMessages([]);
            } finally {
                if (isActive) {
                    setLoadingMessages(false);
                }
            }
        };

        void loadMessages();

        return () => {
            isActive = false;
        };
    }, [selectedConversationId, markConversationRead]);

    useEffect(() => {
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

        const handleReceive = (
            senderId: string,
            incomingMessage: Partial<Message> & { ConversationId?: string }
        ) => {
            const conversationId = resolveConversationId(incomingMessage);
            if (!conversationId) {
                return;
            }

            setConversations((prev) => {
                const index = prev.findIndex(
                    (conversation) => conversation.id === conversationId
                );
                if (index === -1) {
                    return prev;
                }

                const updated = [...prev];
                const [conversation] = updated.splice(index, 1);
                const nextLastUpdatedAt =
                    incomingMessage.createdAt || new Date().toISOString();
                return [{ ...conversation, lastUpdatedAt: nextLastUpdatedAt }, ...updated];
            });

            if (selectedConversationIdRef.current !== conversationId) {
                return;
            }

            const normalizedMessage: Message = {
                id:
                    incomingMessage.id ??
                    `${conversationId}-${incomingMessage.createdAt ?? Date.now()}`,
                conversationId,
                senderId: incomingMessage.senderId ?? senderId,
                content: incomingMessage.content ?? '',
                createdAt:
                    incomingMessage.createdAt ?? new Date().toISOString(),
            };

            setMessages((prev) =>
                prev.some((message) => message.id === normalizedMessage.id)
                    ? prev
                    : [...prev, normalizedMessage]
            );
            markConversationRead(conversationId);
        };

        connection.on('ReceiveMessage', handleReceive);

        connection
            .start()
            .then(() => {
                hubRef.current = connection;
                setIsHubConnected(true);
            })
            .catch((error) => {
                console.error('Failed to connect chat hub', error);
                setIsHubConnected(false);
            });

        return () => {
            connection.off('ReceiveMessage', handleReceive);
            connection.stop().catch(console.error);
            hubRef.current = null;
            setIsHubConnected(false);
        };
    }, [markConversationRead]);

    useEffect(() => {
        if (!isHubConnected || !hubRef.current || conversations.length === 0) {
            return;
        }

        const connection = hubRef.current;
        conversations.forEach((conversation) => {
            void connection
                .invoke('JoinConversation', conversation.id)
                .catch((error) => {
                    console.error(
                        `Failed to join conversation ${conversation.id}`,
                        error
                    );
                });
        });
    }, [conversations, isHubConnected]);

    useEffect(() => {
        isMessagesAreaNearBottomRef.current = true;
    }, [selectedConversationId]);

    const selectedConversation = useMemo(
        () =>
            selectedConversationId
                ? conversations.find(
                      (conversation) => conversation.id === selectedConversationId
                  ) || null
                : null,
        [selectedConversationId, conversations]
    );

    const selectedOtherUserId = useMemo(
        () =>
            selectedConversation?.conversationParticipants.find(
                (participant) => participant.userId !== currentUserId
            )?.userId ?? null,
        [selectedConversation, currentUserId]
    );

    useEffect(() => {
        if (!selectedOtherUserId || users[selectedOtherUserId]) {
            return;
        }

        fetchUserById(selectedOtherUserId)
            .then((loadedUser) => {
                setUsers((prev) => ({
                    ...prev,
                    [selectedOtherUserId]: loadedUser,
                }));
            })
            .catch((error) => {
                console.error(
                    `Failed to load user ${selectedOtherUserId}`,
                    error
                );
            });
    }, [selectedOtherUserId, users]);

    const selectedOtherUser = selectedOtherUserId
        ? users[selectedOtherUserId] ?? null
        : null;
    const isSystemChat = Boolean(
        selectedOtherUserId &&
            systemUserId &&
            selectedOtherUserId === systemUserId
    );

    useEffect(() => {
        const messagesArea = messagesAreaRef.current;
        if (!messagesArea) {
            return;
        }

        const shouldAutoScroll =
            !isSystemChat || isMessagesAreaNearBottomRef.current;
        if (!shouldAutoScroll) {
            return;
        }

        messagesArea.scrollTop = messagesArea.scrollHeight;
        isMessagesAreaNearBottomRef.current = true;
    }, [isSystemChat, messages]);

    const handleMessagesAreaScroll = useCallback(() => {
        const messagesArea = messagesAreaRef.current;
        if (!messagesArea) {
            return;
        }

        const distanceToBottom =
            messagesArea.scrollHeight -
            messagesArea.scrollTop -
            messagesArea.clientHeight;
        isMessagesAreaNearBottomRef.current = distanceToBottom <= 80;
    }, []);

    const handleSelectConversation = (conversationId: string) => {
        setSelectedConversationId(conversationId);
        markConversationRead(conversationId);

        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('conversationId', conversationId);
            window.history.replaceState(
                window.history.state,
                '',
                `${url.pathname}?${url.searchParams.toString()}`
            );
        }
    };

    const handleBackToConversationList = () => {
        setSelectedConversationId(null);
        setMessages([]);

        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('conversationId');
            const nextQuery = url.searchParams.toString();
            const nextUrl = nextQuery
                ? `${url.pathname}?${nextQuery}`
                : url.pathname;
            window.history.replaceState(window.history.state, '', nextUrl);
        }
    };

    const handleSend = async () => {
        if (!selectedConversationId) {
            return;
        }

        const normalizedText = normalizeMultiline(messageText);
        setMessageText(normalizedText);
        if (!normalizedText) {
            return;
        }

        const connection = hubRef.current;
        if (!connection) {
            return;
        }

        try {
            await connection.invoke(
                'SendMessage',
                selectedConversationId,
                normalizedText
            );
            setMessageText('');
            markConversationRead(selectedConversationId);
        } catch (error) {
            console.error(error);
        }
    };

    
    const openReviewModal = () => {
        setReviewText('');
        setReviewError('');
        setIsReviewModalOpen(true);
    };

    const closeReviewModal = (force = false) => {
        if (reviewSubmitting && !force) {
            return;
        }
        setIsReviewModalOpen(false);
        setReviewText('');
        setReviewError('');
    };

    const handleReviewSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedOtherUserId) {
            return;
        }

        const normalizedText = normalizeMultiline(reviewText);
        const validationError = validateReviewText(normalizedText);
        setReviewText(normalizedText);
        setReviewError(validationError || '');
        if (validationError) {
            return;
        }

        setReviewSubmitting(true);
        try {
            await createReview({
                revieweeId: selectedOtherUserId,
                reviewText: normalizedText,
            });
            addNotification('Отзыв успешно отправлен.', { level: 'success' });
            closeReviewModal(true);
        } catch (error) {
            setReviewError(getApiErrorMessage(error, 'Не удалось отправить отзыв.'));
        } finally {
            setReviewSubmitting(false);
        }
    };
    const isConversationOpened = Boolean(selectedConversationId);

    return (
        <div className={`container ${styles.page}`}>
            <div
                className={[
                    styles.layout,
                    isConversationOpened
                        ? styles.layoutConversationOpen
                        : styles.layoutConversationList,
                ]
                    .join(' ')
                    .trim()}
            >
                <aside
                    className={[
                        styles.sidebar,
                        isConversationOpened ? styles.sidebarHiddenMobile : '',
                    ]
                        .join(' ')
                        .trim()}
                >
                    <div className={styles.sidebarHeader}>
                        <h2 className="mb-0">{'Сообщения'}</h2>
                    </div>

                    <div className={styles.conversationList}>
                        {loadingConversations ? (
                            <div className={styles.emptyState}>
                                {'Загрузка'}
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className={styles.emptyState}>
                                {'У вас пока нет сообщений.'}
                            </div>
                        ) : (
                            conversations.map((conversation) => {
                                const otherId =
                                    conversation.conversationParticipants.find(
                                        (participant) =>
                                            participant.userId !== currentUserId
                                    )?.userId ?? null;
                                const otherUser = otherId ? users[otherId] : null;
                                const name = otherUser?.nickname || otherId || 'Пользователь';
                                const isUnread = isConversationUnread(
                                    conversation.id
                                );
                                const isSelected =
                                    selectedConversationId === conversation.id;

                                return (
                                    <button
                                        key={conversation.id}
                                        type="button"
                                        onClick={() =>
                                            handleSelectConversation(conversation.id)
                                        }
                                        className={[
                                            'btn',
                                            'btn-sm',
                                            'btn-primary',
                                            styles.conversationItem,
                                            isSelected
                                                ? styles.conversationItemActive
                                                : '',
                                            isUnread ? styles.conversationItemUnread : '',
                                        ]
                                            .join(' ')
                                            .trim()}
                                    >
                                        <span className={styles.conversationMain}>
                                            <span
                                                className={[
                                                    styles.unreadDot,
                                                    isUnread
                                                        ? styles.unreadDotVisible
                                                        : styles.unreadDotHidden,
                                                ]
                                                    .join(' ')
                                                    .trim()}
                                                aria-hidden="true"
                                            />
                                            <span className={styles.conversationName}>
                                                {name}
                                            </span>
                                        </span>
                                        <span className={styles.conversationTime}>
                                            {formatDate(
                                                conversation.lastUpdatedAt
                                            )}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </aside>

                <section
                    className={[
                        styles.chatPanel,
                        !isConversationOpened ? styles.chatPanelHiddenMobile : '',
                    ]
                        .join(' ')
                        .trim()}
                >
                    {!selectedConversation ? (
                        <div className={styles.placeholder}>
                            {'Выберите чат для обсуждения'}
                        </div>
                    ) : (
                        <>
                            <div className={styles.chatHeader}>
                                <div className={styles.chatHeaderMain}>
                                    <Button
                                        variant="outline-secondary"
                                        size="sm"
                                        className={styles.mobileBackButton}
                                        onClick={handleBackToConversationList}
                                    >
                                        {'Назад'}
                                    </Button>
                                    {selectedOtherUser ? (
                                        isSystemChat ? (
                                            <span className={styles.chatAdmin}>
                                                {selectedOtherUser.nickname}
                                            </span>
                                        ) : (
                                            <Link
                                                href={`/user/${selectedOtherUser.id}`}
                                                className={styles.chatUserLink}
                                            >
                                                {selectedOtherUser.nickname}
                                            </Link>
                                        )
                                    ) : (
                                        <span className={styles.chatUserLoading}>
                                            {'Загрузка'}
                                        </span>
                                    )}
                                </div>

                                {selectedOtherUser && !isSystemChat && (
                                    <Button
                                        variant="outline-primary"
                                        size="sm"
                                        onClick={openReviewModal}
                                    >
                                        {'Оставить отзыв'}
                                    </Button>
                                )}
                            </div>

                            <div
                                className={styles.messagesArea}
                                ref={messagesAreaRef}
                                onScroll={handleMessagesAreaScroll}
                            >
                                {loadingMessages ? (
                                    <div className={styles.emptyState}>
                                        {'Загрузка'}
                                    </div>
                                ) : (
                                    messages.map((message) => {
                                        const isOwn =
                                            message.senderId === currentUserId;

                                        return (
                                            <div
                                                key={message.id}
                                                className={[
                                                    styles.messageRow,
                                                    isOwn
                                                        ? styles.messageRowOwn
                                                        : styles.messageRowOther,
                                                ]
                                                    .join(' ')
                                                    .trim()}
                                            >
                                                <div
                                                    className={[
                                                        styles.messageBubble,
                                                        isOwn
                                                            ? styles.messageBubbleOwn
                                                            : styles.messageBubbleOther,
                                                    ]
                                                        .join(' ')
                                                        .trim()}
                                                >
                                                    <div className={styles.messageText}>
                                                        {renderMessageContent(
                                                            message.content,
                                                            isOwn
                                                                ? styles.messageLinkOwn
                                                                : styles.messageLinkOther
                                                        )}
                                                    </div>
                                                    <div className={styles.messageTime}>
                                                        {new Date(
                                                            message.createdAt
                                                        ).toLocaleTimeString(
                                                            'ru-RU',
                                                            {
                                                                timeZone:
                                                                    'Europe/Moscow',
                                                            }
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className={styles.composer}>
                                <div className={styles.composerRow}>
                                    <div className={styles.inputWrap}>
                                        <textarea
                                            className={`form-control ${styles.messageInput}`}
                                            rows={1}
                                            value={messageText}
                                            onChange={(event) => {
                                                setMessageText(event.target.value);
                                            }}
                                            placeholder={
                                                isSystemChat
                                                    ? 'С чем вам нужна помощь...'
                                                    : 'Введите сообщение...'
                                            }
                                            maxLength={
                                                VALIDATION_LIMITS.messageMaxLength
                                            }
                                        />
                                    </div>

                                    <Button
                                        onClick={handleSend}
                                        disabled={!messageText.trim()}
                                        variant="primary"
                                        className={`chat-send-button ${styles.sendButton}`}
                                        aria-label="Отправить"
                                        title="Отправить"
                                    >
                                        <span aria-hidden="true">➤</span>
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </section>
            </div>
            <Modal
                show={isReviewModalOpen}
                onHide={() => closeReviewModal()}
                centered
                backdropClassName="review-modal-backdrop"
            >
                <Modal.Header closeButton={!reviewSubmitting}>
                    <Modal.Title>Оставьте отзыв</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <form onSubmit={handleReviewSubmit}>
                        <div className="mb-3">
                            <textarea
                                className={`form-control ${
                                    reviewError ? 'is-invalid' : ''
                                }`}
                                rows={5}
                                placeholder="Напишите ваш отзыв..."
                                value={reviewText}
                                onChange={(event) => {
                                    setReviewText(event.target.value);
                                    setReviewError('');
                                }}
                                onBlur={() => {
                                    const normalized =
                                        normalizeMultiline(reviewText);
                                    setReviewText(normalized);
                                    setReviewError(
                                        validateReviewText(normalized) || ''
                                    );
                                }}
                                minLength={VALIDATION_LIMITS.reviewMinLength}
                                maxLength={VALIDATION_LIMITS.reviewMaxLength}
                                aria-invalid={Boolean(reviewError)}
                                disabled={reviewSubmitting}
                                required
                            />
                            <div className="invalid-feedback d-block field-error-slot">
                                {reviewError || '\u00A0'}
                            </div>
                        </div>
                        <div className="d-flex justify-content-end">
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={reviewSubmitting}
                            >
                                {reviewSubmitting
                                    ? 'Отправка...'
                                    : 'Отправить отзыв'}
                            </button>
                        </div>
                    </form>
                </Modal.Body>
            </Modal>
        </div>
    );
}

export default function InboxPage() {
    return (
        <RequireAuth>
            <InboxContent />
        </RequireAuth>
    );
}

