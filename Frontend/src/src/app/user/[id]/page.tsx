'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchUserById } from '@/services/userService';
import { fetchReviewsByReviewee } from '@/services/reviewService';
import { fetchListings, deleteListing } from '@/services/listingService';
import {
    cancelOrder,
    fetchPendingOrderByListing,
} from '@/services/orderService';
import { ReviewList } from './components/ReviewList';
import { ListingGrid } from '@/sharedComponents/ListingGrid';
import { Page } from '@/types/api/page';
import { Review } from '@/types/api/reviews';
import { Listing } from '@/types/api/listings';
import { Tab, Tabs } from 'react-bootstrap';
import {
    ListingFilter,
    Ordering,
    OrderingDirection,
} from '@/types/api/categories';
import { User } from '@/types/api/users';
import { useAuth } from '@/context/AuthContext';

const TEXT = {
    userLoadError:
        '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f.',
    reviewsLoadError:
        '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043e\u0442\u0437\u044b\u0432\u044b.',
    listingsLoadError:
        '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u044f.',
    deleteConfirm:
        '\u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b, \u0447\u0442\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u044d\u0442\u043e \u043e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u0435?',
    deleteError:
        '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u043e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u0435',
    cancelOrderConfirm:
        '\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437 \u043f\u043e \u044d\u0442\u043e\u043c\u0443 \u043f\u0440\u043e\u0434\u0430\u043d\u043d\u043e\u043c\u0443 \u043e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u044e \u0438 \u0432\u0435\u0440\u043d\u0443\u0442\u044c \u0435\u0433\u043e \u0432 \u0432\u044b\u0434\u0430\u0447\u0443?',
    cancelOrderError:
        '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437',
    loadingUser:
        '\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f...',
    userNotFound:
        '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d.',
    emailLabel: '\u041f\u043e\u0447\u0442\u0430:',
    reviewsLabel: '\u041e\u0442\u0437\u044b\u0432\u044b:',
    listingsLabel: '\u041e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u044f:',
    listingsTab: '\u041e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u044f',
    loadingListings:
        '\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u043e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u044f...',
    cancelButton: '\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c',
    editButton: '\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c',
    deleteButton: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c',
    noListings:
        '\u041e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u044f \u043e\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044e\u0442.',
    reviewsTab: '\u041e\u0442\u0437\u044b\u0432\u044b',
    leaveReviewButton:
        '\u041e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u043e\u0442\u0437\u044b\u0432',
    loadingReviews:
        '\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u043e\u0442\u0437\u044b\u0432\u044b...',
    noReviews:
        '\u041d\u0435\u0442 \u0435\u0449\u0451 \u043e\u0442\u0437\u044b\u0432\u043e\u0432.',
} as const;

export default function UserPage({ params }: { params: { id: string } }) {
    const { id } = params;
    const router = useRouter();
    const { user: currentUser } = useAuth();
    const isOwner = currentUser?.id === id;
    const canLeaveReview = !!currentUser && currentUser.id !== id;

    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<'listings' | 'reviews'>(
        'listings'
    );
    const [reviewsPage, setReviewsPage] = useState<Page<Review> | null>(null);
    const [listingsPage, setListingsPage] = useState<Page<Listing> | null>(
        null
    );
    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [loadingListings, setLoadingListings] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadUser = async () => {
        setLoadingUser(true);
        try {
            const loadedUser = await fetchUserById(id);
            setUser(loadedUser);
        } catch (err: any) {
            setError(err.message || TEXT.userLoadError);
        } finally {
            setLoadingUser(false);
        }
    };

    const loadReviews = async (pageNumber: number = 1) => {
        setLoadingReviews(true);
        try {
            const data = await fetchReviewsByReviewee(id, pageNumber);
            setReviewsPage(data);
        } catch (err: any) {
            setError(err.message || TEXT.reviewsLoadError);
        } finally {
            setLoadingReviews(false);
        }
    };

    const loadListings = async (pageNumber: number = 1) => {
        setLoadingListings(true);
        try {
            const filter: ListingFilter = {
                priceMin: null,
                priceMax: null,
                stateOfItemIds: [],
                selectedListingPropertyValueIds: [],
                sellerId: id,
                cityId: null,
                radius: null,
                search: null,
                ordering: Ordering.CreatedAt,
                orderingDirection: OrderingDirection.Descending,
                includeSold: true,
                includeArchived: true,
            };
            const data = await fetchListings(filter, pageNumber);
            setListingsPage(data);
        } catch (err: any) {
            setError(err.message || TEXT.listingsLoadError);
        } finally {
            setLoadingListings(false);
        }
    };

    const handleDeleteListing = async (listingId: string) => {
        if (!window.confirm(TEXT.deleteConfirm)) {
            return;
        }

        try {
            await deleteListing(listingId);
            if (listingsPage) {
                await loadListings(listingsPage.pageNumber);
            }
        } catch (err: any) {
            alert(err.response?.data?.message || TEXT.deleteError);
        }
    };

    const handleCancelOrderForListing = async (listingId: string) => {
        if (!window.confirm(TEXT.cancelOrderConfirm)) {
            return;
        }

        try {
            const pendingOrder = await fetchPendingOrderByListing(listingId);
            await cancelOrder(pendingOrder.id);
            if (listingsPage) {
                await loadListings(listingsPage.pageNumber);
            }
        } catch (err: any) {
            alert(err.response?.data?.message || TEXT.cancelOrderError);
        }
    };

    useEffect(() => {
        loadUser();
        loadReviews();
        loadListings();
    }, [id]);

    if (loadingUser) {
        return (
            <div
                className="d-flex justify-content-center align-items-center"
                style={{ minHeight: '100vh' }}
            >
                <p style={{ fontSize: '1.25rem' }}>{TEXT.loadingUser}</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div
                className="d-flex justify-content-center align-items-center"
                style={{ minHeight: '100vh' }}
            >
                <p className="text-danger" style={{ fontSize: '1.25rem' }}>
                    {TEXT.userNotFound}
                </p>
            </div>
        );
    }

    return (
        <div className="container my-5 user-page">
            <h1 className="mb-4">{user.nickname}</h1>
            <div className="text-center mb-4">
                <div className="text-muted">
                    {TEXT.emailLabel} {user.email || '-'}
                </div>
                <div className="text-muted">
                    {TEXT.reviewsLabel} {reviewsPage?.items.length ?? 0} |{' '}
                    {TEXT.listingsLabel} {listingsPage?.items.length ?? 0}
                </div>
            </div>

            <Tabs
                activeKey={activeTab}
                onSelect={(k) => setActiveTab(k as 'reviews' | 'listings')}
                className="mb-3 justify-content-center"
            >
                <Tab eventKey="listings" title={TEXT.listingsTab}>
                    {error && <p className="text-danger">{error}</p>}
                    {loadingListings ? (
                        <p>{TEXT.loadingListings}</p>
                    ) : (
                        listingsPage &&
                        (listingsPage.items.length > 0 ? (
                            <ListingGrid
                                page={listingsPage}
                                onPageChange={loadListings}
                                renderActions={
                                    isOwner
                                        ? (listing) => (
                                              <>
                                                  {listing.isSold ? (
                                                      <button
                                                          className="btn btn-sm btn-outline-danger listing-action-btn"
                                                          onClick={() =>
                                                              handleCancelOrderForListing(
                                                                  listing.id
                                                              )
                                                          }
                                                      >
                                                          {TEXT.cancelButton}
                                                      </button>
                                                  ) : (
                                                      <button
                                                          className="btn btn-sm btn-outline-primary listing-action-btn"
                                                          onClick={() =>
                                                              router.push(
                                                                  `/listing/${listing.id}/edit`
                                                              )
                                                          }
                                                      >
                                                          {TEXT.editButton}
                                                      </button>
                                                  )}
                                                  <button
                                                      className="btn btn-sm btn-outline-danger listing-action-btn"
                                                      onClick={() =>
                                                          handleDeleteListing(
                                                              listing.id
                                                          )
                                                      }
                                                  >
                                                      {TEXT.deleteButton}
                                                  </button>
                                              </>
                                          )
                                        : undefined
                                }
                            />
                        ) : (
                            <p className="text-muted text-center my-3">
                                {TEXT.noListings}
                            </p>
                        ))
                    )}
                </Tab>
                <Tab eventKey="reviews" title={TEXT.reviewsTab}>
                    {canLeaveReview && (
                        <div className="d-flex justify-content-end mb-3">
                            <button
                                className="btn btn-outline-primary"
                                onClick={() => router.push(`/user/${id}/review`)}
                            >
                                {TEXT.leaveReviewButton}
                            </button>
                        </div>
                    )}
                    {error && <p className="text-danger">{error}</p>}
                    {loadingReviews ? (
                        <p>{TEXT.loadingReviews}</p>
                    ) : (
                        reviewsPage &&
                        (reviewsPage.items.length > 0 ? (
                            <ReviewList
                                page={reviewsPage}
                                onPageChange={loadReviews}
                            />
                        ) : (
                            <p className="text-muted text-center my-3">
                                {TEXT.noReviews}
                            </p>
                        ))
                    )}
                </Tab>
            </Tabs>
        </div>
    );
}
