import { deleteVoid, getData, postData } from './httpClient';
import { CreateReviewRequest, Review } from '@/types/api/reviews';
import { Page } from '@/types/api/page';

export const fetchReviewsByReviewee = async (
    revieweeId: string,
    pageNumber = 1,
    pageSize = 20
): Promise<Page<Review>> => {
    return getData<Page<Review>>(
        `/api/Reviews/byReviewee/${revieweeId}`,
        { params: { pageNumber, pageSize } }
    );
};

export const createReview = async (
    payload: CreateReviewRequest
): Promise<Review> => {
    return postData<Review, CreateReviewRequest>('/api/Reviews', payload);
};

export const deleteReview = async (id: string): Promise<void> => {
    await deleteVoid(`/api/Reviews/${id}`);
};
