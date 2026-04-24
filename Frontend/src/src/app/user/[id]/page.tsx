'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchUserById } from '@/services/userService';
import { createReview, fetchReviewsByReviewee } from '@/services/reviewService';
import {
    fetchAllListings,
    deleteListing,
    fetchListingStatsBatch,
} from '@/services/listingService';
import { ReviewList } from './components/ReviewList';
import { ListingGrid } from '@/sharedComponents/ListingGrid';
import { Page } from '@/types/api/page';
import { Review } from '@/types/api/reviews';
import { Listing, ListingStats } from '@/types/api/listings';
import { Modal, Tab, Tabs } from 'react-bootstrap';
import {
    ListingFilter,
    Ordering,
    OrderingDirection,
} from '@/types/api/categories';
import { User } from '@/types/api/users';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { useConfirmDialog } from '@/context/ConfirmDialogContext';
import {
    fetchSubscriptionStatus,
    subscribeToSeller,
    unsubscribeFromSeller,
} from '@/services/subscriptionService';
import {
    getApiErrorMessage,
    normalizeMultiline,
    validateReviewText,
    VALIDATION_LIMITS,
} from '@/utils/validation';
import { fetchSystemUserId } from '@/services/conversationService';

const TEXT = {
    userLoadError: 'Не удалось загрузить пользователя.',
    reviewsLoadError: 'Не удалось загрузить отзывы.',
    listingsLoadError: 'Не удалось загрузить объявления.',
    deleteConfirm: 'Вы уверены, что хотите удалить это объявление?',
    deleteError: 'Не удалось удалить объявление.',
    loadingUser: 'Загрузка',
    userNotFound: 'Пользователь не найден.',
    emailLabel: 'Почта:',
    reviewsLabel: 'Отзывы:',
    listingsLabel: 'Объявления:',
    salesLabel: 'Продажи:',
    archivedLabel: 'Архив:',
    listingsTab: 'Объявления',
    salesTab: 'Продажи',
    archivedTab: 'Архив',
    loadingListings: 'Загрузка',
    editButton: 'Редактировать',
    deleteButton: 'Удалить',
    noListings: 'Объявления отсутствуют.',
    noSales: 'Проданных объявлений пока нет.',
    noArchived: 'Архивных объявлений пока нет.',
    reviewsTab: 'Отзывы',
    leaveReviewButton: 'Оставить отзыв',
    loadingReviews: 'Загрузка',
    noReviews: 'Пока нет отзывов.',
    reviewPlaceholder: 'Напишите ваш отзыв...',
    reviewSubmit: 'Отправить отзыв',
    reviewSending: 'Отправка...',
    reviewCreateError: 'Не удалось отправить отзыв.',
    reviewCreateSuccess: 'Отзыв успешно отправлен.',
    subscribe: 'Подписаться',
    unsubscribe: 'Отписаться',
    subscribeSuccess: 'Подписка на продавца оформлена.',
    unsubscribeSuccess: 'Подписка отменена.',
    subscribeError: 'Не удалось изменить подписку.',
    subscribeAuthRequired: 'Для подписки нужно авторизоваться.',
    loadingSubscription: 'Обновляем подписку...',
} as const;

const LISTINGS_PAGE_SIZE = 8;
const REVIEWS_ROWS_PER_PAGE = 3;
const REVIEWS_DESKTOP_BREAKPOINT = 1200;
const REVIEWS_TABLET_BREAKPOINT = 769;
const REVIEWS_DESKTOP_COLUMNS = 3;
const REVIEWS_TABLET_COLUMNS = 2;
const REVIEWS_MOBILE_COLUMNS = 1;

const getReviewColumnsForWidth = (width: number): number => {
    if (width >= REVIEWS_DESKTOP_BREAKPOINT) {
        return REVIEWS_DESKTOP_COLUMNS;
    }

    if (width >= REVIEWS_TABLET_BREAKPOINT) {
        return REVIEWS_TABLET_COLUMNS;
    }

    return REVIEWS_MOBILE_COLUMNS;
};

const getReviewsPageSizeForWidth = (width: number): number => {
    return getReviewColumnsForWidth(width) * REVIEWS_ROWS_PER_PAGE;
};

const getInitialReviewsPageSize = (): number => {
    if (typeof window === 'undefined') {
        return REVIEWS_DESKTOP_COLUMNS * REVIEWS_ROWS_PER_PAGE;
    }

    return getReviewsPageSizeForWidth(window.innerWidth);
};

const createListingsPage = (
    items: Listing[],
    pageNumber: number
): Page<Listing> => {
    const totalPages = Math.max(1, Math.ceil(items.length / LISTINGS_PAGE_SIZE));
    const normalizedPageNumber = Math.min(
        Math.max(pageNumber, 1),
        totalPages
    );
    const start = (normalizedPageNumber - 1) * LISTINGS_PAGE_SIZE;

    return {
        items: items.slice(start, start + LISTINGS_PAGE_SIZE),
        totalPages,
        pageNumber: normalizedPageNumber,
        pageSize: LISTINGS_PAGE_SIZE,
    };
};

export default function UserPage({ params }: { params: { id: string } }) {
    const { id } = params;
    const router = useRouter();
    const { user: currentUser } = useAuth();
    const { addNotification } = useNotification();
    const { confirm } = useConfirmDialog();
    const isOwner = currentUser?.id === id;
    const [isSystemUser, setIsSystemUser] = useState(false);
    const [isSystemUserResolved, setIsSystemUserResolved] = useState(false);
    const canLeaveReview = !!currentUser && currentUser.id !== id && !isSystemUser;

    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<
        'listings' | 'sales' | 'archived' | 'reviews'
    >('listings');
    const [reviewsPage, setReviewsPage] = useState<Page<Review> | null>(null);
    const [allListings, setAllListings] = useState<Listing[]>([]);
    const [listingsPageNumber, setListingsPageNumber] = useState(1);
    const [salesPageNumber, setSalesPageNumber] = useState(1);
    const [archivedPageNumber, setArchivedPageNumber] = useState(1);
    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [loadingListings, setLoadingListings] = useState(true);
    const [reviewsPageSize, setReviewsPageSize] = useState(
        getInitialReviewsPageSize
    );
    const [statsMap, setStatsMap] = useState<Record<string, ListingStats>>({});
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscriptionLoading, setSubscriptionLoading] = useState(false);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [reviewText, setReviewText] = useState('');
    const [reviewError, setReviewError] = useState<string | null>(null);
    const [reviewSubmitting, setReviewSubmitting] = useState(false);

    const reportError = useCallback(
        (message: string) => {
            addNotification(message, { level: 'error', importance: 'high' });
        },
        [addNotification]
    );

    const loadUser = useCallback(async () => {
        setLoadingUser(true);
        try {
            const loadedUser = await fetchUserById(id);
            setUser(loadedUser);
        } catch (err: any) {
            reportError(getApiErrorMessage(err, TEXT.userLoadError));
        } finally {
            setLoadingUser(false);
        }
    }, [id, reportError]);

    const loadReviews = useCallback(
        async (pageNumber: number = 1) => {
            setLoadingReviews(true);
            try {
                const data = await fetchReviewsByReviewee(
                    id,
                    pageNumber,
                    reviewsPageSize
                );
                setReviewsPage(data);
            } catch (err: any) {
                reportError(getApiErrorMessage(err, TEXT.reviewsLoadError));
            } finally {
                setLoadingReviews(false);
            }
        },
        [id, reportError, reviewsPageSize]
    );

    const loadListings = useCallback(
        async () => {
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
                const data = await fetchAllListings(filter, 100);
                setAllListings(data);
                if (isOwner && data.length > 0) {
                    try {
                        const ids = data.map((l) => l.id);
                        const stats = await fetchListingStatsBatch(ids);
                        setStatsMap(stats);
                    } catch {
                        // stats are optional
                    }
                }
            } catch (err: any) {
                reportError(getApiErrorMessage(err, TEXT.listingsLoadError));
            } finally {
                setLoadingListings(false);
            }
        },
        [id, isOwner, reportError]
    );

    const activeListings = allListings.filter(
        (listing) => !listing.isSold && !listing.isArchived
    );
    const soldListings = allListings.filter((listing) => listing.isSold);
    const archivedListings = allListings.filter((listing) => listing.isArchived);
    const listingsPage = createListingsPage(activeListings, listingsPageNumber);
    const salesPage = createListingsPage(soldListings, salesPageNumber);
    const archivedPage = createListingsPage(archivedListings, archivedPageNumber);

    const handleDeleteListing = async (listingId: string) => {
        const shouldDelete = await confirm({
            title: 'Удаление объявления',
            message: TEXT.deleteConfirm,
            confirmText: TEXT.deleteButton,
            cancelText: 'Отмена',
            variant: 'danger',
        });
        if (!shouldDelete) {
            return;
        }

        try {
            await deleteListing(listingId);
            addNotification('Объявление успешно удалено.', {
                level: 'success',
            });
            setAllListings((prev) =>
                prev.filter((listing) => listing.id !== listingId)
            );
        } catch (err: any) {
            addNotification(getApiErrorMessage(err, TEXT.deleteError), { level: 'error', importance: 'high' });
        }
    };

    useEffect(() => {
        let isActive = true;
        fetchSystemUserId()
            .then((sysId) => {
                if (!isActive) return;
                const isSystemProfile = sysId === id;
                setIsSystemUser(isSystemProfile);
                if (isSystemProfile) {
                    router.replace('/inbox');
                }
            })
            .catch(() => {
                if (!isActive) return;
                setIsSystemUser(false);
            })
            .finally(() => {
                if (isActive) {
                    setIsSystemUserResolved(true);
                }
            });

        return () => {
            isActive = false;
        };
    }, [id, router]);

    useEffect(() => {
        const handleResize = () => {
            const nextPageSize = getReviewsPageSizeForWidth(window.innerWidth);
            setReviewsPageSize((prevPageSize) =>
                prevPageSize === nextPageSize ? prevPageSize : nextPageSize
            );
        };

        handleResize();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    useEffect(() => {
        if (!isSystemUserResolved || isSystemUser) {
            return;
        }

        loadUser();
        loadReviews();
    }, [isSystemUserResolved, isSystemUser, loadUser, loadReviews]);

    useEffect(() => {
        if (!isSystemUserResolved || isSystemUser) {
            return;
        }

        loadListings();
    }, [isSystemUser, isSystemUserResolved, loadListings]);

    useEffect(() => {
        setActiveTab('listings');
        setListingsPageNumber(1);
        setSalesPageNumber(1);
        setArchivedPageNumber(1);
    }, [id]);

    useEffect(() => {
        if (
            !currentUser ||
            currentUser.id === id ||
            !isSystemUserResolved ||
            isSystemUser
        ) {
            setIsSubscribed(false);
            setSubscriptionLoading(false);
            return;
        }

        let isActive = true;
        const loadSubscriptionStatus = async () => {
            setSubscriptionLoading(true);
            try {
                const status = await fetchSubscriptionStatus(id);
                if (isActive) {
                    setIsSubscribed(status.isSubscribed);
                }
            } catch (error) {
                if (isActive) {
                    reportError(
                        getApiErrorMessage(error, TEXT.subscribeError)
                    );
                }
            } finally {
                if (isActive) {
                    setSubscriptionLoading(false);
                }
            }
        };

        void loadSubscriptionStatus();

        return () => {
            isActive = false;
        };
    }, [currentUser, id, reportError, isSystemUser, isSystemUserResolved]);

    const handleSubscriptionToggle = async () => {
        if (!currentUser) {
            addNotification(TEXT.subscribeAuthRequired, {
                level: 'error',
                importance: 'high',
            });
            return;
        }

        if (currentUser.id === id) {
            return;
        }
        if (isSystemUser) {
            return;
        }

        setSubscriptionLoading(true);
        try {
            if (isSubscribed) {
                await unsubscribeFromSeller(id);
                setIsSubscribed(false);
                addNotification(TEXT.unsubscribeSuccess, {
                    level: 'success',
                });
            } else {
                await subscribeToSeller(id);
                setIsSubscribed(true);
                addNotification(TEXT.subscribeSuccess, {
                    level: 'success',
                });
            }
        } catch (error) {
            reportError(getApiErrorMessage(error, TEXT.subscribeError));
        } finally {
            setSubscriptionLoading(false);
        }
    };

    const openReviewModal = () => {
        setReviewError(null);
        setIsReviewModalOpen(true);
    };

    const closeReviewModal = (force = false) => {
        if (reviewSubmitting && !force) {
            return;
        }
        setIsReviewModalOpen(false);
        setReviewText('');
        setReviewError(null);
    };

    const handleReviewSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const normalizedReviewText = normalizeMultiline(reviewText);
        const validationError = validateReviewText(normalizedReviewText);

        setReviewText(normalizedReviewText);
        setReviewError(validationError);
        if (validationError) {
            return;
        }

        setReviewSubmitting(true);
        try {
            await createReview({
                revieweeId: id,
                reviewText: normalizedReviewText,
            });
            addNotification(TEXT.reviewCreateSuccess, { level: 'success' });
            closeReviewModal(true);
            await loadReviews(1);
        } catch (error) {
            addNotification(
                getApiErrorMessage(error, TEXT.reviewCreateError),
                { level: 'error', importance: 'high' }
            );
        } finally {
            setReviewSubmitting(false);
        }
    };

    const handleTabSelect = (key: string | null) => {
        if (key === 'orders' && isOwner) {
            router.push('/user/orders');
            return;
        }

        if (key === 'reviews') {
            setActiveTab(key);
            return;
        }

        if (!isSystemUser && (key === 'listings' || key === 'sales')) {
            setActiveTab(key);
            return;
        }

        if (isOwner && !isSystemUser && key === 'archived') {
            setActiveTab(key);
        }
    };

    if (loadingUser) {
        if (isSystemUser && isSystemUserResolved) {
            return null;
        }

        return <div className="page-loading-state">{TEXT.loadingUser}</div>;
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
            <div className="text-center mb-4">
                <h1 className="mb-0">{user.nickname}</h1>
            </div>
            <div className="text-center mb-4">
                <div className="text-muted">
                    {TEXT.emailLabel} {user.email || '-'}
                </div>
                <div className="text-muted">
                    {!isSystemUser && (
                        <>
                            {TEXT.listingsLabel} {activeListings.length} {'  '}
                        </>
                    )}
                    {TEXT.reviewsLabel} {reviewsPage?.items.length ?? 0}
                </div>
            </div>
            {!isOwner && !isSystemUser && (
                <div className="d-flex justify-content-center mb-3">
                    <button
                        type="button"
                        className={`btn ${
                            isSubscribed ? 'btn-secondary' : 'btn-dark'
                        }`}
                        style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}
                        onClick={handleSubscriptionToggle}
                        disabled={subscriptionLoading}
                    >
                        {subscriptionLoading
                            ? TEXT.loadingSubscription
                            : currentUser
                              ? isSubscribed
                                  ? TEXT.unsubscribe
                                  : TEXT.subscribe
                              : TEXT.subscribe}
                    </button>
                </div>
            )}

            <Tabs
                activeKey={activeTab}
                onSelect={handleTabSelect}
                className="mb-3 justify-content-center"
            >
                {!isSystemUser && (
                    <Tab eventKey="listings" title={TEXT.listingsTab}>
                        {loadingListings ? (
                            <div className="loading-centered loading-centered--compact">
                                {TEXT.loadingListings}
                            </div>
                        ) : (
                            listingsPage.items.length > 0 ? (
                                <ListingGrid
                                    page={listingsPage}
                                    onPageChange={setListingsPageNumber}
                                    statsMap={isOwner ? statsMap : undefined}
                                    onListingUpdated={loadListings}
                                    renderActions={
                                        isOwner
                                            ? (listing) => (
                                                  <>
                                                      {!listing.isSold && (
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
                            )
                        )}
                    </Tab>
                )}
                {!isSystemUser && (
                    <Tab eventKey="sales" title={TEXT.salesTab}>
                        {loadingListings ? (
                            <div className="loading-centered loading-centered--compact">
                                {TEXT.loadingListings}
                            </div>
                        ) : salesPage.items.length > 0 ? (
                            <ListingGrid
                                page={salesPage}
                                onPageChange={setSalesPageNumber}
                                statsMap={isOwner ? statsMap : undefined}
                                onListingUpdated={loadListings}
                            />
                        ) : (
                            <p className="text-muted text-center my-3">
                                {TEXT.noSales}
                            </p>
                        )}
                    </Tab>
                )}
                {isOwner && !isSystemUser && (
                    <Tab eventKey="archived" title={TEXT.archivedTab}>
                        {loadingListings ? (
                            <div className="loading-centered loading-centered--compact">
                                {TEXT.loadingListings}
                            </div>
                        ) : archivedPage.items.length > 0 ? (
                            <ListingGrid
                                page={archivedPage}
                                onPageChange={setArchivedPageNumber}
                                statsMap={statsMap}
                                onListingUpdated={loadListings}
                                renderActions={(listing) => (
                                    <>
                                        {!listing.isSold && (
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
                                                handleDeleteListing(listing.id)
                                            }
                                        >
                                            {TEXT.deleteButton}
                                        </button>
                                    </>
                                )}
                            />
                        ) : (
                            <p className="text-muted text-center my-3">
                                {TEXT.noArchived}
                            </p>
                        )}
                    </Tab>
                )}
                <Tab eventKey="reviews" title={TEXT.reviewsTab}>
                    {canLeaveReview && (
                        <div className="d-flex mb-3">
                            <button
                                className="btn btn-outline-primary"
                                onClick={openReviewModal}
                            >
                                {TEXT.leaveReviewButton}
                            </button>
                        </div>
                    )}
                    {loadingReviews ? (
                        <div className="loading-centered loading-centered--compact">
                            {TEXT.loadingReviews}
                        </div>
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

            <Modal
                show={isReviewModalOpen}
                onHide={closeReviewModal}
                centered
                backdropClassName="review-modal-backdrop"
            >
                <Modal.Header closeButton={!reviewSubmitting}>
                    <Modal.Title>Оставьте отзыв</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <form onSubmit={handleReviewSubmit}>
                        <div className="mb-3">
                            <textarea
                                className={`form-control ${
                                    reviewError ? 'is-invalid' : ''
                                }`}
                                rows={5}
                                placeholder={TEXT.reviewPlaceholder}
                                value={reviewText}
                                onChange={(e) => {
                                    setReviewText(e.target.value);
                                    setReviewError(null);
                                }}
                                onBlur={() => {
                                    const normalized = normalizeMultiline(
                                        reviewText
                                    );
                                    setReviewText(normalized);
                                    setReviewError(
                                        validateReviewText(normalized)
                                    );
                                }}
                                minLength={VALIDATION_LIMITS.reviewMinLength}
                                maxLength={VALIDATION_LIMITS.reviewMaxLength}
                                aria-invalid={Boolean(reviewError)}
                                required
                            />
                            <div className="invalid-feedback d-block field-error-slot">
                                {reviewError || '\u00A0'}
                            </div>
                        </div>
                        <div className="d-flex justify-content-end">
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={reviewSubmitting}
                            >
                                {reviewSubmitting
                                    ? TEXT.reviewSending
                                    : TEXT.reviewSubmit}
                            </button>
                        </div>
                    </form>
                </Modal.Body>
            </Modal>
        </div>
    );
}
