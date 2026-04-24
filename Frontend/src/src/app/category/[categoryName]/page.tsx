'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilterPanel } from '@/sharedComponents/FilterPanel';
import { ListingGrid } from '@/sharedComponents/ListingGrid';
import { Listing } from '@/types/api/listings';
import { ListingFilter } from '@/types/api/categories';
import { Ordering, OrderingDirection } from '@/types/api/categories';
import { Page } from '@/types/api/page';
import { fetchListingsByCategoryName } from '@/services/categoryService';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';

export default function CategoryPage({
    params,
}: {
    params: { categoryName: string };
}) {
    const router = useRouter();
    const { user: currentUser } = useAuth();
    const { addNotification } = useNotification();
    const { categoryName } = params;

    const [filter, setFilter] = useState<ListingFilter>({
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
    });

    const [pageNumber, setPageNumber] = useState(1);
    const [pageData, setPageData] = useState<Page<Listing>>({
        items: [],
        totalPages: 1,
        pageNumber: 1,
        pageSize: 12,
    });

    const effectiveFilter: ListingFilter = useMemo(
        () => ({
            ...filter,
            sellerId: null,
            excludeSellerId: currentUser?.id ?? null,
        }),
        [filter, currentUser?.id]
    );

    useEffect(() => {
        const fetchListings = async () => {
            try {
                const res = await fetchListingsByCategoryName(
                    categoryName,
                    effectiveFilter,
                    pageNumber,
                    pageData.pageSize
                );
                setPageData(res);
            } catch (err) {
                console.error('Failed to load listings', err);
                addNotification('Не удалось загрузить объявления категории.', {
                    level: 'error',
                    importance: 'high',
                });
            }
        };

        fetchListings();
    }, [
        categoryName,
        effectiveFilter,
        pageNumber,
        pageData.pageSize,
        addNotification,
    ]);

    return (
        <div className="main">
            <section className="content">
                <h1>
                    Объявления в категории {decodeURIComponent(categoryName)}
                </h1>

                <ListingGrid
                    page={pageData}
                    onPageChange={setPageNumber}
                    onListingUpdated={async () => {
                        const res = await fetchListingsByCategoryName(
                            categoryName,
                            effectiveFilter,
                            pageNumber,
                            pageData.pageSize
                        );
                        setPageData(res);
                    }}
                    renderActions={
                        currentUser
                            ? (listing) =>
                                currentUser.id === listing.sellerId ? (
                                    <button
                                        className="btn btn-sm btn-outline-primary listing-action-btn"
                                        onClick={() =>
                                            router.push(`/listing/${listing.id}/edit`)
                                        }
                                    >
                                        Редактировать
                                    </button>
                                ) : null
                            : undefined
                    }
                />
            </section>

            <aside className="sidebar">
                <FilterPanel
                    categoryName={categoryName}
                    mobileCategorySelectionEnabled
                    priceEnabled
                    stateOfItemEnabled
                    listingPropertiesEnabled
                    cityEnabled
                    radiusEnabled
                    searchEnabled
                    orderingEnabled
                    onFilterSubmit={(f) => {
                        setPageNumber(1);
                        setFilter(f);
                    }}
                />
            </aside>
        </div>
    );
}
