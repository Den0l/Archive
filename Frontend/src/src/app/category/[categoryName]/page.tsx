'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilterPanel } from '@/sharedComponents/FilterPanel';
import { ListingGrid } from '@/sharedComponents/ListingGrid';
import { Listing } from '@/types/api/listings';
import { ListingFilter } from '@/types/api/categories';
import { Ordering, OrderingDirection } from '@/types/api/categories';
import { Page } from '@/types/api/page';
import { fetchListingsByCategoryName } from '@/services/categoryService';
import { deleteListing } from '@/services/listingService';
import { useAuth } from '@/context/AuthContext';

export default function CategoryPage({
    params,
}: {
    params: { categoryName: string };
}) {
    const router = useRouter();
    const { user: currentUser } = useAuth();
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
        pageSize: 30,
    });

    useEffect(() => {
        const fetchListings = async () => {
            try {
                const res = await fetchListingsByCategoryName(
                    categoryName,
                    filter,
                    pageNumber,
                    pageData.pageSize
                );
                setPageData(res);
            } catch (err) {
                console.error('Failed to load listings', err);
            }
        };

        fetchListings();
    }, [categoryName, filter, pageNumber, pageData.pageSize]);

    const handleDeleteListing = async (listingId: string) => {
        if (!window.confirm('Вы уверены, что хотите удалить это объявление?'))
            return;
        try {
            await deleteListing(listingId);
            const res = await fetchListingsByCategoryName(
                categoryName,
                filter,
                pageNumber,
                pageData.pageSize
            );
            setPageData(res);
        } catch (err: any) {
            alert(
                err.response?.data?.message || 'Не удалось удалить объявление'
            );
        }
    };

    return (
        <div className="main">
            <section className="content">
                <h1>
                    Объявления в категории {decodeURIComponent(categoryName)}
                </h1>

                <ListingGrid
                    page={pageData}
                    onPageChange={setPageNumber}
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
