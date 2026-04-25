'use client';

import React, { useCallback } from 'react';
import { fetchAllListings, deleteListing } from '@/services/listingService';
import { Listing } from '@/types/api/listings';
import {
    ListingFilter,
    Ordering,
    OrderingDirection,
} from '@/types/api/categories';
import { useNotification } from '@/context/NotificationContext';
import { useConfirmDialog } from '@/context/ConfirmDialogContext';
import { getApiErrorMessage } from '@/utils/validation';
import { useAsyncData } from '@/sharedComponents/hooks/useAsyncData';
import AdminActionsMenu from './AdminActionsMenu';

const defaultFilter: ListingFilter = {
    priceMin: null,
    priceMax: null,
    stateOfItemIds: [],
    selectedListingPropertyValueIds: [],
    sellerId: null,
    cityId: null,
    radius: null,
    search: null,
    ordering: Ordering.CreatedAt,
    orderingDirection: OrderingDirection.Descending,
};

export default function ListingManagementSection() {
    const { addNotification } = useNotification();
    const { confirm } = useConfirmDialog();

    const notifyError = useCallback(
        (error: unknown, fallback: string) =>
            addNotification(getApiErrorMessage(error, fallback), {
                level: 'error',
                importance: 'high',
            }),
        [addNotification]
    );

    const {
        data: listings,
        setData: setListings,
        loading,
    } = useAsyncData<Listing[]>(
        () => fetchAllListings(defaultFilter, 100),
        [],
        { onError: (error) => notifyError(error, 'Не удалось загрузить объявления.') }
    );

    const handleDelete = async (id: string) => {
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
            await deleteListing(id);
            setListings((prev) => prev.filter((item) => item.id !== id));
        } catch (error) {
            notifyError(error, 'Не удалось удалить объявление.');
        }
    };

    return (
        <div className="card-admin mb-4">
            <div className="card-header">
                <h3 className="mb-0">Управление объявлениями</h3>
            </div>
            <div className="card-body">
                {loading && <div className="loading-centered">Загрузка</div>}
                {!loading && listings.length === 0 && (
                    <div className="text-muted">Объявления не найдены</div>
                )}
                {listings.length > 0 && (
                    <ul className="list-group admin-management-list">
                        {listings.map((listing) => (
                            <li
                                key={listing.id}
                                className="list-group-item admin-management-item d-flex align-items-center"
                            >
                                <span className="text-truncate flex-grow-1 me-3 admin-management-item__title">
                                    <a
                                        href={`/listing/${listing.id}`}
                                        className="fw-bold text-decoration-none"
                                        style={{
                                            display: 'inline-block',
                                            maxWidth: '100%',
                                        }}
                                    >
                                        {listing.title}
                                    </a>
                                </span>
                                <AdminActionsMenu className="flex-shrink-0 admin-management-item__actions">
                                    <button
                                        className="btn btn-danger admin-management-item__button"
                                        onClick={() => void handleDelete(listing.id)}
                                    >
                                        Удалить
                                    </button>
                                </AdminActionsMenu>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
