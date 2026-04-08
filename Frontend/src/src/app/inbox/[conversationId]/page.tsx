'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HubConnection, HubConnectionBuilder } from '@microsoft/signalr';
import Button from 'react-bootstrap/Button';
import { Message } from '@/types/api/messages';
import { User } from '@/types/api/users';
import { Order, OrderStatus } from '@/types/api/orders';
import {
    fetchConversationById,
    fetchMessagesByConversationId,
} from '@/services/conversationService';
import { fetchOrderByConversation } from '@/services/orderService';
import { fetchUserById } from '@/services/userService';
import { useAuth } from '@/context/AuthContext';
import { useMessageNotifications } from '@/context/MessageNotificationContext';
import {
    getApiErrorMessage,
    normalizeMultiline,
    validateMessageText,
    VALIDATION_LIMITS,
} from '@/utils/validation';

export default function ConversationPage({
    params,
}: {
    params: { conversationId: string };
}) {
    const { conversationId } = params;
    const router = useRouter();
    const { user } = useAuth();
    const { markConversationRead } = useMessageNotifications();
    const currentUserId = user?.id ?? null;

    const [messages, setMessages] = useState<Message[]>([]);
    const [messageText, setMessageText] = useState('');
    const [messageError, setMessageError] = useState('');
    const [otherUser, setOtherUser] = useState<User | null>(null);
    const [order, setOrder] = useState<Order | null>(null);

    const hubRef = useRef<HubConnection | null>(null);
    const endRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        markConversationRead(conversationId);
    }, [conversationId, markConversationRead]);

    useEffect(() => {
        const loadMessages = async () => {
            const data = await fetchMessagesByConversationId(conversationId);
            setMessages(data);
        };
        loadMessages();
    }, [conversationId]);

    useEffect(() => {
        const loadOtherUser = async () => {
            if (!currentUserId) return;
            const conversation = await fetchConversationById(conversationId);
            const otherUserId = conversation.conversationParticipants.find(
                (participant) => participant.userId !== currentUserId
            )?.userId;

            if (!otherUserId) return;

            fetchUserById(otherUserId)
                .then((loadedUser) => setOtherUser(loadedUser))
                .catch(console.error);
        };
        loadOtherUser();
    }, [conversationId, currentUserId]);

    useEffect(() => {
        const loadOrder = async () => {
            if (!otherUser) return;
            const systemName =
                process.env.NEXT_PUBLIC_MARKETPLACE_NAME || 'BSFashion';
            if (otherUser.nickname !== systemName) {
                setOrder(null);
                return;
            }
            try {
                const loadedOrder = await fetchOrderByConversation(conversationId);
                setOrder(loadedOrder);
            } catch (error) {
                console.error('Failed to load order data', error);
            }
        };
        loadOrder();
    }, [conversationId, otherUser]);

    useEffect(() => {
        const connection = new HubConnectionBuilder()
            .withUrl(`${process.env.NEXT_PUBLIC_API_BASE_URL}/chathub`, {
                accessTokenFactory: () => localStorage.getItem('token') || '',
            })
            .withAutomaticReconnect()
            .build();

        const handleReceive = (senderId: string, message: Message) => {
            if (message.conversationId !== conversationId) return;
            setMessages((prev) => [...prev, message]);
            markConversationRead(conversationId);
        };

        connection.on('ReceiveMessage', handleReceive);
        connection
            .start()
            .then(() => connection.invoke('JoinConversation', conversationId))
            .catch(console.error);

        hubRef.current = connection;

        return () => {
            connection.off('ReceiveMessage', handleReceive);
            connection.stop().catch(console.error);
            hubRef.current = null;
        };
    }, [conversationId, markConversationRead]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        const connection = hubRef.current;
        const normalizedText = normalizeMultiline(messageText);
        const validationError = validateMessageText(normalizedText);

        setMessageText(normalizedText);
        setMessageError(validationError || '');
        if (validationError || !connection) return;

        try {
            await connection.invoke('SendMessage', conversationId, normalizedText);
            setMessageText('');
            setMessageError('');
        } catch (error) {
            console.error(error);
            setMessageError(
                getApiErrorMessage(
                    error,
                    'Не удалось отправить сообщение. Попробуйте еще раз.'
                )
            );
        }
    };

    const statusLabel = (status: OrderStatus | undefined) => {
        switch (status) {
            case OrderStatus.Cancelled:
                return 'Отменён';
            case OrderStatus.Completed:
                return 'Завершён';
            default:
                return 'Ожидает подтверждения';
        }
    };

    const canManageOrder = Boolean(
        order &&
        currentUserId &&
        order.sellerId === currentUserId
    );

    return (
        <div className="d-flex justify-content-center mt-5">
            <div
                className="d-flex flex-column border rounded shadow-sm"
                style={{ width: '100%', maxWidth: '600px', height: '80vh' }}
            >
                <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
                    {otherUser ? (
                        <>
                            <a
                                href={`/user/${otherUser.id}`}
                                className="fw-bold text-decoration-none"
                            >
                                {otherUser.nickname}
                            </a>
                            {otherUser.nickname !==
                                (process.env.NEXT_PUBLIC_MARKETPLACE_NAME ||
                                    'Архив') && (
                                <Button
                                    variant="outline-primary"
                                    size="sm"
                                    onClick={() =>
                                        router.push(`/user/${otherUser.id}/review`)
                                    }
                                >
                                    Оставить отзыв
                                </Button>
                            )}
                        </>
                    ) : (
                        <span>Загрузка...</span>
                    )}
                </div>

                {order && (
                    <div className="p-3 border-bottom">
                        <div className="fw-bold mb-1">
                            Заказ:{' '}
                            <a
                                href={`/listing/${order.listingId}`}
                                className="text-decoration-none"
                            >
                                {order.listingTitle}
                            </a>
                        </div>
                        <div className="text-muted mb-1">
                            Покупатель: {order.buyerNickname} • Статус:{' '}
                            {statusLabel(order.status)}
                        </div>
                        {canManageOrder && (
                            <div className="small text-muted">
                                Отмена заказа доступна на странице объявления.
                            </div>
                        )}
                    </div>
                )}

                <div className="flex-grow-1 overflow-auto p-3">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`d-flex mb-2 ${
                                message.senderId === currentUserId
                                    ? 'justify-content-end'
                                    : 'justify-content-start'
                            }`}
                        >
                            <div
                                className={`p-2 rounded ${
                                    message.senderId === currentUserId
                                        ? 'bg-primary text-white'
                                        : 'bg-light'
                                }`}
                                style={{ maxWidth: '75%' }}
                            >
                                {message.content}
                                <div className="text-muted small text-end">
                                    {new Date(message.createdAt).toLocaleTimeString(
                                        'ru-RU',
                                        { timeZone: 'Europe/Moscow' }
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={endRef} />
                </div>

                <div className="p-3 border-top">
                    <div className="d-flex gap-2">
                        <div className="flex-grow-1">
                            <textarea
                                className={`form-control ${
                                    messageError ? 'is-invalid' : ''
                                }`}
                                rows={2}
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                                onBlur={() => {
                                    const normalized = normalizeMultiline(messageText);
                                    setMessageText(normalized);
                                    setMessageError(
                                        validateMessageText(normalized) || ''
                                    );
                                }}
                                placeholder="Введите сообщение..."
                                maxLength={VALIDATION_LIMITS.messageMaxLength}
                                aria-invalid={Boolean(messageError)}
                            />
                            {messageError && (
                                <div className="invalid-feedback d-block">
                                    {messageError}
                                </div>
                            )}
                        </div>
                        <Button
                            onClick={handleSend}
                            disabled={!messageText.trim()}
                            variant="primary"
                        >
                            Отправить
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
