'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Listing } from '@/types/api/listings';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoriteContext';
import { useAuth } from '@/context/AuthContext';
import { deleteListing, fetchListingById, updateListing } from '@/services/listingService';

interface ListingCardProps {
    listing: Listing;
    renderActions?: (listing: Listing) => React.ReactNode;
    onListingUpdated?: () => void;
}

export function ListingCard({ listing, renderActions, onListingUpdated }: ListingCardProps) {
    const router = useRouter();
    const { addItem, removeItem, isInCart } = useCart();
    const { addFavorite, removeFavorite, isFavorite } = useFavorites();
    const { user: currentUser } = useAuth();
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
    const isArchived = listing.isArchived;
    const isOwner = currentUser?.id === listing.sellerId;

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
        addFavorite({
            id: listing.id,
            title: listing.title,
            price: listing.price,
            imageUrl,
            isSold: listing.isSold,
        });
    };

    const handleDeleteClick = async (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        event.stopPropagation();
        if (!window.confirm('Вы уверены, что хотите удалить это объявление?')) {
            return;
        }
        try {
            await deleteListing(listing.id);
            router.refresh();
        } catch (error) {
            console.error('Не удалось удалить объявление', error);
        }
    };

    const handleToggleArchive = async (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        event.stopPropagation();
        try {
            const full = await fetchListingById(listing.id);
            await updateListing(listing.id, {
                title: full.title,
                description: full.description,
                price: full.price,
                stateOfItemId: full.stateOfItem.id,
                categoryId: full.category.id,
                cityId: full.city.id,
                propertyValueSelection:
                    full.selectedListingPropertyValues?.map((value) => ({
                        listingPropertyId: value.listingProperty.id,
                        selectedListingPropertyValueId: value.id,
                    })) ?? [],
                isSold: full.isSold,
                isArchived: !full.isArchived,
            });
            if (onListingUpdated) {
                onListingUpdated();
            }
            router.refresh();
        } catch (error) {
            console.error('Не удалось изменить статус архива', error);
        }
    };

    return (
        <div
            className="card-product listing-card h-100"
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
                <p className="card-text description-clamp flex-grow-1">
                    {listing.description}
                </p>
                <p className="card-text price-text">
                    ₽{listing.price.toFixed(2)}
                </p>
                <div className="listing-card-cta">
                    {!isOwner && (
                        <>
                            <button
                                type="button"
                                className={`btn btn-sm ${
                                    inCart ? 'btn-secondary' : 'btn-primary'
                                } cart-button`}
                                onClick={handleCartClick}
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
                            >
                                ❤
                            </button>
                        </>
                    )}
                    {isOwner && (
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={handleToggleArchive}
                        >
                            {isArchived ? 'Разархивировать' : 'В архив'}
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
