'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createReview } from '@/services/reviewService';
import {
    getApiErrorMessage,
    normalizeMultiline,
    validateReviewText,
    VALIDATION_LIMITS,
} from '@/utils/validation';

export default function ReviewPage({ params }: { params: { id: string } }) {
    const { id } = params;
    const router = useRouter();
    const [reviewText, setReviewText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const normalizedReviewText = normalizeMultiline(reviewText);
        const validationError = validateReviewText(normalizedReviewText);

        setReviewText(normalizedReviewText);
        setError(validationError);
        if (validationError) {
            return;
        }

        setIsSubmitting(true);
        try {
            await createReview({ revieweeId: id, reviewText: normalizedReviewText });
            router.push(`/user/${id}`);
        } catch (err) {
            setError(
                getApiErrorMessage(err, 'Не удалось отправить отзыв.')
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container my-5">
            <div className="row justify-content-center">
                <div className="col-12 col-md-8">
                    <h1 className="mb-4">Оставить отзыв</h1>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-3">
                            <textarea
                                className={`form-control ${
                                    error ? 'is-invalid' : ''
                                }`}
                                rows={5}
                                placeholder="Напишите ваш отзыв..."
                                value={reviewText}
                                onChange={(e) => setReviewText(e.target.value)}
                                onBlur={() => {
                                    const normalized = normalizeMultiline(
                                        reviewText
                                    );
                                    setReviewText(normalized);
                                    setError(validateReviewText(normalized));
                                }}
                                minLength={VALIDATION_LIMITS.reviewMinLength}
                                maxLength={VALIDATION_LIMITS.reviewMaxLength}
                                aria-invalid={Boolean(error)}
                                required
                            />
                        </div>
                        {error && <div className="text-danger mb-3">{error}</div>}
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting
                                ? 'Отправка...'
                                : 'Отправить отзыв'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
