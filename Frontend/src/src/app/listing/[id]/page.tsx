'use client';

import { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import { HubConnectionBuilder, HubConnection } from '@microsoft/signalr';
import { ListingDetail, ListingStats } from '@/types/api/listings';
import { fetchListingById, deleteListing, fetchListingStats } from '@/services/listingService';
import { createConversation } from '@/services/conversationService';
import { cancelOrder, fetchPendingOrderByListing } from '@/services/orderService';
import { useRouter } from 'next/navigation';
import styles from './ListingPage.module.css';
import { fetchUserById } from '@/services/userService';
import { User } from '@/types/api/users';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoriteContext';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { useConfirmDialog } from '@/context/ConfirmDialogContext';
import {
    getApiErrorMessage,
    normalizeMultiline,
    validateMessageText,
    VALIDATION_LIMITS,
} from '@/utils/validation';

export default function ListingPage({ params }: { params: { id: string } }) {
    const { id } = params;
    const router = useRouter();
    const { addItem, removeItem, isInCart } = useCart();
    const { addFavorite, removeFavorite, isFavorite } = useFavorites();
    const { user: currentUser } = useAuth();
    const { addNotification } = useNotification();
    const { confirm } = useConfirmDialog();
    const [listing, setListing] = useState<ListingDetail | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
        null
    );

    const [hubConnection, setHubConnection] = useState<HubConnection | null>(
        null
    );
    const [messageText, setMessageText] = useState('');
    const [messageError, setMessageError] = useState('');
    const [ownerActionPending, setOwnerActionPending] = useState(false);
    const [stats, setStats] = useState<ListingStats | null>(null);

    useEffect(() => {
        const fetchListing = async () => {
            try {
                const res = await fetchListingById(id);
                setListing(res);
                const user = await fetchUserById(res.sellerId);
                setUser(user);
                setActiveImageIndex(0);
            } catch (error) {
                console.error('Ошибка при загрузке объявления:', error);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchListing();
    }, [id]);

    useEffect(() => {
        if (!listing || !currentUser || currentUser.id !== listing.sellerId) return;
        fetchListingStats(listing.id)
            .then(setStats)
            .catch(() => {});
    }, [listing, currentUser]);

    useEffect(() => {
        let mounted = true;
        const connection = new HubConnectionBuilder()
            .withUrl(`${process.env.NEXT_PUBLIC_API_BASE_URL}/chathub`, {
                accessTokenFactory: () => localStorage.getItem('token') || '',
            })
            .withAutomaticReconnect()
            .build();

        connection.on(
            'ReceiveMessage',
            (senderId: string, message: unknown) => {
                console.log('Message received:', senderId, message);
            }
        );

        const initHub = async () => {
            try {
                await connection.start();
                if (mounted) {
                    setHubConnection(connection);
                }
            } catch (err) {
                console.error('SignalR connection error:', err);
            }
        };

        void initHub();

        return () => {
            mounted = false;
            setHubConnection(null);
            void connection.stop();
        };
    }, []);

    const handleSendMessage = async () => {
        const normalizedMessage = normalizeMultiline(messageText);
        const validationError = validateMessageText(normalizedMessage);

        setMessageText(normalizedMessage);
        setMessageError(validationError || '');
        if (validationError || !hubConnection || !listing) {
            return;
        }

        try {
            const res = await createConversation({
                recipientId: listing.sellerId,
            });
            const conversationId: string = res.id;
            await hubConnection.invoke('JoinConversation', conversationId);
            await hubConnection.invoke(
                'SendMessage',
                conversationId,
                normalizedMessage
            );
            setMessageText('');
            setMessageError('');
            router.push(`/inbox/${conversationId}`);
        } catch (error) {
            console.error('Error sending message:', error);
            setMessageError(
                getApiErrorMessage(
                    error,
                    'Не удалось отправить сообщение. Попробуйте еще раз.'
                )
            );
        }
    };

    const handleNextImage = () => {
        if (selectedImageIndex !== null && listing) {
            const nextIndex =
                (selectedImageIndex + 1) % listing.images.length;
            setSelectedImageIndex(nextIndex);
            setActiveImageIndex(nextIndex);
        }
    };

    const handlePreviousImage = () => {
        if (selectedImageIndex !== null && listing) {
            const prevIndex =
                (selectedImageIndex - 1 + listing.images.length) %
                listing.images.length;
            setSelectedImageIndex(prevIndex);
            setActiveImageIndex(prevIndex);
        }
    };

    const handleCarouselNext = () => {
        if (!listing || listing.images.length === 0) return;
        setActiveImageIndex(
            (prev) => (prev + 1) % listing.images.length
        );
    };

    const handleCarouselPrev = () => {
        if (!listing || listing.images.length === 0) return;
        setActiveImageIndex(
            (prev) =>
                (prev - 1 + listing.images.length) % listing.images.length
        );
    };

    const inCart = listing ? isInCart(listing.id) : false;
    const inFavorites = listing ? isFavorite(listing.id) : false;
    const isOwner = listing ? currentUser?.id === listing.sellerId : false;
    const isInactive = Boolean(listing?.isSold || listing?.isArchived);
    const hasDescription = Boolean(listing?.description?.trim());
    const descriptionText = hasDescription
        ? listing?.description
        : 'Описание у этого объявления отсутствует';

    const handleCartToggle = () => {
        if (!listing) return;
        if (inCart) {
            removeItem(listing.id);
            return;
        }
        if (isInactive) {
            addNotification(
                'Проданные и архивные объявления нельзя добавить в корзину.',
                { level: 'warning' }
            );
            return;
        }
        addItem({
            id: listing.id,
            title: listing.title,
            price: listing.price,
            imageUrl: listing.images[0]?.imageUrl || '/default-image.jpg',
        });
    };

    const handleFavoriteToggle = () => {
        if (!listing) return;
        if (inFavorites) {
            removeFavorite(listing.id);
            return;
        }
        if (isInactive) {
            addNotification(
                'Проданные и архивные объявления нельзя добавить в избранное.',
                { level: 'warning' }
            );
            return;
        }
        addFavorite({
            id: listing.id,
            title: listing.title,
            price: listing.price,
            imageUrl: listing.images[0]?.imageUrl || '/default-image.jpg',
            isSold: listing.isSold,
            isArchived: listing.isArchived,
        });
    };

    const handleEditListing = () => {
        if (!listing) return;
        router.push(`/listing/${listing.id}/edit`);
    };

    const handleCancelSoldOrder = async () => {
        if (!listing || !listing.isSold) return;
        const shouldCancel = await confirm({
            title: 'Отмена продажи',
            message:
                'Отменить заказ для проданного объявления и вернуть его в выдачу?',
            confirmText: 'Отменить заказ',
            cancelText: 'Назад',
            variant: 'danger',
        });
        if (!shouldCancel) {
            return;
        }

        setOwnerActionPending(true);
        try {
            const pendingOrder = await fetchPendingOrderByListing(listing.id);
            await cancelOrder(pendingOrder.id);
            const refreshedListing = await fetchListingById(listing.id);
            setListing(refreshedListing);
        } catch (error) {
            console.error('Не удалось отменить заказ по объявлению', error);
            addNotification(
                getApiErrorMessage(
                    error,
                    'Не удалось отменить заказ. Попробуйте ещё раз.'
                ),
                { level: 'error', importance: 'high' }
            );
        } finally {
            setOwnerActionPending(false);
        }
    };

    const handleDeleteListing = async () => {
        if (!listing) return;
        const shouldDelete = await confirm({
            title: 'Удаление объявления',
            message: 'Вы уверены, что хотите удалить это объявление?',
            confirmText: 'Удалить',
            cancelText: 'Отмена',
            variant: 'danger',
        });
        if (!shouldDelete) {
            return;
        }
        try {
            const deletedListing = await deleteListing(listing.id);
            const profileUserId = deletedListing.sellerId || currentUser?.id;
            addNotification('Объявление успешно удалено.', {
                level: 'success',
            });
            if (profileUserId) {
                router.push(`/user/${profileUserId}`);
            } else {
                router.push('/');
            }
        } catch (error) {
            console.error('Не удалось удалить объявление', error);
            addNotification(
                getApiErrorMessage(error, 'Не удалось удалить объявление.'),
                { level: 'error', importance: 'high' }
            );
        }
    };

    if (loading) return <div className="page-loading-state">Загрузка</div>;
    if (!listing)
        return <div className="container mt-5">Объявление не найдено</div>;

    const mainImageIndex =
        listing.images.length > 0 ? activeImageIndex : null;
    const hasMultipleImages = listing.images.length > 1;

    const renderThumbnail = (
        img: ListingDetail['images'][number],
        idx: number
    ) => (
        <button
            type="button"
            key={img.id}
            className={`${styles.thumbButton} ${
                idx === mainImageIndex ? styles.thumbActive : ''
            }`}
            onClick={() => setActiveImageIndex(idx)}
        >
            <img
                src={img.imageUrl}
                alt={`${listing.title} ${idx + 1}`}
                className={styles.thumbnail}
            />
        </button>
    );

    return (
        <div className="container-list">
            <div className={styles.productHeader}>
                <div className={styles.mediaColumn}>
                    <div className={styles.mainImageWrapper}>
                        {mainImageIndex !== null ? (
                            <>
                                <img
                                    src={listing.images[mainImageIndex].imageUrl}
                                    alt={listing.title}
                                    className={styles.mainImage}
                                    onClick={() =>
                                        setSelectedImageIndex(mainImageIndex)
                                    }
                                />
                                {hasMultipleImages && (
                                    <>
                                        <button
                                            type="button"
                                            className={`${styles.carouselNav} ${styles.carouselNavPrev}`}
                                            onClick={handleCarouselPrev}
                                            aria-label="Предыдущее фото"
                                        >
                                            ‹
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.carouselNav} ${styles.carouselNavNext}`}
                                            onClick={handleCarouselNext}
                                            aria-label="Следующее фото"
                                        >
                                            ›
                                        </button>
                                        <div
                                            className={styles.carouselCounter}
                                            aria-live="polite"
                                        >
                                            {activeImageIndex + 1} / {listing.images.length}
                                        </div>
                                    </>
                                )}
                            </>
                        ) : (
                            <div className={styles.noImage}>
                                Нет изображения
                            </div>
                        )}
                    </div>

                    {listing.images.length > 0 && (
                        <div className={styles.thumbStrip}>
                            {listing.images.map((img, idx) =>
                                renderThumbnail(img, idx)
                            )}
                        </div>
                    )}
                </div>

                <div className={styles.infoColumn}>
                    <div className={styles.titleRow}>
                        <h1 className={styles.title}>{listing.title}</h1>
                        {(listing.isArchived || listing.isSold) && (
                            <span
                                className={`${styles.statusBadge} ${
                                    listing.isArchived
                                        ? styles.statusArchived
                                        : styles.statusSold
                                }`}
                            >
                                {listing.isArchived ? 'Архив' : 'Продано'}
                            </span>
                        )}
                    </div>
                    <div className={styles.priceRow}>
                        <span className={styles.price}>₽{Math.round(listing.price)}</span>
                    </div>
                    {isOwner && stats && (
                        <div className={styles.statsRow}>
                            <span className={styles.statItem} title="Просмотры">
                                👁 {stats.viewCount}
                            </span>
                            <span className={styles.statItem} title="В избранном">
                                ❤ {stats.favoriteCount}
                            </span>
                            <span className={styles.statItem} title="В корзине">
                                🛒 {stats.cartCount}
                            </span>
                        </div>
                    )}
                    <div className={styles.cartActions}>
                        {isOwner ? (
                            <>
                                {listing.isSold ? (
                                    <Button
                                        variant="outline-danger"
                                        onClick={handleCancelSoldOrder}
                                        className={styles.cartButton}
                                        disabled={ownerActionPending}
                                    >
                                        {ownerActionPending
                                            ? 'Отмена...'
                                            : 'Отменить'}
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outline-primary"
                                        onClick={handleEditListing}
                                        className={styles.cartButton}
                                        disabled={ownerActionPending}
                                    >
                                        Изменить
                                    </Button>
                                )}
                                {!listing.isSold && (
                                    <Button
                                        variant="outline-danger"
                                        onClick={handleDeleteListing}
                                        disabled={ownerActionPending}
                                    >
                                        Удалить
                                    </Button>
                                )}
                            </>
                        ) : (
                            <>
                                <Button
                                    variant={inCart ? 'secondary' : 'primary'}
                                    onClick={handleCartToggle}
                                    className={styles.cartButton}
                                    disabled={!inCart && isInactive}
                                >
                                    {inCart
                                        ? 'Убрать из корзины'
                                        : 'Добавить в корзину'}
                                </Button>
                                <button
                                    type="button"
                                    className={`${styles.favoriteButton} ${
                                        inFavorites ? styles.favoriteActive : ''
                                    }`}
                                    onClick={handleFavoriteToggle}
                                    aria-label={
                                        inFavorites
                                            ? 'Убрать из избранного'
                                            : 'Добавить в избранное'
                                    }
                                    disabled={!inFavorites && isInactive}
                                >
                                    ❤
                                </button>
                            </>
                        )}
                    </div>

                    <div className={styles.metaGrid}>
                        <div className={styles.metaItem}>
                            <span className={styles.metaLabel}>Продавец</span>
                            <a
                                href={`/user/${listing.sellerId}`}
                                className={styles.metaLink}
                            >
                                {user?.nickname ?? listing.sellerId}
                            </a>
                        </div>
                        <div className={styles.metaItem}>
                            <span className={styles.metaLabel}>Город</span>
                            <span className={styles.metaValue}>
                                {listing.city.name}
                            </span>
                        </div>
                        <div className={styles.metaItem}>
                            <span className={styles.metaLabel}>
                                Состояние
                            </span>
                            <span className={styles.metaValue}>
                                {listing.stateOfItem.name}
                            </span>
                        </div>
                        <div className={styles.metaItem}>
                            <span className={styles.metaLabel}>Категория</span>
                            <a
                                href={`/category/${listing.category.name}`}
                                className={styles.metaLink}
                            >
                                {listing.category.name}
                            </a>
                        </div>
                    </div>

                    {!isOwner && (
                        <div className={styles.ctaBox}>
                            <div className={styles.ctaHeader}>
                                <div className={styles.ctaTitle}>
                                    Отправить продавцу
                                </div>
                                <Button
                                    onClick={handleSendMessage}
                                    disabled={!messageText.trim()}
                                    className={styles.sendButton}
                                    aria-label="Отправить сообщение"
                                >
                                    <span className={styles.sendIcon}>→</span>
                                </Button>
                            </div>
                            <div className={styles.messageForm}>
                                <textarea
                                    rows={3}
                                    className={`form-control ${
                                        messageError ? 'is-invalid' : ''
                                    }`}
                                    value={messageText}
                                    onChange={(e) => {
                                        setMessageText(e.target.value);
                                        setMessageError('');
                                    }}
                                    onBlur={() => {
                                        const normalized =
                                            normalizeMultiline(messageText);
                                        setMessageText(normalized);
                                        setMessageError(
                                            validateMessageText(normalized) || ''
                                        );
                                    }}
                                    placeholder="Напишите сообщение..."
                                    maxLength={VALIDATION_LIMITS.messageMaxLength}
                                    aria-invalid={Boolean(messageError)}
                                />
                                <div className="invalid-feedback d-block field-error-slot">
                                    {messageError || '\u00A0'}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* modal for images */}
            <Modal
                show={selectedImageIndex !== null}
                onHide={() => setSelectedImageIndex(null)}
                centered
            >
                <Modal.Header closeButton />
                <Modal.Body>
                    {selectedImageIndex !== null && (
                        <div className="d-flex flex-column align-items-center">
                            <img
                                src={
                                    listing.images[selectedImageIndex].imageUrl
                                }
                                alt="Full size"
                                className="img-fluid"
                            />
                            <div className="mt-3 d-flex justify-content-center gap-2 w-100 flex-wrap">
                                <Button onClick={handlePreviousImage}>
                                    Предыдущее
                                </Button>
                                <Button onClick={handleNextImage}>Следующее</Button>
                            </div>
                        </div>
                    )}
                </Modal.Body>
            </Modal>

            <div className={styles.detailsSection}>
                {listing.selectedListingPropertyValues.length > 0 && (
                    <div className={styles.detailsBlock}>
                        <h3 className={styles.sectionTitle}>
                            Характеристики
                        </h3>
                        <ul className={styles.propertiesList}>
                            {listing.selectedListingPropertyValues.map(
                                (value) => (
                                    <li
                                        key={value.id}
                                        className={styles.propertyItem}
                                    >
                                        <span className={styles.propertyLabel}>
                                            {value.listingProperty.name}
                                        </span>
                                        <span className={styles.propertyValue}>
                                            {value.name}
                                        </span>
                                    </li>
                                )
                            )}
                        </ul>
                    </div>
                )}

                <div className={styles.detailsBlock}>
                    <h3 className={styles.sectionTitle}>Описание</h3>
                    <p
                        className={`${styles.sectionText} ${
                            hasDescription ? '' : styles.emptyDescriptionText
                        }`}
                    >
                        {descriptionText}
                    </p>
                </div>
            </div>
        </div>
    );
}
