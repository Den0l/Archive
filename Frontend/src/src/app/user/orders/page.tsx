'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { useConfirmDialog } from '@/context/ConfirmDialogContext';
import RequireAuth from '@/sharedComponents/RequireAuth';
import {
    cancelOrder,
    completeOrder,
    fetchMyOrdersAsBuyer,
    fetchMyOrdersAsSeller,
} from '@/services/orderService';
import { createConversation } from '@/services/conversationService';
import { Order, OrderStatus } from '@/types/api/orders';
import { getApiErrorMessage } from '@/utils/validation';

const TEXT = {
    loading: 'Загрузка',
    title: 'Мои заказы',
    buyerTab: 'Покупки',
    sellerTab: 'Продажи',
    buyerLoadError: 'Не удалось загрузить покупки.',
    sellerLoadError: 'Не удалось загрузить продажи.',
    completeSuccess: 'Заказ подтверждён.',
    cancelSuccess: 'Заказ отменён.',
    completeError: 'Не удалось подтвердить заказ.',
    cancelError: 'Не удалось отменить заказ.',
    cancelConfirm: 'Отменить этот заказ?',
    noBuyerOrders: 'У вас пока нет заказов как у покупателя.',
    noSellerOrders: 'У вас пока нет заказов как у продавца.',
    listingLink: 'Открыть объявление',
    buyerProfileLink: 'Профиль покупателя',
    sellerProfileLink: 'Профиль продавца',
    buyerChatLink: 'Переписка с продавцом',
    sellerChatLink: 'Переписка с покупателем',
    completeButton: 'Подтвердить',
    cancelButton: 'Отменить',
    pending: 'Ожидает подтверждения',
    completed: 'Подтверждён',
    cancelled: 'Отменён',
    createdAt: 'Создан',
    cancelledAt: 'Отменён',
    listing: 'Объявление',
    buyer: 'Покупатель',
    seller: 'Продавец',
    noImage: 'Без фото',
    openingChat: 'Открываем чат...',
    openChatError: 'Не удалось открыть чат. Попробуйте ещё раз.',
} as const;

type OrdersTabKey = 'buyer' | 'seller';

const resolveOrdersTabKey = (tab: string | null): OrdersTabKey => {
    if (!tab) {
        return 'buyer';
    }

    const normalizedTab = tab.trim().toLowerCase();
    if (
        normalizedTab === 'seller' ||
        normalizedTab === 'sale' ||
        normalizedTab === 'sales' ||
        normalizedTab === 'selling' ||
        normalizedTab === 'продажа' ||
        normalizedTab === 'продажи'
    ) {
        return 'seller';
    }

    return 'buyer';
};

const statusClassMap: Record<OrderStatus, string> = {
    [OrderStatus.Pending]: 'order-status-badge order-status-badge--pending',
    [OrderStatus.Completed]:
        'order-status-badge order-status-badge--completed',
    [OrderStatus.Cancelled]:
        'order-status-badge order-status-badge--cancelled',
};

const getStatusText = (status: OrderStatus) => {
    switch (status) {
        case OrderStatus.Completed:
            return TEXT.completed;
        case OrderStatus.Cancelled:
            return TEXT.cancelled;
        case OrderStatus.Pending:
        default:
            return TEXT.pending;
    }
};

const formatPrice = (value: number) =>
    new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);

const formatDate = (value: string | null) => {
    if (!value) {
        return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleString('ru-RU');
};

type OrderCardProps = {
    order: Order;
    role: OrdersTabKey;
    currentUserId: string | null;
    isActionLoading: boolean;
    chatLoadingRecipientId: string | null;
    onComplete: (orderId: string) => Promise<void>;
    onCancel: (orderId: string) => Promise<void>;
    onOpenChat: (recipientId: string) => Promise<void>;
};

function OrderCard({
    order,
    role,
    currentUserId,
    isActionLoading,
    chatLoadingRecipientId,
    onComplete,
    onCancel,
    onOpenChat,
}: OrderCardProps) {
    const imageUrl = order.listingImageUrl || '/default-image.jpg';
    const canManage = role === 'seller' && order.status === OrderStatus.Pending;
    const renderChatLink = (recipientId: string, label: string) => {
        const isLoading = chatLoadingRecipientId === recipientId;

        return (
            <a
                href={`/inbox/${order.conversationId}`}
                aria-disabled={isLoading}
                onClick={(event) => {
                    event.preventDefault();
                    if (!isLoading) {
                        void onOpenChat(recipientId);
                    }
                }}
            >
                {isLoading ? TEXT.openingChat : label}
            </a>
        );
    };

    return (
        <article className="order-card">
            <div className="order-card__image-wrap">
                {order.listingImageUrl ? (
                    <img
                        src={imageUrl}
                        alt={order.listingTitle}
                        className="order-card__image"
                    />
                ) : (
                    <div className="order-card__image-fallback">
                        {TEXT.noImage}
                    </div>
                )}
            </div>

            <div className="order-card__content">
                <div className="order-card__top">
                    <div className="order-card__headline">
                        <div className="order-card__eyebrow">
                            {TEXT.createdAt}: {formatDate(order.createdAt)}
                        </div>
                        <Link
                            href={`/listing/${order.listingId}`}
                            className="order-card__title"
                        >
                            {order.listingTitle}
                        </Link>
                        <div className="order-card__price">
                            {formatPrice(order.listingPrice)}
                        </div>
                    </div>
                    <span className={statusClassMap[order.status]}>
                        {getStatusText(order.status)}
                    </span>
                </div>

                <div className="order-card__meta">
                    <div className="order-card__meta-item">
                        <span className="order-card__meta-label">
                            {TEXT.listing}
                        </span>
                        <Link href={`/listing/${order.listingId}`}>
                            {order.listingTitle}
                        </Link>
                    </div>
                    <div className="order-card__meta-item">
                        <span className="order-card__meta-label">{TEXT.buyer}</span>
                        {currentUserId === order.buyerId ? (
                            <span>{order.buyerNickname}</span>
                        ) : (
                            renderChatLink(order.buyerId, order.buyerNickname)
                        )}
                    </div>
                    <div className="order-card__meta-item">
                        <span className="order-card__meta-label">{TEXT.seller}</span>
                        {currentUserId === order.sellerId ? (
                            <span>{order.sellerNickname}</span>
                        ) : (
                            renderChatLink(order.sellerId, order.sellerNickname)
                        )}
                    </div>
                    {order.cancelledAt && (
                        <div className="order-card__meta-item">
                            <span className="order-card__meta-label">
                                {TEXT.cancelledAt}
                            </span>
                            <span>{formatDate(order.cancelledAt)}</span>
                        </div>
                    )}
                </div>

                {canManage ? (
                    <div className="order-card__footer order-card__footer--actions-row">
                        <div className="order-card__actions order-card__actions--manage">
                            <button
                                type="button"
                                className="btn btn-outline-danger"
                                disabled={isActionLoading}
                                onClick={() => onCancel(order.id)}
                            >
                                {TEXT.cancelButton}
                            </button>
                            <button
                                type="button"
                                className="btn btn-success order-card__complete-button"
                                disabled={isActionLoading}
                                onClick={() => onComplete(order.id)}
                            >
                                {TEXT.completeButton}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </article>
    );
}

function OrdersContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading } = useAuth();
    const { addNotification } = useNotification();
    const { confirm } = useConfirmDialog();
    const [activeTab, setActiveTab] = useState<OrdersTabKey>('buyer');
    const [buyerOrders, setBuyerOrders] = useState<Order[]>([]);
    const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
    const [buyerLoading, setBuyerLoading] = useState(true);
    const [sellerLoading, setSellerLoading] = useState(true);
    const [actionOrderId, setActionOrderId] = useState<string | null>(null);
    const [chatLoadingRecipientId, setChatLoadingRecipientId] = useState<
        string | null
    >(null);

    const loadBuyerOrders = useCallback(async () => {
        setBuyerLoading(true);
        try {
            const orders = await fetchMyOrdersAsBuyer();
            setBuyerOrders(orders);
        } catch (error) {
            addNotification(
                getApiErrorMessage(error, TEXT.buyerLoadError),
                'danger'
            );
        } finally {
            setBuyerLoading(false);
        }
    }, [addNotification]);

    const loadSellerOrders = useCallback(async () => {
        setSellerLoading(true);
        try {
            const orders = await fetchMyOrdersAsSeller();
            setSellerOrders(orders);
        } catch (error) {
            addNotification(
                getApiErrorMessage(error, TEXT.sellerLoadError),
                'danger'
            );
        } finally {
            setSellerLoading(false);
        }
    }, [addNotification]);

    const reloadOrders = useCallback(async () => {
        await Promise.all([loadBuyerOrders(), loadSellerOrders()]);
    }, [loadBuyerOrders, loadSellerOrders]);

    useEffect(() => {
        setActiveTab(resolveOrdersTabKey(searchParams.get('tab')));
    }, [searchParams]);

    useEffect(() => {
        if (loading || !user) return;

        void reloadOrders();
    }, [loading, reloadOrders, user]);

    const handleComplete = useCallback(
        async (orderId: string) => {
            setActionOrderId(orderId);
            try {
                await completeOrder(orderId);
                addNotification(TEXT.completeSuccess, 'success');
                await reloadOrders();
            } catch (error) {
                addNotification(
                    getApiErrorMessage(error, TEXT.completeError),
                    'danger'
                );
            } finally {
                setActionOrderId(null);
            }
        },
        [addNotification, reloadOrders]
    );

    const handleCancel = useCallback(
        async (orderId: string) => {
            const shouldCancel = await confirm({
                title: 'Отмена заказа',
                message: TEXT.cancelConfirm,
                confirmText: TEXT.cancelButton,
                cancelText: 'Назад',
                variant: 'danger',
            });
            if (!shouldCancel) {
                return;
            }

            setActionOrderId(orderId);
            try {
                await cancelOrder(orderId);
                addNotification(TEXT.cancelSuccess, 'success');
                await reloadOrders();
            } catch (error) {
                addNotification(
                    getApiErrorMessage(error, TEXT.cancelError),
                    'danger'
                );
            } finally {
                setActionOrderId(null);
            }
        },
        [addNotification, confirm, reloadOrders]
    );

    const handleOpenChat = useCallback(
        async (recipientId: string) => {
            if (!recipientId || recipientId === user?.id) {
                return;
            }

            setChatLoadingRecipientId(recipientId);
            try {
                const conversation = await createConversation({ recipientId });
                router.push(
                    `/inbox?conversationId=${encodeURIComponent(conversation.id)}`
                );
            } catch (error) {
                addNotification(
                    getApiErrorMessage(error, TEXT.openChatError),
                    'danger'
                );
            } finally {
                setChatLoadingRecipientId(null);
            }
        },
        [addNotification, router, user?.id]
    );

    const isPageLoading = loading || (buyerLoading && sellerLoading);

    const buyerTabTitle = useMemo(
        () => `${TEXT.buyerTab} (${buyerOrders.length})`,
        [buyerOrders.length]
    );
    const sellerTabTitle = useMemo(
        () => `${TEXT.sellerTab} (${sellerOrders.length})`,
        [sellerOrders.length]
    );

    if (isPageLoading) {
        return (
            <div className="container mt-5">
                <div className="loading-centered">{TEXT.loading}</div>
            </div>
        );
    }

    return (
        <div className="container my-5 user-page orders-page">
            <div className="orders-page__header text-center">
                <h1 className="mb-2">{TEXT.title}</h1>
            </div>

            <Tabs
                activeKey={activeTab}
                onSelect={(key) => setActiveTab((key as OrdersTabKey) ?? 'buyer')}
                className="mb-3 justify-content-center"
            >
                <Tab eventKey="buyer" title={buyerTabTitle}>
                    {buyerLoading ? (
                        <div className="loading-centered">{TEXT.loading}</div>
                    ) : buyerOrders.length > 0 ? (
                        <div className="orders-list">
                            {buyerOrders.map((order) => (
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    role="buyer"
                                    currentUserId={user?.id ?? null}
                                    isActionLoading={actionOrderId === order.id}
                                    chatLoadingRecipientId={chatLoadingRecipientId}
                                    onComplete={handleComplete}
                                    onCancel={handleCancel}
                                    onOpenChat={handleOpenChat}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted text-center my-3">
                            {TEXT.noBuyerOrders}
                        </p>
                    )}
                </Tab>

                <Tab eventKey="seller" title={sellerTabTitle}>
                    {sellerLoading ? (
                        <div className="loading-centered">{TEXT.loading}</div>
                    ) : sellerOrders.length > 0 ? (
                        <div className="orders-list">
                            {sellerOrders.map((order) => (
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    role="seller"
                                    currentUserId={user?.id ?? null}
                                    isActionLoading={actionOrderId === order.id}
                                    chatLoadingRecipientId={chatLoadingRecipientId}
                                    onComplete={handleComplete}
                                    onCancel={handleCancel}
                                    onOpenChat={handleOpenChat}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted text-center my-3">
                            {TEXT.noSellerOrders}
                        </p>
                    )}
                </Tab>
            </Tabs>
        </div>
    );
}

export default function OrdersPage() {
    return (
        <RequireAuth>
            <OrdersContent />
        </RequireAuth>
    );
}
