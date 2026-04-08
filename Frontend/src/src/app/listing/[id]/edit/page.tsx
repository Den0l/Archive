'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { City } from '@/types/api/cities';
import { CategoryDetail } from '@/types/api/categories';
import { ListingPropertyDetail } from '@/types/api/listingProperties';
import { StateOfItem } from '@/types/api/stateOfItem';
import { Image } from '@/types/api/images';
import { ListingDetail, UpdateListingRequest } from '@/types/api/listings';
import { fetchListingById, updateListing } from '@/services/listingService';
import { fetchStatesOfItem } from '@/services/stateOfItemService';
import {
    fetchCategoryHierarchy,
    fetchCategoryById,
} from '@/services/categoryService';
import { deleteImage, uploadImage } from '@/services/imageService';
import CitySelector from '@/sharedComponents/CitySelector';
import CustomDropdown from '@/sharedComponents/CustomDropdown';
import SearchableDropdown from '@/sharedComponents/SearchableDropdown';
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

export default function EditListingPage({
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
    const [existingImages, setExistingImages] = useState<Image[]>([]);
    const [removedImageIds, setRemovedImageIds] = useState<Set<string>>(
        new Set()
    );
    const [fieldErrors, setFieldErrors] = useState<EditListingFieldErrors>({});
    const [formError, setFormError] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const router = useRouter();

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
                setExistingImages(listingResponse.images ?? []);

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
                    setListingProperties(category.listingProperties);
                }
            } catch (error) {
                console.error('Failed to load listing data', error);
                if (isMounted) {
                    setFormError(
                        getApiErrorMessage(
                            error,
                            'Не удалось загрузить данные объявления.'
                        )
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
    }, [id]);

    useEffect(() => {
        if (photos.length == 0) {
            setPhotoPreviews([]);
            return;
        }

        const nextPreviews = photos.map((file) => URL.createObjectURL(file));
        setPhotoPreviews(nextPreviews);

        return () => {
            nextPreviews.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [photos]);

    const handleCategorySelect = async (categoryId: string) => {
        setSelectedCategoryId(categoryId);
        setSelectedPropertyValues({});
        setFieldErrors((prev) => ({
            ...prev,
            category: undefined,
            properties: undefined,
        }));

        try {
            const category: CategoryDetail = await fetchCategoryById(categoryId);
            setListingProperties(category.listingProperties);
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

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) {
            return;
        }

        const fileArray = Array.from(e.target.files);
        const photoError = validateImageFiles(
            fileArray,
            existingImages.length + photos.length
        );

        if (photoError) {
            setFieldErrors((prev) => ({ ...prev, photos: photoError }));
            e.target.value = '';
            return;
        }

        setPhotos((prev) => [...prev, ...fileArray]);
        setFieldErrors((prev) => ({ ...prev, photos: undefined }));
        e.target.value = '';
    };

    const handleRemoveNewPhoto = (index: number) => {
        setPhotos((prev) => prev.filter((_, idx) => idx != index));
        setFieldErrors((prev) => ({ ...prev, photos: undefined }));
    };

    const handleRemoveExistingImage = (imageId: string) => {
        setRemovedImageIds((prev) => {
            const next = new Set(prev);
            next.add(imageId);
            return next;
        });
        setExistingImages((prev) => prev.filter((image) => image.id !== imageId));
        setFieldErrors((prev) => ({ ...prev, photos: undefined }));
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

        setFormError('');

        const validationResult = validateForm();
        if (validationResult.hasErrors) {
            return;
        }

        try {
            setSubmitting(true);
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

            if (removedImageIds.size > 0) {
                await Promise.all(
                    Array.from(removedImageIds).map((imageId) =>
                        deleteImage(imageId)
                    )
                );
            }

            if (photos.length > 0) {
                await Promise.all(
                    photos.map((file) =>
                        uploadImage({
                            file,
                            listingId: listing.id,
                        })
                    )
                );
            }

            router.push(`/user/${listing.sellerId}`);
        } catch (error) {
            console.error('Failed to update listing', error);
            setFormError(
                getApiErrorMessage(
                    error,
                    'Не удалось обновить объявление, убедитесь, что вы заполнили все поля.'
                )
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
    const ValidationErrorMessage = ({ message }: { message: string }) => (
        <div className="invalid-feedback d-block text-danger">
            <span className="d-block">{message}</span>
        </div>
    );

    if (loading) {
        return <div className="container mt-5">Загрузка...</div>;
    }

    if (!listing) {
        return <div className="container mt-5">Объявление не найдено.</div>;
    }

    return (
        <div className="container-ads mt-5">
            <h1 className="mb-4">Редактирование объявления</h1>

            <form onSubmit={handleSubmit}>
                <div className="form-alert-slot">
                    {formError ? (
                        <div className="alert alert-danger form-alert-message">
                            {formError}
                        </div>
                    ) : (
                        <div
                            className="form-alert-message form-alert-placeholder"
                            aria-hidden="true"
                        >
                            &nbsp;
                        </div>
                    )}
                </div>

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
                        onChange={(e) => setTitle(e.target.value)}
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
                        aria-invalid={Boolean(fieldErrors.title)}
                        required
                    />
                    {fieldErrors.title && (
                        <ValidationErrorMessage message={fieldErrors.title} />
                    )}
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

                            if (
                                (e.key === ',' || e.key === '.') &&
                                !priceInput.includes(',')
                            ) {
                                return;
                            }

                            e.preventDefault();
                        }}
                        inputMode="decimal"
                        pattern="[0-9]+([,.][0-9]{1,2})?"
                        aria-invalid={Boolean(fieldErrors.price)}
                        required
                    />
                    {fieldErrors.price && (
                        <ValidationErrorMessage message={fieldErrors.price} />
                    )}
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
                        onChange={(e) => setDescription(e.target.value)}
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
                        minLength={
                            VALIDATION_LIMITS.listingDescriptionMinLength
                        }
                        maxLength={
                            VALIDATION_LIMITS.listingDescriptionMaxLength
                        }
                        aria-invalid={Boolean(fieldErrors.description)}
                        required
                    />
                    {fieldErrors.description && (
                        <ValidationErrorMessage
                            message={fieldErrors.description}
                        />
                    )}
                </div>

                <div className="mb-3">
                    <label className="form-label">Город</label>
                    <CitySelector
                        selectedCityId={city?.id}
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
                        isInvalid={Boolean(fieldErrors.stateOfItem)}
                    />
                    {fieldErrors.stateOfItem && (
                        <ValidationErrorMessage
                            message={fieldErrors.stateOfItem}
                        />
                    )}
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
                        isInvalid={Boolean(fieldErrors.category)}
                    />
                    {fieldErrors.category && (
                        <ValidationErrorMessage
                            message={fieldErrors.category}
                        />
                    )}
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
                                            placeholder={`Введите ${prop.name}`}
                                            searchPlaceholder="Нет совпадений."
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
                                            placeholder={`Выберите ${prop.name}`}
                                            isInvalid={isPropInvalid}
                                        />
                                    );
                                })()}
                            </div>
                        ))}
                        {fieldErrors.properties && (
                            <ValidationErrorMessage
                                message={fieldErrors.properties}
                            />
                        )}
                    </div>
                )}

                {existingImages.length > 0 && (
                    <div className="mb-3">
                        <label className="form-label">Текущие фото</label>
                        <div className="d-flex flex-wrap gap-2">
                            {existingImages.map((image) => (
                                <div
                                    key={image.id}
                                    className="photo-card"
                                >
                                    <img
                                        src={image.imageUrl}
                                        alt="Фото объявления"
                                        className="photo-card__image"
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-outline-danger btn-sm mt-2 photo-card__button"
                                        onClick={() =>
                                            handleRemoveExistingImage(image.id)
                                        }
                                    >
                                        Удалить
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mb-3">
                    <label className="form-label">
                        Добавить фото (макс. 20)
                    </label>
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

                    {fieldErrors.photos && (
                        <ValidationErrorMessage message={fieldErrors.photos} />
                    )}

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


                {photos.length > 0 && (
                    <div className="mb-3">
                        <label className="form-label">
                            Новые фото к загрузке
                        </label>
                        <div className="d-flex flex-wrap gap-2">
                            {photos.map((file, index) => (
                                <div
                                    key={`${file.name}-${index}`}
                                    className="photo-card"
                                >
                                    {photoPreviews[index] && (
                                        <img
                                            src={photoPreviews[index]}
                                            alt={file.name}
                                            style={{
                                                width: 120,
                                                height: 120,
                                                objectFit: 'cover',
                                                borderRadius: 8,
                                                display: 'block',
                                                marginBottom: 8,
                                            }}
                                        />
                                    )}
                                    <div className="small text-truncate text-center photo-card__name">
                                        {file.name}
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-outline-danger btn-sm mt-2 photo-card__button"
                                        onClick={() =>
                                            handleRemoveNewPhoto(index)
                                        }
                                    >
                                        Удалить
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={submitting}
                >
                    {submitting ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
            </form>
        </div>
    );
}
