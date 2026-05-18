import React from 'react';
import { Page } from '@/types/api/page';
import { Review } from '@/types/api/reviews';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { useConfirmDialog } from '@/context/ConfirmDialogContext';
import { deleteReview } from '@/services/reviewService';
import { getApiErrorMessage } from '@/utils/validation';

export interface ReviewListProps {
    page: Page<Review>;
    onPageChange: (pageNumber: number) => void;
}

export function ReviewList({ page, onPageChange }: ReviewListProps) {
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { confirm } = useConfirmDialog();
    const isAdmin = !!user?.roles?.includes('Admin');
    const hasPagination = page.totalPages > 1;
    const isPrevDisabled = page.pageNumber <= 1 || !hasPagination;
    const isNextDisabled =
        page.pageNumber >= page.totalPages || !hasPagination;

    const handleDelete = async (id: string) => {
        const shouldDelete = await confirm({
            title: 'Удаление отзыва',
            message: 'Вы уверены, что хотите удалить этот отзыв?',
            confirmText: 'Удалить',
            cancelText: 'Отмена',
            variant: 'danger',
        });
        if (!shouldDelete)
            return;
        try {
            await deleteReview(id);
            onPageChange(page.pageNumber);
        } catch (err: any) {
            addNotification(
                getApiErrorMessage(err, 'Не удалось удалить отзыв.'),
                { level: 'error', importance: 'high' }
            );
        }
    };

    return (
        <div className="review-list-layout">
            <ul className="review-list">
                {page.items.map((review) => (
                    <li
                        key={review.id}
                        className="review-list__item"
                    >
                        <div className="review-list__header">
                            <h5 className="review-list__author mb-1">
                                {review.reviewer.nickname}
                            </h5>
                            <div className="review-list__meta d-flex align-items-center gap-2">
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
                        <p className="review-list__text mb-0">
                            {review.reviewText}
                        </p>
                    </li>
                ))}
            </ul>

            <nav
                className="review-list-layout__pagination"
                aria-label="Review pagination"
            >
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
        </div>
    );
}
