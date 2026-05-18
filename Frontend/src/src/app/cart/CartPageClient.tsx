'use client';

import Link from 'next/link';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoriteContext';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { confirmCheckout } from '@/services/checkoutService';
import { fetchListingById } from '@/services/listingService';
import { fetchUserSettings } from '@/services/settingsService';
import { getApiErrorMessage } from '@/utils/validation';
import { resolveApiAssetUrl } from '@/utils/assetUrl';
import styles from './CartPage.module.css';

export type CartTab = 'cart' | 'favorites';
const EMAIL_CONFIRMATION_REQUIRED_ERROR = 'EMAIL_CONFIRMATION_REQUIRED';
type CartListingStatus = {
    isSold: boolean;
    isArchived: boolean;
};

export default function CartPageClient({ activeTab }: { activeTab: CartTab }) {
    const {
        items,
        addItem,
        removeItem,
        clearCart,
        isInCart,
    } = useCart();
    const { items: favoriteItems, removeFavorite } = useFavorites();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const [checkoutStatus, setCheckoutStatus] = useState<
        'idle' | 'sending' | 'success' | 'error'
    >('idle');
    const [checkoutMessage, setCheckoutMessage] = useState<ReactNode>(null);
    const [cartListingStatusById, setCartListingStatusById] = useState<
        Record<string, CartListingStatus>
    >({});
    const [cartStatusLoading, setCartStatusLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const listingIds = Array.from(new Set(items.map((item) => item.id)));

        if (listingIds.length === 0) {
            setCartListingStatusById({});
            setCartStatusLoading(false);
            return;
        }

        setCartStatusLoading(true);
        void (async () => {
            const statusEntries = await Promise.all(
                listingIds.map(async (listingId) => {
                    try {
                        const listing = await fetchListingById(listingId);
                        return [
                            listingId,
                            {
                                isSold: listing.isSold,
                                isArchived: listing.isArchived,
                            },
                        ] as const;
                    } catch {
                        return [
                            listingId,
                            {
                                isSold: false,
                                isArchived: false,
                            },
                        ] as const;
                    }
                })
            );

            if (cancelled) return;
            setCartListingStatusById(Object.fromEntries(statusEntries));
            setCartStatusLoading(false);
        })().catch(() => {
            if (cancelled) return;
            setCartStatusLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [items]);

    const cartItemsWithStatus = useMemo(
        () =>
            items.map((item) => {
                const status = cartListingStatusById[item.id];
                return {
                    ...item,
                    isSold: status?.isSold ?? false,
                    isArchived: status?.isArchived ?? false,
                };
            }),
        [cartListingStatusById, items]
    );

    const purchasableCartItems = useMemo(
        () =>
            cartItemsWithStatus.filter(
                (item) => !item.isSold && !item.isArchived
            ),
        [cartItemsWithStatus]
    );

    const purchasableTotalItems = useMemo(
        () =>
            purchasableCartItems.reduce(
                (sum, item) => sum + item.quantity,
                0
            ),
        [purchasableCartItems]
    );

    const purchasableTotalPrice = useMemo(
        () =>
            purchasableCartItems.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0
            ),
        [purchasableCartItems]
    );

    const showEmailConfirmationRequired = () => {
        const notificationMessage =
            'Перед оформлением заказа подтвердите e-mail в настройках профиля.';

        setCheckoutStatus('error');
        setCheckoutMessage(
            <>
                Перед оформлением заказа подтвердите e-mail в{' '}
                <Link href="/user/settings" className={styles.noticeLink}>
                    настройках профиля
                </Link>
                .
            </>
        );
        addNotification(notificationMessage, {
            level: 'warning',
            importance: 'high',
        });
    };

    const handleCheckout = async () => {
        if (!user) {
            setCheckoutStatus('error');
            setCheckoutMessage('Войдите в аккаунт, чтобы получить чек на почту.');
            return;
        }
        if (items.length === 0 || purchasableCartItems.length === 0) return;

        setCheckoutStatus('sending');
        setCheckoutMessage(null);

        try {
            const settings = await fetchUserSettings();
            if (!settings.emailConfirmed) {
                showEmailConfirmationRequired();
                return;
            }

            const result = await confirmCheckout({
                items: purchasableCartItems.map((item) => ({
                    listingId: item.id,
                    title: item.title,
                    price: item.price,
                    quantity: item.quantity,
                })),
                totalItems: purchasableTotalItems,
                totalPrice: purchasableTotalPrice,
            });
            clearCart();
            setCheckoutStatus('success');
            if (result.receiptEmailSent) {
                setCheckoutMessage(
                    'Чек отправлен на вашу почту. Корзина очищена.'
                );
            } else {
                setCheckoutMessage(
                    'Заказ оформлен, корзина очищена. Не удалось отправить чек на почту — проверьте папку «Спам» или попробуйте позже связаться с поддержкой.'
                );
                addNotification(
                    'Заказ оформлен, но чек на почту не отправлен.',
                    { level: 'warning', importance: 'high' }
                );
            }
        } catch (error) {
            console.error('Failed to send receipt', error);

            const apiMessage = getApiErrorMessage(
                error,
                'Не удалось отправить чек. Попробуйте позже.'
            );
            if (apiMessage === EMAIL_CONFIRMATION_REQUIRED_ERROR) {
                showEmailConfirmationRequired();
                return;
            }

            setCheckoutStatus('error');
            setCheckoutMessage(apiMessage);
        }
    };

    const renderCart = () => {
        if (items.length === 0) {
            return (
                <div className={styles.emptyState}>
                    <p className={styles.emptyText}>Корзина пуста</p>
                    <Link href="/" className="btn btn-primary">
                        Перейти к объявлениям
                    </Link>
                </div>
            );
        }

        return (
            <div className={`${styles.cartLayout} ${styles.cartLayoutWithSummary}`}>
                <div className={styles.itemsColumn}>
                    {cartItemsWithStatus.map((item) => (
                        <div
                            key={item.id}
                            className={`${styles.cartItem} ${
                                item.isSold || item.isArchived
                                    ? styles.cartItemInactive
                                    : ''
                            }`}
                        >
                            {item.isSold && (
                                <div className={styles.soldRibbon}>Продано</div>
                            )}
                            {!item.isSold && item.isArchived && (
                                <div className={styles.soldRibbon}>Архив</div>
                            )}
                            <Link
                                href={`/listing/${item.id}`}
                                className={styles.itemImage}
                            >
                                <img
                                    src={resolveApiAssetUrl(item.imageUrl)}
                                    alt={item.title}
                                />
                            </Link>
                            <div className={styles.itemInfo}>
                                <Link
                                    href={`/listing/${item.id}`}
                                    className={styles.itemTitle}
                                >
                                    {item.title}
                                </Link>
                                <div className={styles.itemMeta}>
                                    <span>Цена:</span>
                                    <span>₽{Math.round(item.price)}</span>
                                </div>
                            </div>
                            <div className={styles.itemActions}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => removeItem(item.id)}
                                >
                                    Удалить
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <aside className={styles.summaryColumn}>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryRow}>
                            <span>Товары</span>
                            <span>{purchasableTotalItems}</span>
                        </div>
                        <div className={styles.summaryRow}>
                            <span>Итого</span>
                            <span>₽{Math.round(purchasableTotalPrice)}</span>
                        </div>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleCheckout}
                            disabled={
                                purchasableTotalItems === 0 ||
                                cartStatusLoading ||
                                checkoutStatus === 'sending'
                            }
                        >
                            {checkoutStatus === 'sending'
                                ? 'Отправляем чек...'
                                : 'Оформить заказ'}
                        </button>
                    </div>
                    {checkoutMessage && (
                        <div
                            className={`${styles.notice} ${
                                checkoutStatus === 'success'
                                    ? styles.noticeSuccess
                                    : styles.noticeError
                            }`}
                        >
                            {checkoutMessage}
                        </div>
                    )}
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={clearCart}
                    >
                        Очистить корзину
                    </button>
                </aside>
            </div>
        );
    };

    const renderFavorites = () => {
        if (favoriteItems.length === 0) {
            return (
                <div className={styles.emptyState}>
                    <p className={styles.emptyText}>Избранное пусто</p>
                    <Link href="/" className="btn btn-primary">
                        Перейти к объявлениям
                    </Link>
                </div>
            );
        }

        return (
            <div className={styles.cartLayout}>
                <div className={styles.itemsColumn}>
                    {favoriteItems.map((item) => (
                        <div
                            key={item.id}
                            className={`${styles.cartItem} ${
                                item.isSold || item.isArchived
                                    ? styles.cartItemInactive
                                    : ''
                            }`}
                        >
                            {item.isSold && (
                                <div className={styles.soldRibbon}>Продано</div>
                            )}
                            {!item.isSold && item.isArchived && (
                                <div className={styles.soldRibbon}>Архив</div>
                            )}
                            <Link
                                href={`/listing/${item.id}`}
                                className={styles.itemImage}
                            >
                                <img
                                    src={resolveApiAssetUrl(item.imageUrl)}
                                    alt={item.title}
                                />
                            </Link>
                            <div className={styles.itemInfo}>
                                <Link
                                    href={`/listing/${item.id}`}
                                    className={styles.itemTitle}
                                >
                                    {item.title}
                                </Link>
                                <div className={styles.itemMeta}>
                                    <span>Цена:</span>
                                    <span>₽{Math.round(item.price)}</span>
                                </div>
                            </div>
                            <div className={styles.itemActions}>
                                {(() => {
                                    const canAddToCart =
                                        !item.isSold && !item.isArchived;
                                    const inCart = isInCart(item.id);
                                    const isCartButtonDisabled =
                                        item.isSold || item.isArchived;
                                    return (
                                        <button
                                            type="button"
                                            className={`btn ${
                                                inCart
                                                    ? 'btn-secondary'
                                                    : 'btn-primary'
                                            }`}
                                            onClick={() => {
                                                if (inCart) {
                                                    removeItem(item.id);
                                                    return;
                                                }
                                                if (!canAddToCart) {
                                                    addNotification(
                                                        'Проданные и архивные объявления нельзя добавить в корзину.',
                                                        {
                                                            level: 'warning',
                                                        }
                                                    );
                                                    return;
                                                }
                                                addItem({
                                                    id: item.id,
                                                    title: item.title,
                                                    price: item.price,
                                                    imageUrl: resolveApiAssetUrl(
                                                        item.imageUrl
                                                    ),
                                                });
                                            }}
                                            disabled={isCartButtonDisabled}
                                        >
                                            {inCart ? 'В корзине' : 'В корзину'}
                                        </button>
                                    );
                                })()}
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={() => removeFavorite(item.id)}
                                >
                                    Удалить
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className={styles.cartPage}>
            <h1 className={styles.title}>
                {activeTab === 'cart' ? 'Корзина' : 'Избранное'}
            </h1>

            {activeTab === 'cart' ? renderCart() : renderFavorites()}
        </div>
    );
}
