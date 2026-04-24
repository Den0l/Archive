'use client';

import { useEffect, useState, useMemo } from 'react';
import { ListingGrid } from '../sharedComponents/ListingGrid';
import { Page } from '@/types/api/page';
import { Listing } from '@/types/api/listings';
import { fetchListings, deleteListing } from '@/services/listingService';
import { ListingFilter } from '@/types/api/categories';
import { Ordering, OrderingDirection } from '@/types/api/categories';
import { FilterPanel } from '@/sharedComponents/FilterPanel';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { useConfirmDialog } from '@/context/ConfirmDialogContext';
import { getApiErrorMessage } from '@/utils/validation';

export default function Home() {
    const { user: currentUser } = useAuth();
    const { addNotification } = useNotification();
    const { confirm } = useConfirmDialog();
    
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

    const effectiveFilter: ListingFilter = useMemo(() => ({
        ...filter,
        excludeSellerId: currentUser?.id ?? null,
    }), [filter, currentUser?.id]);

    useEffect(() => {
        // reload on filter or page change
        const getListings = async () => {
            try {
                var res = await fetchListings(
                    effectiveFilter,
                    pageNumber,
                    pageData.pageSize
                );
                setPageData(res);
            } catch (error) {
                console.error('Не удалось загрузить объявления', error);
                addNotification('Не удалось загрузить объявления.', {
                    level: 'error',
                    importance: 'high',
                });
            }
        };
        getListings();
    }, [effectiveFilter, pageNumber, pageData.pageSize, addNotification]);

    const handleDeleteListing = async (listingId: string) => {
        const shouldDelete = await confirm({
            title: 'Удаление объявления',
            message: 'Вы уверены, что хотите удалить это объявление?',
            confirmText: 'Удалить',
            cancelText: 'Отмена',
            variant: 'danger',
        });
        if (!shouldDelete)
            return;
        try {
            await deleteListing(listingId);
            const res = await fetchListings(
                effectiveFilter,
                pageNumber,
                pageData.pageSize
            );
            setPageData(res);
        } catch (err: any) {
            addNotification(
                getApiErrorMessage(err, 'Не удалось удалить объявление.'),
                { level: 'error', importance: 'high' }
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
                onListingUpdated={async () => {
                    const res = await fetchListings(
                        effectiveFilter,
                        pageNumber,
                        pageData.pageSize
                    );
                    setPageData(res);
                }}
            />
            </section>
            <aside className="sidebar">
            <FilterPanel
                categoryName={null}
                mobileCategorySelectionEnabled
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
