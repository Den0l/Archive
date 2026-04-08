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
import { createListing } from '@/services/listingService';
import { useRouter } from 'next/navigation';
import CustomDropdown from '@/sharedComponents/CustomDropdown';
import SearchableDropdown from '@/sharedComponents/SearchableDropdown';
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

export default function CreateListing() {
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
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const router = useRouter();

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

    const handleCategorySelect = async (categoryId: string) => {
        setSelectedCategoryId(categoryId);
        setSelectedPropertyValues({});
        setFieldErrors((prev) => ({
            ...prev,
            category: undefined,
            properties: undefined,
        }));

        try {
            const category: CategoryDetail =
                await fetchCategoryById(categoryId);
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
        const photoError = validateImageFiles(fileArray, photos.length);

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
        setPhotos((prev) => prev.filter((_, idx) => idx !== index));
        setFieldErrors((prev) => ({ ...prev, photos: undefined }));
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
        setFormError('');

        const validationResult = validateForm();
        if (validationResult.hasErrors) {
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
            router.push('/');
        } catch (err) {
            console.error('Failed to create listing', err);
            setFormError(
                getApiErrorMessage(
                    err,
                    'Не удалось создать объявление, убедитесь, что вы заполнили все поля.'
                )
            );
        } finally {
            setSubmitting(false);
        }
    };

    const isBrandProperty = (name: string) => {
        const lowered = name.toLowerCase();
        return lowered.includes('бренд') || lowered.includes('brand');
    };
    const ValidationErrorMessage = ({ message }: { message: string }) => (
        <div className="invalid-feedback d-block text-danger">
            <span className="d-block">{message}</span>
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

        if ((e.key === ',' || e.key === '.') && !priceInput.includes(',')) {
            return;
        }

        e.preventDefault();
    };

    return (
        <div className="container-ads mt-5">
            <h1 className="mb-4">Создать новое объявление</h1>

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
                        onKeyDown={handlePriceKeyDown}
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
                        placeholder="Выберите категорию"
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
                                            placeholder={`Введите ${prop.name}`}
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

                <div className="mb-3">
                    <label className="form-label">
                        Загрузить фото (макс. 20)
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

                    <div className="form-text">
                        Загружено фото: {photos.length}
                    </div>
                </div>

                {photos.length > 0 && (
                    <div className="mb-3">
                        <label className="form-label">Добавленные фото</label>
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
                                            className="photo-card__image"
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
                    {submitting ? 'Публикация...' : 'Опубликовать'}
                </button>
            </form>
        </div>
    );
}
