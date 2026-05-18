'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/context/NotificationContext';
import { City } from '@/types/api/cities';
import { CategoryDetail } from '@/types/api/categories';
import { ListingPropertyDetail } from '@/types/api/listingProperties';
import { StateOfItem } from '@/types/api/stateOfItem';
import { Image } from '@/types/api/images';
import { ListingDetail, UpdateListingRequest } from '@/types/api/listings';
import {
    aiAutofillListing,
    fetchListingById,
    updateListing,
} from '@/services/listingService';
import { fetchStatesOfItem } from '@/services/stateOfItemService';
import {
    removeBackgroundFromFile,
    removeBackgroundFromImageId,
} from '@/services/backgroundRemovalService';
import {
    fetchCategoryHierarchy,
    fetchCategoryById,
} from '@/services/categoryService';
import { deleteImage, uploadImage } from '@/services/imageService';
import CitySelector from '@/sharedComponents/CitySelector';
import CustomDropdown from '@/sharedComponents/CustomDropdown';
import SearchableDropdown from '@/sharedComponents/SearchableDropdown';
import EditablePhotoCard from '@/sharedComponents/EditablePhotoCard';
import {
    IMAGE_UPLOAD_ACCEPT,
    formatPriceInput,
    getApiErrorMessage,
    normalizeMultiline,
    normalizeSingleLine,
    parsePriceInput,
    sanitizePriceInput,
    validateImageFiles,
    validateListingDescription,
    validateListingTitle,
    validatePrice,
    validateRequiredSelection,
    VALIDATION_LIMITS,
} from '@/utils/validation';
import {
    CategoryDropdownOption,
    flattenCategoryHierarchy,
} from '@/utils/categoryOptions';
import { resizeImageFilesIfNeeded } from '@/utils/imageResizing';
import { resolveApiAssetUrl } from '@/utils/assetUrl';
import RequireAuth from '@/sharedComponents/RequireAuth';

type EditListingFieldErrors = {
    title?: string;
    price?: string;
    description?: string;
    city?: string;
    stateOfItem?: string;
    category?: string;
    properties?: string;
    photos?: string;
};

type EditableExistingImage = Image & {
    previewUrl?: string;
    replacementFile?: File;
};

const AI_TOOLTIP_TEXT =
    'Если по фото нельзя определить размер, материал, комплектность и другие детали, напишите это в описании перед запуском AI — он использует этот текст и не потеряет эти данные.';

function EditListingContent({
    params,
}: {
    params: { id: string };
}) {
    const { id } = params;
    const [listing, setListing] = useState<ListingDetail | null>(null);
    const [categories, setCategories] = useState<CategoryDropdownOption[]>([]);
    const [statesOfItems, setStatesOfItems] = useState<StateOfItem[]>([]);
    const [selectedStateOfItemId, setSelectedStateOfItemId] =
        useState<string>('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
    const [listingProperties, setListingProperties] = useState<
        ListingPropertyDetail[]
    >([]);
    const [selectedPropertyValues, setSelectedPropertyValues] = useState<{
        [propertyId: string]: string;
    }>({});
    const [title, setTitle] = useState('');
    const [priceInput, setPriceInput] = useState('');
    const [description, setDescription] = useState('');
    const [city, setCity] = useState<City | null>(null);
    const [photos, setPhotos] = useState<File[]>([]);
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
    const [existingImages, setExistingImages] = useState<EditableExistingImage[]>(
        []
    );
    const [removedImageIds, setRemovedImageIds] = useState<Set<string>>(
        new Set()
    );
    const [fieldErrors, setFieldErrors] = useState<EditListingFieldErrors>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [aiAutofilling, setAiAutofilling] = useState(false);
    const [showAiTooltip, setShowAiTooltip] = useState(false);
    const [aiTooltipPosition, setAiTooltipPosition] = useState({
        x: 0,
        y: 0,
    });
    const [processingExistingImageIds, setProcessingExistingImageIds] =
        useState<Set<string>>(new Set());
    const [processingNewPhotos, setProcessingNewPhotos] = useState<Set<File>>(
        new Set()
    );
    const [isExistingGridExpanded, setIsExistingGridExpanded] = useState(false);
    const [isNewGridExpanded, setIsNewGridExpanded] = useState(false);
    const existingPreviewUrlsRef = useRef<string[]>([]);
    const router = useRouter();
    const { addNotification } = useNotification();

    useEffect(() => {
        let isMounted = true;

        const fetchListing = async () => {
            try {
                const [listingResponse, states, fetchedCategories] =
                    await Promise.all([
                        fetchListingById(id),
                        fetchStatesOfItem(),
                        fetchCategoryHierarchy(),
                    ]);

                if (!isMounted) {
                    return;
                }

                setListing(listingResponse);
                setStatesOfItems(states);
                setCategories(flattenCategoryHierarchy(fetchedCategories));
                setTitle(listingResponse.title);
                setDescription(listingResponse.description);
                setPriceInput(formatPriceInput(listingResponse.price));
                setCity(listingResponse.city);
                setSelectedStateOfItemId(listingResponse.stateOfItem.id);
                setSelectedCategoryId(listingResponse.category.id);
                setExistingImages(
                    (listingResponse.images ?? []).map((image) => ({
                        ...image,
                    }))
                );

                const initialSelection: { [propertyId: string]: string } = {};
                listingResponse.selectedListingPropertyValues?.forEach(
                    (value) => {
                        initialSelection[value.listingProperty.id] = value.id;
                    }
                );
                setSelectedPropertyValues(initialSelection);

                const category: CategoryDetail = await fetchCategoryById(
                    listingResponse.category.id
                );
                if (isMounted) {
                    setListingProperties(
                        category.listingProperties.filter(
                            (prop) => prop.listingPropertyValues.length > 0
                        )
                    );
                }
            } catch (error) {
                console.error('Failed to load listing data', error);
                if (isMounted) {
                    addNotification(
                        getApiErrorMessage(
                            error,
                            'Не удалось загрузить данные объявления.'
                        ),
                        { level: 'error', importance: 'high' }
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchListing();

        return () => {
            isMounted = false;
        };
    }, [id, addNotification]);

    useEffect(() => {
        if (photos.length === 0) {
            setPhotoPreviews([]);
            return;
        }

        const nextPreviews = photos.map((file) => URL.createObjectURL(file));
        setPhotoPreviews(nextPreviews);

        return () => {
            nextPreviews.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [photos]);

    useEffect(() => {
        existingPreviewUrlsRef.current = existingImages
            .map((image) => image.previewUrl)
            .filter((previewUrl): previewUrl is string => Boolean(previewUrl));
    }, [existingImages]);

    useEffect(() => {
        return () => {
            existingPreviewUrlsRef.current.forEach((previewUrl) =>
                URL.revokeObjectURL(previewUrl)
            );
        };
    }, []);

    const loadCategoryDetails = async (
        categoryId: string,
        propertyValues: { [propertyId: string]: string } = {}
    ) => {
        setSelectedCategoryId(categoryId);

        const category: CategoryDetail = await fetchCategoryById(categoryId);
        setListingProperties(
            category.listingProperties.filter(
                (prop) => prop.listingPropertyValues.length > 0
            )
        );
        setSelectedPropertyValues(propertyValues);
    };

    const handleCategorySelect = async (categoryId: string) => {
        setFieldErrors((prev) => ({
            ...prev,
            category: undefined,
            properties: undefined,
        }));

        try {
            await loadCategoryDetails(categoryId);
        } catch (err) {
            console.error('Failed to load category details', err);
        }
    };

    const handlePropertyValueChange = (propertyId: string, valueId: string) => {
        setSelectedPropertyValues((prev) => ({
            ...prev,
            [propertyId]: valueId,
        }));
        setFieldErrors((prev) => ({ ...prev, properties: undefined }));
    };

    const handlePhotoChange = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        if (!e.target.files) {
            return;
        }

        const input = e.currentTarget;
        const fileArray = Array.from(e.target.files);
        const photoError = validateImageFiles(
            fileArray,
            existingImages.length + photos.length
        );

        if (photoError) {
            setFieldErrors((prev) => ({ ...prev, photos: photoError }));
            input.value = '';
            return;
        }

        try {
            const normalizedFiles = await resizeImageFilesIfNeeded(fileArray);
            setPhotos((prev) => [...prev, ...normalizedFiles]);
            setFieldErrors((prev) => ({ ...prev, photos: undefined }));
        } catch (error) {
            console.error('Failed to prepare photos before upload', error);
            addNotification(
                getApiErrorMessage(
                    error,
                    'Не удалось подготовить фотографии. Попробуйте другие изображения.'
                ),
                { level: 'error', importance: 'high' }
            );
        } finally {
            input.value = '';
        }
    };

    const handleRemoveNewPhoto = (index: number) => {
        setPhotos((prev) => prev.filter((_, idx) => idx !== index));
        setFieldErrors((prev) => ({ ...prev, photos: undefined }));
    };

    const handleRemoveExistingImage = (imageId: string) => {
        const previewUrl = existingImages.find(
            (image) => image.id === imageId
        )?.previewUrl;

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        setRemovedImageIds((prev) => {
            const next = new Set(prev);
            next.add(imageId);
            return next;
        });
        setExistingImages((prev) => prev.filter((image) => image.id !== imageId));
        setFieldErrors((prev) => ({ ...prev, photos: undefined }));
    };

    const handleRemoveNewPhotoBackground = async (index: number) => {
        const sourcePhoto = photos[index];
        if (!sourcePhoto || processingNewPhotos.has(sourcePhoto)) {
            return;
        }

        try {
            setProcessingNewPhotos((prev) => {
                const next = new Set(prev);
                next.add(sourcePhoto);
                return next;
            });

            const processedPhoto = await removeBackgroundFromFile(sourcePhoto);
            setPhotos((prev) =>
                prev.map((photo) =>
                    photo === sourcePhoto ? processedPhoto : photo
                )
            );
        } catch (error) {
            console.error('Failed to remove background from new photo', error);
            addNotification(
                getApiErrorMessage(
                    error,
                    'Не удалось убрать фон с фотографии. Попробуйте другое изображение.'
                ),
                { level: 'error', importance: 'high' }
            );
        } finally {
            setProcessingNewPhotos((prev) => {
                const next = new Set(prev);
                next.delete(sourcePhoto);
                return next;
            });
        }
    };

    const handleRemoveExistingPhotoBackground = async (imageId: string) => {
        const sourceImage = existingImages.find((image) => image.id === imageId);
        if (!sourceImage || processingExistingImageIds.has(imageId)) {
            return;
        }

        try {
            setProcessingExistingImageIds((prev) => {
                const next = new Set(prev);
                next.add(imageId);
                return next;
            });

            const processedPhoto = await removeBackgroundFromImageId(
                sourceImage.id,
                `${sourceImage.fileName}${sourceImage.fileExtension}`
            );
            const nextPreviewUrl = URL.createObjectURL(processedPhoto);

            if (sourceImage.previewUrl) {
                URL.revokeObjectURL(sourceImage.previewUrl);
            }

            setExistingImages((prev) =>
                prev.map((image) =>
                    image.id === imageId
                        ? {
                              ...image,
                              previewUrl: nextPreviewUrl,
                              replacementFile: processedPhoto,
                          }
                        : image
                )
            );
        } catch (error) {
            console.error(
                'Failed to remove background from existing photo',
                error
            );
            addNotification(
                getApiErrorMessage(
                    error,
                    'Не удалось убрать фон с фотографии. Попробуйте другое изображение.'
                ),
                { level: 'error', importance: 'high' }
            );
        } finally {
            setProcessingExistingImageIds((prev) => {
                const next = new Set(prev);
                next.delete(imageId);
                return next;
            });
        }
    };

    const applyAiAutofillResult = async (
        result: Awaited<ReturnType<typeof aiAutofillListing>>
    ) => {
        const nextPropertyValues = Object.fromEntries(
            result.propertyValueSelection.map((selection) => [
                selection.listingPropertyId,
                selection.selectedListingPropertyValueId,
            ])
        );

        await loadCategoryDetails(result.categoryId, nextPropertyValues);
        setTitle(result.title);
        setDescription(result.description);
        setSelectedStateOfItemId(result.stateOfItemId);
        setFieldErrors((prev) => ({
            ...prev,
            title: undefined,
            description: undefined,
            stateOfItem: undefined,
            category: undefined,
            properties: undefined,
        }));

        if (result.warnings.length > 0) {
            addNotification(result.warnings.join(' '), {
                level: 'warning',
            });
        }
    };

    const handleAiAutofill = async () => {
        if (
            !listing ||
            aiAutofilling ||
            processingExistingImageIds.size > 0 ||
            processingNewPhotos.size > 0
        ) {
            return;
        }

        const existingImageIdsForAi = existingImages
            .filter((image) => !image.replacementFile)
            .map((image) => image.id);
        const replacementImages = existingImages
            .map((image) => image.replacementFile)
            .filter((file): file is File => Boolean(file));
        const imagesForAi = [...photos, ...replacementImages];

        if (existingImageIdsForAi.length + imagesForAi.length === 0) {
            return;
        }

        try {
            setAiAutofilling(true);

            const result = await aiAutofillListing({
                listingId: listing.id,
                descriptionHint: normalizeMultiline(description),
                existingImageIds: existingImageIdsForAi,
                newImages: imagesForAi,
            });

            await applyAiAutofillResult(result);
        } catch (error) {
            console.error('Failed to autofill listing from AI', error);
            addNotification(
                getApiErrorMessage(
                    error,
                    'Не удалось заполнить объявление по фото. Попробуйте ещё раз.'
                ),
                { level: 'error', importance: 'high' }
            );
        } finally {
            setAiAutofilling(false);
        }
    };

    const validateForm = () => {
        const normalizedTitle = normalizeSingleLine(title);
        const normalizedDescription = normalizeMultiline(description);
        const normalizedPriceInput = sanitizePriceInput(priceInput);
        const parsedPrice = parsePriceInput(normalizedPriceInput);
        const totalPhotoCount = existingImages.length + photos.length;

        const nextFieldErrors: EditListingFieldErrors = {
            title: validateListingTitle(normalizedTitle) || undefined,
            price: validatePrice(parsedPrice) || undefined,
            description:
                validateListingDescription(normalizedDescription) || undefined,
            city: city ? undefined : 'Выберите город.',
            stateOfItem:
                validateRequiredSelection(
                    selectedStateOfItemId,
                    'Состояние товара'
                ) || undefined,
            category:
                validateRequiredSelection(selectedCategoryId, 'Категория') ||
                undefined,
            photos:
                totalPhotoCount > 0
                    ? undefined
                    : 'Добавьте хотя бы одну фотографию.',
            properties:
                listingProperties.length > 0 &&
                listingProperties.some(
                    (prop) => !selectedPropertyValues[prop.id]
                )
                    ? 'Выберите значение для каждого параметра.'
                    : undefined,
        };

        setTitle(normalizedTitle);
        setDescription(normalizedDescription);
        setPriceInput(normalizedPriceInput);
        setFieldErrors(nextFieldErrors);

        return {
            hasErrors: Object.values(nextFieldErrors).some(Boolean),
            normalizedTitle,
            normalizedDescription,
            parsedPrice,
        };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!listing) {
            return;
        }

        const validationResult = validateForm();
        if (validationResult.hasErrors) {
            addNotification('Проверьте обязательные поля формы', {
                level: 'warning',
            });
            return;
        }

        try {
            setSubmitting(true);
            const replacementImages = existingImages.filter(
                (image) => image.replacementFile
            );
            const updatedListing: UpdateListingRequest = {
                title: validationResult.normalizedTitle,
                description: validationResult.normalizedDescription,
                price: validationResult.parsedPrice as number,
                stateOfItemId: selectedStateOfItemId,
                categoryId: selectedCategoryId,
                cityId: city!.id,
                propertyValueSelection: Object.entries(
                    selectedPropertyValues
                ).map(([propertyId, selectedValueId]) => ({
                    listingPropertyId: propertyId,
                    selectedListingPropertyValueId: selectedValueId,
                })),
                isSold: listing.isSold,
                isArchived: listing.isArchived,
            };

            await updateListing(listing.id, updatedListing);

            const imageIdsToDelete = new Set<string>([
                ...Array.from(removedImageIds),
                ...replacementImages.map((image) => image.id),
            ]);

            if (imageIdsToDelete.size > 0) {
                await Promise.all(
                    Array.from(imageIdsToDelete).map((imageId) =>
                        deleteImage(imageId)
                    )
                );
            }

            const filesToUpload = [
                ...photos,
                ...replacementImages.map(
                    (image) => image.replacementFile as File
                ),
            ];

            if (filesToUpload.length > 0) {
                await Promise.all(
                    filesToUpload.map((file) =>
                        uploadImage({
                            file,
                            listingId: listing.id,
                        })
                    )
                );
            }

            addNotification('Объявление успешно обновлено.', {
                level: 'success',
            });
            router.push(`/user/${listing.sellerId}`);
        } catch (error) {
            console.error('Failed to update listing', error);
            addNotification(
                getApiErrorMessage(
                    error,
                    'Не удалось обновить объявление, убедитесь, что вы заполнили все поля.'
                ),
                { level: 'error', importance: 'high' }
            );
        } finally {
            setSubmitting(false);
        }
    };

    const photoNames = photos.map((file) => file.name).join(', ');
    const isBrandProperty = (name: string) => {
        const lowered = name.toLowerCase();
        return lowered.includes('бренд') || lowered.includes('brand');
    };
    const ValidationErrorMessage = ({ message }: { message?: string }) => (
        <div className="invalid-feedback d-block text-danger field-error-slot">
            <span className="d-block">{message || '\u00A0'}</span>
        </div>
    );
    const isAiButtonDisabled =
        existingImages.length + photos.length === 0 ||
        submitting ||
        aiAutofilling ||
        processingExistingImageIds.size > 0 ||
        processingNewPhotos.size > 0;
    const shouldShowExistingGridToggle = existingImages.length > 2;
    const shouldShowNewGridToggle = photos.length > 2;
    const handleAiTooltipMouseEnter = (
        event: React.MouseEvent<HTMLSpanElement>
    ) => {
        setAiTooltipPosition({
            x: event.clientX + 14,
            y: event.clientY + 14,
        });
        setShowAiTooltip(true);
    };
    const handleAiTooltipMouseMove = (
        event: React.MouseEvent<HTMLSpanElement>
    ) => {
        setAiTooltipPosition({
            x: event.clientX + 14,
            y: event.clientY + 14,
        });
    };
    const handleAiTooltipMouseLeave = () => {
        setShowAiTooltip(false);
    };

    if (loading) {
        return <div className="page-loading-state">Загрузка</div>;
    }

    if (!listing) {
        return <div className="container mt-5">Объявление не найдено.</div>;
    }

    return (
        <div className="container-ads mt-5">
            <h1 className="mb-4">Редактирование объявления</h1>
            <form onSubmit={handleSubmit}>
                <div className="mb-3 d-flex justify-content-end">
                    <span
                        className="d-inline-block"
                        onMouseEnter={handleAiTooltipMouseEnter}
                        onMouseMove={handleAiTooltipMouseMove}
                        onMouseLeave={handleAiTooltipMouseLeave}
                    >
                        <button
                            type="button"
                            className={`btn ${
                                isAiButtonDisabled
                                    ? 'btn-secondary'
                                    : 'btn-outline-primary'
                            }`}
                            onClick={handleAiAutofill}
                            disabled={isAiButtonDisabled}
                            style={
                                isAiButtonDisabled
                                    ? {
                                          pointerEvents: 'none',
                                          opacity: 0.65,
                                          cursor: 'not-allowed',
                                      }
                                    : undefined
                            }
                        >
                            {aiAutofilling
                                ? 'AI анализирует фото...'
                                : 'Заполнить с AI'}
                        </button>
                        {showAiTooltip && (
                            <div
                                role="tooltip"
                                style={{
                                    position: 'fixed',
                                    left: aiTooltipPosition.x,
                                    top: aiTooltipPosition.y,
                                    zIndex: 1080,
                                    maxWidth: '300px',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(33, 37, 41, 0.95)',
                                    color: '#fff',
                                    fontSize: '0.75rem',
                                    lineHeight: 1.35,
                                    boxShadow:
                                        '0 4px 12px rgba(0, 0, 0, 0.2)',
                                    pointerEvents: 'none',
                                }}
                            >
                                {AI_TOOLTIP_TEXT}
                            </div>
                        )}
                    </span>
                </div>

                <div className="mb-4">
                    <label className="form-label">Добавить фото (макс. 10)</label>
                    <div className="d-flex flex-column flex-md-row gap-2 align-items-md-end">
                        <div className="flex-grow-1">
                            <input
                                type="file"
                                className={`form-control file-input-fixed ${
                                    fieldErrors.photos ? 'is-invalid' : ''
                                }`}
                                multiple
                                accept={IMAGE_UPLOAD_ACCEPT}
                                onChange={handlePhotoChange}
                                aria-invalid={Boolean(fieldErrors.photos)}
                            />
                        </div>
                    </div>

                    <ValidationErrorMessage message={fieldErrors.photos} />

                    {photos.length > 0 && (
                        <div
                            className="file-name-ellipsis"
                            title={photoNames}
                        >
                            {photoNames}
                        </div>
                    )}
                    <div className="form-text">
                        Всего фото: {existingImages.length + photos.length}
                    </div>
                </div>

                {existingImages.length > 0 && (
                    <div className="mb-3">
                        <label className="form-label">Текущие фото</label>
                        <div
                            className={`photo-grid-expandable${
                                isExistingGridExpanded
                                    ? ' photo-grid-expandable--expanded'
                                    : ''
                            }`}
                        >
                            <div className="photo-grid">
                                {existingImages.map((image) => (
                                    <EditablePhotoCard
                                        key={image.id}
                                        imageUrl={
                                            image.previewUrl ||
                                            resolveApiAssetUrl(image.imageUrl)
                                        }
                                        imageAlt="Фото объявления"
                                        name={`${image.fileName}${image.fileExtension}`}
                                        isBusy={processingExistingImageIds.has(
                                            image.id
                                        )}
                                        disableActions={
                                            submitting ||
                                            aiAutofilling ||
                                            processingExistingImageIds.has(
                                                image.id
                                            )
                                        }
                                        onRemoveBackground={() =>
                                            handleRemoveExistingPhotoBackground(
                                                image.id
                                            )
                                        }
                                        onRemove={() =>
                                            handleRemoveExistingImage(image.id)
                                        }
                                    />
                                ))}
                            </div>
                            {shouldShowExistingGridToggle &&
                                !isExistingGridExpanded && (
                                <div
                                    className="photo-grid-expandable__fade"
                                    aria-hidden="true"
                                />
                            )}
                            {shouldShowExistingGridToggle && (
                                <button
                                    type="button"
                                    className="photo-grid-expandable__toggle"
                                    onClick={() =>
                                        setIsExistingGridExpanded(
                                            (prev) => !prev
                                        )
                                    }
                                    aria-expanded={isExistingGridExpanded}
                                    aria-label={
                                        isExistingGridExpanded
                                            ? 'Свернуть фото'
                                            : 'Показать все фото'
                                    }
                                >
                                    <span
                                        className={`photo-grid-expandable__arrow${
                                            isExistingGridExpanded
                                                ? ' photo-grid-expandable__arrow--expanded'
                                                : ''
                                        }`}
                                        aria-hidden="true"
                                    >
                                        ▾
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {photos.length > 0 && (
                    <div className="mb-3">
                        <label className="form-label">
                            Новые фото к загрузке
                        </label>
                        <div
                            className={`photo-grid-expandable${
                                isNewGridExpanded
                                    ? ' photo-grid-expandable--expanded'
                                    : ''
                            }`}
                        >
                            <div className="photo-grid">
                                {photos.map((file, index) => (
                                    <EditablePhotoCard
                                        key={`${file.name}-${index}`}
                                        imageUrl={photoPreviews[index]}
                                        imageAlt={file.name}
                                        name={file.name}
                                        isBusy={processingNewPhotos.has(file)}
                                        disableActions={
                                            submitting ||
                                            aiAutofilling ||
                                            processingNewPhotos.has(file)
                                        }
                                        onRemoveBackground={() =>
                                            handleRemoveNewPhotoBackground(
                                                index
                                            )
                                        }
                                        onRemove={() =>
                                            handleRemoveNewPhoto(index)
                                        }
                                    />
                                ))}
                            </div>
                            {shouldShowNewGridToggle && !isNewGridExpanded && (
                                <div
                                    className="photo-grid-expandable__fade"
                                    aria-hidden="true"
                                />
                            )}
                            {shouldShowNewGridToggle && (
                                <button
                                    type="button"
                                    className="photo-grid-expandable__toggle"
                                    onClick={() =>
                                        setIsNewGridExpanded((prev) => !prev)
                                    }
                                    aria-expanded={isNewGridExpanded}
                                    aria-label={
                                        isNewGridExpanded
                                            ? 'Свернуть фото'
                                            : 'Показать все фото'
                                    }
                                >
                                    <span
                                        className={`photo-grid-expandable__arrow${
                                            isNewGridExpanded
                                                ? ' photo-grid-expandable__arrow--expanded'
                                                : ''
                                        }`}
                                        aria-hidden="true"
                                    >
                                        ▾
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="mb-3">
                    <label
                        htmlFor="title"
                        className="form-label"
                    >
                        {'\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435'}
                    </label>
                    <input
                        id="title"
                        type="text"
                        className={`form-control ${
                            fieldErrors.title ? 'is-invalid' : ''
                        }`}
                        value={title}
                        onChange={(e) => {
                            setTitle(e.target.value);
                            setFieldErrors((prev) => ({
                                ...prev,
                                title: undefined,
                            }));
                        }}
                        onBlur={() => {
                            const normalized = normalizeSingleLine(title);
                            setTitle(normalized);
                            setFieldErrors((prev) => ({
                                ...prev,
                                title:
                                    validateListingTitle(normalized) ||
                                    undefined,
                            }));
                        }}
                        minLength={VALIDATION_LIMITS.listingTitleMinLength}
                        maxLength={VALIDATION_LIMITS.listingTitleMaxLength}
                        placeholder="Введите название объявления"
                        aria-invalid={Boolean(fieldErrors.title)}
                        required
                    />
                    <ValidationErrorMessage message={fieldErrors.title} />
                </div>

                <div className="mb-3">
                    <label
                        htmlFor="price"
                        className="form-label"
                    >
                        {'\u0426\u0435\u043d\u0430'}
                    </label>
                    <input
                        id="price"
                        type="text"
                        className={`form-control ${
                            fieldErrors.price ? 'is-invalid' : ''
                        }`}
                        value={priceInput}
                        onChange={(e) => {
                            setPriceInput(sanitizePriceInput(e.target.value));
                            setFieldErrors((prev) => ({
                                ...prev,
                                price: undefined,
                            }));
                        }}
                        onBlur={() => {
                            const normalizedPriceInput =
                                sanitizePriceInput(priceInput);
                            setPriceInput(normalizedPriceInput);
                            setFieldErrors((prev) => ({
                                ...prev,
                                price:
                                    validatePrice(
                                        parsePriceInput(normalizedPriceInput)
                                    ) || undefined,
                            }));
                        }}
                        onKeyDown={(e) => {
                            if (
                                e.ctrlKey ||
                                e.metaKey ||
                                e.altKey ||
                                [
                                    'Backspace',
                                    'Delete',
                                    'Tab',
                                    'Escape',
                                    'Enter',
                                    'ArrowLeft',
                                    'ArrowRight',
                                    'ArrowUp',
                                    'ArrowDown',
                                    'Home',
                                    'End',
                                ].includes(e.key)
                            ) {
                                return;
                            }

                            if (/^\d$/.test(e.key)) {
                                return;
                            }

                            e.preventDefault();
                        }}
                        inputMode="numeric"
                        pattern="[0-9]+"
                        placeholder="Введите цену"
                        aria-invalid={Boolean(fieldErrors.price)}
                        required
                    />
                    <ValidationErrorMessage message={fieldErrors.price} />
                </div>

                <div className="mb-3">
                    <label
                        htmlFor="description"
                        className="form-label"
                    >
                        {'\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435'}
                    </label>
                    <textarea
                        id="description"
                        className={`form-control ${
                            fieldErrors.description ? 'is-invalid' : ''
                        }`}
                        rows={4}
                        value={description}
                        onChange={(e) => {
                            setDescription(e.target.value);
                            setFieldErrors((prev) => ({
                                ...prev,
                                description: undefined,
                            }));
                        }}
                        onBlur={() => {
                            const normalized = normalizeMultiline(description);
                            setDescription(normalized);
                            setFieldErrors((prev) => ({
                                ...prev,
                                description:
                                    validateListingDescription(normalized) ||
                                    undefined,
                            }));
                        }}
                        maxLength={
                            VALIDATION_LIMITS.listingDescriptionMaxLength
                        }
                        placeholder="Введите описание"
                        aria-invalid={Boolean(fieldErrors.description)}
                    />
                    <ValidationErrorMessage
                        message={fieldErrors.description}
                    />
                </div>

                <div className="mb-3">
                    <label className="form-label">
                        {'\u0413\u043e\u0440\u043e\u0434'}
                    </label>
                    <CitySelector
                        selectedCityId={city?.id}
                        placeholder="Выберите город"
                        validationError={fieldErrors.city}
                        onCitySelect={(selectedCity) => {
                            setCity(selectedCity);
                            setFieldErrors((prev) => ({
                                ...prev,
                                city: undefined,
                            }));
                        }}
                    />
                </div>

                <div className="mb-3">
                    <label className="form-label">
                        {'\u0421\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435 \u0442\u043e\u0432\u0430\u0440\u0430'}
                    </label>
                    <CustomDropdown
                        options={statesOfItems.map((s) => ({
                            id: s.id,
                            name: s.name,
                        }))}
                        selectedId={selectedStateOfItemId}
                        onSelect={(stateId) => {
                            setSelectedStateOfItemId(stateId);
                            setFieldErrors((prev) => ({
                                ...prev,
                                stateOfItem: undefined,
                            }));
                        }}
                        placeholder="Выберите состояние"
                        isInvalid={Boolean(fieldErrors.stateOfItem)}
                    />
                    <ValidationErrorMessage
                        message={fieldErrors.stateOfItem}
                    />
                </div>

                <div className="mb-3">
                    <label className="form-label">
                        {'\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f'}
                    </label>
                    <CustomDropdown
                        options={categories.map((c) => ({
                            id: c.id,
                            name: c.name,
                            level: c.level,
                        }))}
                        selectedId={selectedCategoryId}
                        onSelect={handleCategorySelect}
                        placeholder="Выберите категорию"
                        isInvalid={Boolean(fieldErrors.category)}
                    />
                    <ValidationErrorMessage
                        message={fieldErrors.category}
                    />
                </div>

                {listingProperties.length > 0 && (
                    <div className="mb-3">
                        <label className="form-label">
                            {'\u041f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b'}
                        </label>
                        {listingProperties.map((prop) => (
                            <div
                                className="mb-2"
                                key={prop.id}
                            >
                                <label className="form-label">
                                    {prop.name}
                                </label>
                                {(() => {
                                    const isPropInvalid =
                                        Boolean(fieldErrors.properties) &&
                                        !selectedPropertyValues[prop.id];
                                    return isBrandProperty(prop.name) ? (
                                        <SearchableDropdown
                                            options={prop.listingPropertyValues.map(
                                                (v) => ({
                                                    id: v.id,
                                                    name: v.name,
                                                })
                                            )}
                                            selectedId={
                                                selectedPropertyValues[prop.id] || ''
                                            }
                                            onSelect={(valId) =>
                                                handlePropertyValueChange(
                                                    prop.id,
                                                    valId
                                                )
                                            }
                                            placeholder={
                                                `Введите ${prop.name}`
                                            }
                                            searchPlaceholder={
                                                '\u041d\u0435\u0442 \u0441\u043e\u0432\u043f\u0430\u0434\u0435\u043d\u0438\u0439.'
                                            }
                                            isInvalid={isPropInvalid}
                                        />
                                    ) : (
                                        <CustomDropdown
                                            options={prop.listingPropertyValues.map(
                                                (v) => ({
                                                    id: v.id,
                                                    name: v.name,
                                                })
                                            )}
                                            selectedId={
                                                selectedPropertyValues[prop.id] || ''
                                            }
                                            onSelect={(valId) =>
                                                handlePropertyValueChange(
                                                    prop.id,
                                                    valId
                                                )
                                            }
                                            placeholder={
                                                `Выберите ${prop.name}`
                                            }
                                            isInvalid={isPropInvalid}
                                        />
                                    );
                                })()}
                            </div>
                        ))}
                        <ValidationErrorMessage
                            message={fieldErrors.properties}
                        />
                    </div>
                )}

                <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={submitting || aiAutofilling}
                >
                    {submitting
                        ? '\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...'
                        : '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f'}
                </button>
            </form>
        </div>
    );
}

export default function EditListingPage({
    params,
}: {
    params: { id: string };
}) {
    return (
        <RequireAuth>
            <EditListingContent params={params} />
        </RequireAuth>
    );
}
