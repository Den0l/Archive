import React from 'react';
import { Page } from '@/types/api/page';
import { Review } from '@/types/api/reviews';
import { useAuth } from '@/context/AuthContext';
import { deleteReview } from '@/services/reviewService';

export interface ReviewListProps {
    page: Page<Review>;
    onPageChange: (pageNumber: number) => void;
}

export function ReviewList({ page, onPageChange }: ReviewListProps) {
    const { user } = useAuth();
    const isAdmin = !!user?.roles?.includes('Admin');
    const hasPagination = page.totalPages > 1;
    const isPrevDisabled = page.pageNumber <= 1 || !hasPagination;
    const isNextDisabled =
        page.pageNumber >= page.totalPages || !hasPagination;

    const handleDelete = async (id: string) => {
        if (!window.confirm('Вы уверены, что хотите удалить этот отзыв?'))
            return;
        try {
            await deleteReview(id);
            onPageChange(page.pageNumber);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Не удалось удалить отзыв');
        }
    };

    return (
        <>
            <ul className="list-group">
                {page.items.map((review) => (
                    <li
                        key={review.id}
                        className="list-group-item"
                    >
                        <div className="d-flex w-100 justify-content-between align-items-start">
                            <h5 className="mb-1">{review.reviewer.nickname}</h5>
                            <div className="d-flex align-items-center gap-2">
                                <small className="text-muted">
                                    {new Date(
                                        review.createdAt
                                    ).toLocaleString()}
                                </small>
                                {isAdmin && (
                                    <button
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() =>
                                            handleDelete(review.id)
                                        }
                                    >
                                        Удалить
                                    </button>
                                )}
                            </div>
                        </div>
                        <p className="mb-1">{review.reviewText}</p>
                    </li>
                ))}
            </ul>

            <nav aria-label="Review pagination">
                <ul className="pagination justify-content-center mt-4">
                    <li
                        className={`page-item ${isPrevDisabled ? 'disabled' : ''}`}
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
                        className={`page-item ${isNextDisabled ? 'disabled' : ''}`}
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
