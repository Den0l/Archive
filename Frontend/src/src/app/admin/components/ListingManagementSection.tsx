'use client';

import React, { useEffect, useState } from 'react';
import { fetchAllListings, deleteListing } from '@/services/listingService';
import { Listing } from '@/types/api/listings';
import {
    ListingFilter,
    Ordering,
    OrderingDirection,
} from '@/types/api/categories';

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
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const loadListings = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAllListings(defaultFilter, 100);
            setListings(data);
        } catch (err: any) {
            setError(
                err.response?.data?.message ||
                    'Не удалось загрузить объявления'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadListings();
    }, []);

    const handleDelete = async (id: string) => {
        if (!window.confirm('Вы уверены, что хотите удалить это объявление?'))
            return;
        try {
            await deleteListing(id);
            setListings((prev) => prev.filter((item) => item.id !== id));
        } catch (err: any) {
            alert(err.response?.data?.message || 'Не удалось удалить объявление');
        }
    };

    return (
        <div className="card-admin mb-4">
            <div className="card-header">
                <h3 className="mb-0">Управление объявлениями</h3>
            </div>
            <div className="card-body">
                {loading && <div className="mb-3">Загрузка...</div>}
                {error && <div className="text-danger mb-3">{error}</div>}
                {!loading && listings.length === 0 && (
                    <div className="text-muted">Объявления не найдены</div>
                )}
                {listings.length > 0 && (
                    <ul className="list-group">
                        {listings.map((listing) => (
                            <li
                                key={listing.id}
                                className="list-group-item d-flex align-items-center"
                            >
                                <span className="text-truncate flex-grow-1 me-3">
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
                                <div className="flex-shrink-0">
                                    <button
                                        className="btn btn-danger"
                                        onClick={() =>
                                            handleDelete(listing.id)
                                        }
                                    >
                                        Удалить
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
