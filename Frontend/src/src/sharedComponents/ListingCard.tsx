'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Listing, ListingStats } from '@/types/api/listings';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoriteContext';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { updateListingArchive } from '@/services/listingService';
import {
    cancelOrder,
    fetchPendingOrderByListing,
} from '@/services/orderService';
import { getApiErrorMessage } from '@/utils/validation';

interface ListingCardProps {
    listing: Listing;
    stats?: ListingStats;
    renderActions?: (listing: Listing) => React.ReactNode;
    onListingUpdated?: () => void | Promise<void>;
}

export function ListingCard({ listing, stats, renderActions, onListingUpdated }: ListingCardProps) {
    const router = useRouter();
    const { addItem, removeItem, isInCart } = useCart();
    const { addFavorite, removeFavorite, isFavorite } = useFavorites();
    const { user: currentUser } = useAuth();
    const { addNotification } = useNotification();
    const imageUrl = listing.images[0]?.imageUrl || '/default-image.jpg';
    const createdDate = new Date(listing.createdAt);
    const formattedDate = createdDate.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const inCart = isInCart(listing.id);
    const inFavorites = isFavorite(listing.id);
    const isSold = listing.isSold;
    const [isArchived, setIsArchived] = useState(listing.isArchived);
    const [ownerActionPending, setOwnerActionPending] = useState(false);
    const isOwner = currentUser?.id === listing.sellerId;
    const isInactive = isArchived || isSold;

    useEffect(() => {
        setIsArchived(listing.isArchived);
    }, [listing.isArchived]);

    const handleOpenListing = () => {
        router.push(`/listing/${listing.id}`);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleOpenListing();
        }
    };

    const handleCartClick = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        event.stopPropagation();
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
            imageUrl,
        });
    };

    const handleFavoriteClick = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        event.stopPropagation();
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
            imageUrl,
            isSold: listing.isSold,
            isArchived: listing.isArchived,
        });
    };

    const handleToggleArchive = async (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        event.stopPropagation();
        if (ownerActionPending) {
            return;
        }

        const nextIsArchived = !isArchived;
        setOwnerActionPending(true);
        try {
            const updatedListing = await updateListingArchive(listing.id, {
                isArchived: nextIsArchived,
            });
            setIsArchived(updatedListing.isArchived);
            await onListingUpdated?.();
            router.refresh();
        } catch (error) {
            console.error('Не удалось изменить статус архива', error);
            addNotification(
                getApiErrorMessage(error, 'Не удалось изменить статус архива.'),
                { level: 'error', importance: 'high' }
            );
        } finally {
            setOwnerActionPending(false);
        }
    };

    const handleCancelSale = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (ownerActionPending || !isSold) {
            return;
        }

        setOwnerActionPending(true);
        try {
            const pendingOrder = await fetchPendingOrderByListing(listing.id);
            await cancelOrder(pendingOrder.id);
            addNotification('Продажа отменена.', {
                level: 'success',
            });
            await onListingUpdated?.();
            router.refresh();
        } catch (error) {
            console.error('Не удалось отменить продажу', error);
            addNotification(
                getApiErrorMessage(error, 'Не удалось отменить продажу.'),
                { level: 'error', importance: 'high' }
            );
        } finally {
            setOwnerActionPending(false);
        }
    };

    return (
        <div
            className={`card-product listing-card h-100 ${
                isInactive ? 'listing-card--inactive' : ''
            }`}
            role="link"
            tabIndex={0}
            onClick={handleOpenListing}
            onKeyDown={handleKeyDown}
        >
            {isArchived && <div className="archived-ribbon">Архив</div>}
            {!isArchived && isSold && (
                <div className="sold-ribbon">Продано</div>
            )}
            <div className="card-img-wrapper">
                <img
                    src={imageUrl}
                    alt={listing.title}
                />
            </div>
            <div className="card-body d-flex flex-column">
                <h5 className="card-title">{listing.title}</h5>
                <small className="mb-2">
                    Опубликовано {formattedDate}
                </small>
                <p className="card-text price-text">
                    ₽{Math.round(listing.price)}
                </p>
                {isOwner && stats && (
                    <div className="listing-card-stats">
                        <span title="Просмотры">👁 {stats.viewCount}</span>
                        <span title="В избранном">❤ {stats.favoriteCount}</span>
                        <span title="В корзине">🛒 {stats.cartCount}</span>
                    </div>
                )}
                <div className="listing-card-cta">
                    {!isOwner && !isSold && (
                        <>
                            <button
                                type="button"
                                className={`btn btn-sm ${
                                    inCart ? 'btn-secondary' : 'btn-primary'
                                } cart-button`}
                                onClick={handleCartClick}
                                disabled={!inCart && isInactive}
                            >
                                {inCart ? 'В корзине' : 'В корзину'}
                            </button>
                            <button
                                type="button"
                                className={`listing-card-favorite ${
                                    inFavorites ? 'favorite-active' : ''
                                }`}
                                onClick={handleFavoriteClick}
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
                    {isOwner && (
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary listing-action-btn"
                            onClick={isSold ? handleCancelSale : handleToggleArchive}
                            disabled={ownerActionPending}
                        >
                            {ownerActionPending
                                ? isSold
                                    ? 'Отмена...'
                                    : 'Сохранение...'
                                : isSold
                                  ? 'Отменить'
                                  : isArchived
                                    ? 'Разархивировать'
                                    : 'В архив'}
                        </button>
                    )}
                </div>
                {renderActions && (
                    <div
                        className="listing-card-actions"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                    >
                        {renderActions(listing)}
                    </div>
                )}
            </div>
        </div>
    );
}
