'use client';

import { useState, useEffect } from 'react';
import { City } from '@/types/api/cities';
import CitySelector from '@/sharedComponents/CitySelector';
import {
    fetchCategoryHierarchy,
    fetchCategoryById,
} from '@/services/categoryService';
import { fetchStatesOfItem } from '@/services/stateOfItemService';
import { CategoryDetail } from '@/types/api/categories';
import { StateOfItem } from '@/types/api/stateOfItem';
import { ListingPropertyDetail } from '@/types/api/listingProperties';
import { CreateListingRequest } from '@/types/api/listings';
import { uploadImage } from '@/services/imageService';
import {
    aiAutofillListing,
    createListing,
} from '@/services/listingService';
import { removeBackgroundFromFile } from '@/services/backgroundRemovalService';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/context/NotificationContext';
import RequireAuth from '@/sharedComponents/RequireAuth';
import CustomDropdown from '@/sharedComponents/CustomDropdown';
import SearchableDropdown from '@/sharedComponents/SearchableDropdown';
import EditablePhotoCard from '@/sharedComponents/EditablePhotoCard';
import {
    IMAGE_UPLOAD_ACCEPT,
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

type CreateListingFieldErrors = {
    title?: string;
    price?: string;
    description?: string;
    city?: string;
    stateOfItem?: string;
    category?: string;
    properties?: string;
    photos?: string;
};

const AI_TOOLTIP_TEXT =
    'Если по фото нельзя определить размер, материал, комплектность и другие детали, напишите это в описании перед запуском AI — он использует этот текст и не потеряет эти данные.';

function CreateListingContent() {
    const [categories, setCategories] = useState<CategoryDropdownOption[]>([]);
    const [statesOfItem, setStatesOfItem] = useState<StateOfItem[]>([]);
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
    const [fieldErrors, setFieldErrors] = useState<CreateListingFieldErrors>(
        {}
    );
    const [submitting, setSubmitting] = useState(false);
    const [aiAutofilling, setAiAutofilling] = useState(false);
    const [showAiTooltip, setShowAiTooltip] = useState(false);
    const [aiTooltipPosition, setAiTooltipPosition] = useState({
        x: 0,
        y: 0,
    });
    const [processingPhotos, setProcessingPhotos] = useState<Set<File>>(
        new Set()
    );
    const [isPhotoGridExpanded, setIsPhotoGridExpanded] = useState(false);
    const router = useRouter();
    const { addNotification } = useNotification();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const states = await fetchStatesOfItem();
                const fetchedCategories = await fetchCategoryHierarchy();
                setCategories(flattenCategoryHierarchy(fetchedCategories));
                setStatesOfItem(states);
            } catch (error) {
                console.error('Failed to fetch data', error);
            }
        };
        fetchData();
    }, []);

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

    const loadCategoryDetails = async (
        categoryId: string,
        propertyValues: { [propertyId: string]: string } = {}
    ) => {
        setSelectedCategoryId(categoryId);

        const category: CategoryDetail = await fetchCategoryById(categoryId);
        const safeProperties = Array.isArray(category.listingProperties)
            ? category.listingProperties
            : [];
        setListingProperties(
            safeProperties.filter(
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
        const photoError = validateImageFiles(fileArray, photos.length);

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

    const handleRemovePhotoBackground = async (index: number) => {
        const sourcePhoto = photos[index];
        if (!sourcePhoto || processingPhotos.has(sourcePhoto)) {
            return;
        }

        try {
            setProcessingPhotos((prev) => {
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
            console.error('Failed to remove background from photo', error);
            addNotification(
                getApiErrorMessage(
                    error,
                    'Не удалось убрать фон с фотографии. Попробуйте другое изображение.'
                ),
                { level: 'error', importance: 'high' }
            );
        } finally {
            setProcessingPhotos((prev) => {
                const next = new Set(prev);
                next.delete(sourcePhoto);
                return next;
            });
        }
    };

    const applyAiAutofillResult = async (result: Awaited<ReturnType<typeof aiAutofillListing>>) => {
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
        if (photos.length === 0 || aiAutofilling || processingPhotos.size > 0) {
            return;
        }

        try {
            setAiAutofilling(true);

            const result = await aiAutofillListing({
                descriptionHint: normalizeMultiline(description),
                newImages: photos,
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
        const nextFieldErrors: CreateListingFieldErrors = {
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
                validateRequiredSelection(
                    selectedCategoryId,
                    'Категория'
                ) || undefined,
            photos:
                photos.length > 0
                    ? undefined
                    : 'Добавьте хотя бы одну фотографию.',
            properties:
                listingProperties.length > 0 &&
                listingProperties.some((prop) => !selectedPropertyValues[prop.id])
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

        const validationResult = validateForm();
        if (validationResult.hasErrors) {
            addNotification('Проверьте обязательные поля формы', {
                level: 'warning',
            });
            return;
        }

        try {
            setSubmitting(true);
            const listingData: CreateListingRequest = {
                title: validationResult.normalizedTitle,
                price: validationResult.parsedPrice as number,
                description: validationResult.normalizedDescription,
                stateOfItemId: selectedStateOfItemId,
                categoryId: selectedCategoryId,
                cityId: city!.id,
                propertyValueSelection: Object.entries(
                    selectedPropertyValues
                ).map(([propertyId, selectedValueId]) => ({
                    listingPropertyId: propertyId,
                    selectedListingPropertyValueId: selectedValueId,
                })),
            };

            const created = await createListing(listingData);
            const listingId = created.id;

            await Promise.all(
                photos.map((file) =>
                    uploadImage({
                        file,
                        listingId,
                    })
                )
            );
            addNotification('Объявление успешно создано.', {
                level: 'success',
            });
            router.push(`/user/${created.sellerId}`);
        } catch (err) {
            console.error('Failed to create listing', err);
            addNotification(
                getApiErrorMessage(
                    err,
                    'Не удалось создать объявление, убедитесь, что вы заполнили все поля.'
                ),
                { level: 'error', importance: 'high' }
            );
        } finally {
            setSubmitting(false);
        }
    };

    const isBrandProperty = (name: string) => {
        const lowered = name.toLowerCase();
        return lowered.includes('бренд') || lowered.includes('brand');
    };
    const ValidationErrorMessage = ({ message }: { message?: string }) => (
        <div className="invalid-feedback d-block text-danger field-error-slot">
            <span className="d-block">{message || '\u00A0'}</span>
        </div>
    );
    const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
    };

    const isAiButtonDisabled =
        photos.length === 0 ||
        submitting ||
        aiAutofilling ||
        processingPhotos.size > 0;
    const shouldShowPhotoGridToggle = photos.length > 2;
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

    return (
        <div className="container-ads mt-5">
            <h1 className="mb-4">Создать новое объявление</h1>

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
                    <label className="form-label">
                        Загрузить фото (макс. 10)
                    </label>
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

                    <div className="form-text">
                        Загружено фото: {photos.length}
                    </div>
                </div>

                {photos.length > 0 && (
                    <div className="mb-3">
                        <label className="form-label">Добавленные фото</label>
                        <div
                            className={`photo-grid-expandable${
                                isPhotoGridExpanded
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
                                        isBusy={processingPhotos.has(file)}
                                        disableActions={
                                            submitting ||
                                            aiAutofilling ||
                                            processingPhotos.has(file)
                                        }
                                        onRemoveBackground={() =>
                                            handleRemovePhotoBackground(index)
                                        }
                                        onRemove={() =>
                                            handleRemoveNewPhoto(index)
                                        }
                                    />
                                ))}
                            </div>
                            {shouldShowPhotoGridToggle && !isPhotoGridExpanded && (
                                <div
                                    className="photo-grid-expandable__fade"
                                    aria-hidden="true"
                                />
                            )}
                            {shouldShowPhotoGridToggle && (
                                <button
                                    type="button"
                                    className="photo-grid-expandable__toggle"
                                    onClick={() =>
                                        setIsPhotoGridExpanded((prev) => !prev)
                                    }
                                    aria-expanded={isPhotoGridExpanded}
                                    aria-label={
                                        isPhotoGridExpanded
                                            ? 'Свернуть фото'
                                            : 'Показать все фото'
                                    }
                                >
                                    <span
                                        className={`photo-grid-expandable__arrow${
                                            isPhotoGridExpanded
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
                        Название
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
                        Цена
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
                        onKeyDown={handlePriceKeyDown}
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
                        Описание
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
                    <label className="form-label">Город</label>
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
                    <label className="form-label">Состояние товара</label>
                    <CustomDropdown
                        options={statesOfItem.map((s) => ({
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
                    <label className="form-label">Категория</label>
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
                        <label className="form-label">Параметры</label>
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
                                                (v) => ({ id: v.id, name: v.name })
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
                                            searchPlaceholder="Нет совпадений."
                                            isInvalid={isPropInvalid}
                                        />
                                    ) : (
                                        <CustomDropdown
                                            options={prop.listingPropertyValues.map(
                                                (v) => ({ id: v.id, name: v.name })
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

                <div className="d-flex justify-content-center">
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={submitting || aiAutofilling}
                    >
                        {submitting ? 'Публикация...' : 'Опубликовать'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function CreateListing() {
    return (
        <RequireAuth>
            <CreateListingContent />
        </RequireAuth>
    );
}
