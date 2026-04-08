'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoriteContext';
import { useAuth } from '@/context/AuthContext';
import { confirmCheckout } from '@/services/checkoutService';
import styles from './CartPage.module.css';

export type CartTab = 'cart' | 'favorites';

export default function CartPageClient({ activeTab }: { activeTab: CartTab }) {
    const { items, totalItems, totalPrice, removeItem, clearCart } = useCart();
    const { items: favoriteItems, removeFavorite } = useFavorites();
    const { user } = useAuth();
    const [checkoutStatus, setCheckoutStatus] = useState<
        'idle' | 'sending' | 'success' | 'error'
    >('idle');
    const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

    const handleCheckout = async () => {
        if (!user) {
            setCheckoutStatus('error');
            setCheckoutMessage('Войдите в аккаунт, чтобы получить чек на почту.');
            return;
        }
        if (items.length === 0) return;

        setCheckoutStatus('sending');
        setCheckoutMessage(null);

        try {
            await confirmCheckout({
                items: items.map((item) => ({
                    listingId: item.id,
                    title: item.title,
                    price: item.price,
                    quantity: item.quantity,
                })),
                totalItems,
                totalPrice,
            });
            clearCart();
            setCheckoutStatus('success');
            setCheckoutMessage('Чек отправлен на вашу почту. Корзина очищена.');
        } catch (error) {
            console.error('Failed to send receipt', error);
            setCheckoutStatus('error');
            setCheckoutMessage('Не удалось отправить чек. Попробуйте позже.');
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
            <div className={styles.cartLayout}>
                <div className={styles.itemsColumn}>
                    {items.map((item) => (
                        <div key={item.id} className={styles.cartItem}>
                            <Link
                                href={`/listing/${item.id}`}
                                className={styles.itemImage}
                            >
                                <img src={item.imageUrl} alt={item.title} />
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
                                    <span>₽{item.price.toFixed(2)}</span>
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
                            <span>{totalItems}</span>
                        </div>
                        <div className={styles.summaryRow}>
                            <span>Итого</span>
                            <span>₽{totalPrice.toFixed(2)}</span>
                        </div>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleCheckout}
                            disabled={
                                items.length === 0 ||
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
                        <div key={item.id} className={styles.cartItem}>
                            {item.isSold && (
                                <div className={styles.soldRibbon}>Продано</div>
                            )}
                            <Link
                                href={`/listing/${item.id}`}
                                className={styles.itemImage}
                            >
                                <img src={item.imageUrl} alt={item.title} />
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
                                    <span>₽{item.price.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className={styles.itemActions}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
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
