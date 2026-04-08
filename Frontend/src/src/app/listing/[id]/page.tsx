'use client';

import { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import { HubConnectionBuilder, HubConnection } from '@microsoft/signalr';
import { ListingDetail } from '@/types/api/listings';
import { fetchListingById, deleteListing } from '@/services/listingService';
import { createConversation } from '@/services/conversationService';
import { cancelOrder, fetchPendingOrderByListing } from '@/services/orderService';
import { useRouter } from 'next/navigation';
import styles from './ListingPage.module.css';
import { fetchUserById } from '@/services/userService';
import { User } from '@/types/api/users';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoriteContext';
import { useAuth } from '@/context/AuthContext';
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
        const initHub = async () => {
            const connection = new HubConnectionBuilder()
                .withUrl(`${process.env.NEXT_PUBLIC_API_BASE_URL}/chathub`, {
                    accessTokenFactory: () =>
                        localStorage.getItem('token') || '',
                })
                .withAutomaticReconnect()
                .build();

            connection.on(
                'ReceiveMessage',
                (senderId: string, message: any) => {
                    console.log('Message received:', senderId, message);
                }
            );

            try {
                await connection.start();
                setHubConnection(connection);
            } catch (err) {
                console.error('SignalR ошибка подключения:', err);
            }
        };

        initHub();
        return () => {
            hubConnection?.stop();
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

    const inCart = listing ? isInCart(listing.id) : false;
    const inFavorites = listing ? isFavorite(listing.id) : false;
    const isOwner = listing ? currentUser?.id === listing.sellerId : false;

    const handleCartToggle = () => {
        if (!listing) return;
        if (inCart) {
            removeItem(listing.id);
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
        addFavorite({
            id: listing.id,
            title: listing.title,
            price: listing.price,
            imageUrl: listing.images[0]?.imageUrl || '/default-image.jpg',
            isSold: listing.isSold,
        });
    };

    const handleEditListing = () => {
        if (!listing) return;
        router.push(`/listing/${listing.id}/edit`);
    };

    const handleCancelSoldOrder = async () => {
        if (!listing || !listing.isSold) return;
        if (
            !window.confirm(
                'Отменить заказ для проданного объявления и вернуть его в выдачу?'
            )
        ) {
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
            window.alert(
                getApiErrorMessage(
                    error,
                    'Не удалось отменить заказ. Попробуйте ещё раз.'
                )
            );
        } finally {
            setOwnerActionPending(false);
        }
    };

    const handleDeleteListing = async () => {
        if (!listing) return;
        if (!window.confirm('Вы уверены, что хотите удалить это объявление?')) {
            return;
        }
        try {
            await deleteListing(listing.id);
            if (currentUser?.id) {
                router.push(`/user/${currentUser.id}`);
            } else {
                router.push('/');
            }
        } catch (error) {
            console.error('Не удалось удалить объявление', error);
        }
    };

    if (loading) return <div className="container mt-5">Загрузка...</div>;
    if (!listing)
        return <div className="container mt-5">Объявление не найдено</div>;

    const mainImageIndex =
        listing.images.length > 0 ? activeImageIndex : null;

    return (
        <div className="container-list">
            <div className={styles.productHeader}>
                <div className={styles.mediaColumn}>
                    <div className={styles.mainImageWrapper}>
                        {mainImageIndex !== null ? (
                            <img
                                src={listing.images[mainImageIndex].imageUrl}
                                alt={listing.title}
                                className={styles.mainImage}
                                onClick={() =>
                                    setSelectedImageIndex(mainImageIndex)
                                }
                            />
                        ) : (
                            <div className={styles.noImage}>
                                Нет изображения
                            </div>
                        )}
                    </div>

                    {listing.images.length > 1 && (
                        <div className={styles.thumbRow}>
                            {listing.images.map((img, idx) => (
                                <button
                                    type="button"
                                    key={img.id}
                                    className={`${styles.thumbButton} ${
                                        idx === mainImageIndex
                                            ? styles.thumbActive
                                            : ''
                                    }`}
                                    onClick={() => setActiveImageIndex(idx)}
                                >
                                    <img
                                        src={img.imageUrl}
                                        alt={`${listing.title} ${idx + 1}`}
                                        className={styles.thumbnail}
                                    />
                                </button>
                            ))}
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
                        <span className={styles.price}>₽{listing.price}</span>
                    </div>
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
                                <Button
                                    variant="outline-danger"
                                    onClick={handleDeleteListing}
                                    disabled={ownerActionPending}
                                >
                                    Удалить
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant={inCart ? 'secondary' : 'primary'}
                                    onClick={handleCartToggle}
                                    className={styles.cartButton}
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

                    <div className={styles.ctaBox}>
                        <div className={styles.ctaTitle}>
                            Свяжитесь с продавцом
                        </div>
                            <div className={styles.messageForm}>
                                <textarea
                                    rows={3}
                                    className={`form-control ${
                                        messageError ? 'is-invalid' : ''
                                    }`}
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
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
                                {messageError && (
                                    <div className="invalid-feedback d-block">
                                        {messageError}
                                    </div>
                                )}
                                <div className={styles.messageActions}>
                                    <Button
                                        onClick={handleSendMessage}
                                        disabled={!messageText.trim()}
                                        className="me-2"
                                    >
                                        Отправить
                                    </Button>
                                </div>
                            </div>
                    </div>
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
                            <div className="mt-3 d-flex justify-content-between w-100">
                                <Button onClick={handlePreviousImage}>
                                    Предыдущее
                                </Button>
                                <Button onClick={handleNextImage}>Следующее</Button>
                            </div>
                        </div>
                    )}
                </Modal.Body>
            </Modal>

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

            <div className={styles.detailsSection}>
                <div className={styles.detailsBlock}>
                    <h3 className={styles.sectionTitle}>Описание</h3>
                    <p className={styles.sectionText}>{listing.description}</p>
                </div>

                
            </div>
        </div>
    );
}
