'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ListingGrid } from '../sharedComponents/ListingGrid';
import { Page } from '@/types/api/page';
import { Listing } from '@/types/api/listings';
import { fetchListings, deleteListing, fetchListingById, updateListing } from '@/services/listingService';
import { ListingFilter } from '@/types/api/categories';
import { Ordering, OrderingDirection } from '@/types/api/categories';
import { FilterPanel } from '@/sharedComponents/FilterPanel';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
    const router = useRouter();
    const { user: currentUser } = useAuth();
    
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
        // reload on filter or page change
        const getListings = async () => {
            try {
                var res = await fetchListings(
                    filter,
                    pageNumber,
                    pageData.pageSize
                );
                setPageData(res);
            } catch (error) {
                console.error('Не удалось загрузить объявления', error);
            }
        };
        getListings();
    }, [filter, pageNumber, pageData.pageSize]);

    const handleDeleteListing = async (listingId: string) => {
        if (!window.confirm('Вы уверены, что хотите удалить это объявление?'))
            return;
        try {
            await deleteListing(listingId);
            const res = await fetchListings(
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
            <h1>Все объявления</h1>
            
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
                categoryName={null}
                priceEnabled
                stateOfItemEnabled
                listingPropertiesEnabled={false}
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
