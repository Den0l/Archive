import React from 'react';
import { ListingCard } from './ListingCard';
import { Page } from '@/types/api/page';
import { Listing, ListingStats } from '@/types/api/listings';

interface ListingGridProps {
    page: Page<Listing>;
    onPageChange: (pageNumber: number) => void;
    renderActions?: (listing: Listing) => React.ReactNode;
    statsMap?: Record<string, ListingStats>;
    onListingUpdated?: () => void | Promise<void>;
}

export function ListingGrid({
    page,
    onPageChange,
    renderActions,
    statsMap,
    onListingUpdated,
}: ListingGridProps) {
    const hasPagination = page.totalPages > 1;
    const isPrevDisabled = page.pageNumber <= 1 || !hasPagination;
    const isNextDisabled =
        page.pageNumber >= page.totalPages || !hasPagination;

    return (
        <>
            <div className="listing-grid">
                {page.items.map((listing) => (
                    <ListingCard
                        key={listing.id}
                        listing={listing}
                        stats={statsMap?.[listing.id]}
                        renderActions={renderActions}
                        onListingUpdated={onListingUpdated}
                    />
                ))}
            </div>

            <nav className="pagination-wrapper">
                <ul className="pagination">
                    <li
                        className={`page-item ${
                            isPrevDisabled ? 'disabled' : ''
                        }`}
                    >
                        <button
                            className="page-link"
                            onClick={() => {
                                if (isPrevDisabled) return;
                                onPageChange(Math.max(page.pageNumber - 1, 1));
                            }}
                        >
                            Предыдущая
                        </button>
                    </li>

                    <li className="page-item disabled">
                        <span className="page-link">
                            {page.pageNumber} / {Math.max(page.totalPages, 1)}
                        </span>
                    </li>

                    <li
                        className={`page-item ${
                            isNextDisabled ? 'disabled' : ''
                        }`}
                    >
                        <button
                            className="page-link"
                            onClick={() => {
                                if (isNextDisabled) return;
                                onPageChange(
                                    Math.min(
                                        page.pageNumber + 1,
                                        page.totalPages
                                    )
                                );
                            }}
                        >
                            Следующая
                        </button>
                    </li>
                </ul>
            </nav>
        </>
    );
}
