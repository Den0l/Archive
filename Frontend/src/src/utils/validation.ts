export const VALIDATION_LIMITS = {
    emailMaxLength: 254,
    nicknameMinLength: 2,
    nicknameMaxLength: 50,
    passwordMinLength: 6,
    passwordMaxLength: 128,
    entityNameMinLength: 2,
    entityNameMaxLength: 80,
    listingTitleMinLength: 3,
    listingTitleMaxLength: 120,
    listingDescriptionMinLength: 0,
    listingDescriptionMaxLength: 2000,
    reviewMinLength: 10,
    reviewMaxLength: 1000,
    messageMaxLength: 1000,
    searchMaxLength: 100,
    cityQueryMaxLength: 100,
    maxImageCount: 10,
    maxImageSizeBytes: 10 * 1024 * 1024,
    priceMin: 1,
    priceMax: 1_000_000,
    radiusMin: 1,
    radiusMax: 1000,
} as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ALLOWED_IMAGE_EXTENSIONS = [
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.heif',
    '.heic',
];
export const ALLOWED_IMAGE_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/png',
    'image/webp',
    'image/heif',
    'image/heic',
    'image/heif-sequence',
    'image/heic-sequence',
];
export const ALLOWED_IMAGE_FORMATS_LABEL =
    'JPG, JPEG, PNG, WEBP, HEIF и HEIC';
export const IMAGE_UPLOAD_ACCEPT = [
    ...ALLOWED_IMAGE_EXTENSIONS,
    ...ALLOWED_IMAGE_MIME_TYPES,
].join(',');

type TextValidationOptions = {
    label: string;
    minLength: number;
    maxLength: number;
    multiline?: boolean;
};

const formatValidationError = (message: string) =>
    message.replace(/\.+\s*$/, '').trimEnd();

export const normalizeSingleLine = (value: string) =>
    value.replace(/\s+/g, ' ').trim();

export const normalizeMultiline = (value: string) =>
    value
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

const validateText = (
    value: string,
    { label, minLength, maxLength, multiline = false }: TextValidationOptions
) => {
    const normalized = multiline
        ? normalizeMultiline(value)
        : normalizeSingleLine(value);

    if (!normalized) {
        return formatValidationError(
            `Поле "${label}" обязательно для заполнения.`
        );
    }
    if (normalized.length < minLength) {
        return formatValidationError(
            `Поле "${label}" должно содержать минимум ${minLength} символов.`
        );
    }
    if (normalized.length > maxLength) {
        return formatValidationError(
            `Поле "${label}" должно содержать не больше ${maxLength} символов.`
        );
    }

    return null;
};

export const validateEmail = (value: string) => {
    const normalized = value.trim();

    if (!normalized) {
        return 'Укажите email';
    }
    if (normalized.length > VALIDATION_LIMITS.emailMaxLength) {
        return `Email должен содержать не больше ${VALIDATION_LIMITS.emailMaxLength} символов`;
    }
    if (!EMAIL_REGEX.test(normalized)) {
        return 'Введите корректный email';
    }

    return null;
};

export const validatePassword = (value: string) => {
    if (!value) {
        return 'Укажите пароль';
    }
    if (value.length < VALIDATION_LIMITS.passwordMinLength) {
        return `Пароль должен содержать минимум ${VALIDATION_LIMITS.passwordMinLength} символов`;
    }
    if (value.length > VALIDATION_LIMITS.passwordMaxLength) {
        return `Пароль должен содержать не больше ${VALIDATION_LIMITS.passwordMaxLength} символов`;
    }

    return null;
};

export const validateNickname = (value: string) =>
    validateText(value, {
        label: 'Никнейм',
        minLength: VALIDATION_LIMITS.nicknameMinLength,
        maxLength: VALIDATION_LIMITS.nicknameMaxLength,
    });

export const validateEntityName = (label: string, value: string) =>
    validateText(value, {
        label,
        minLength: VALIDATION_LIMITS.entityNameMinLength,
        maxLength: VALIDATION_LIMITS.entityNameMaxLength,
    });

export const validateListingTitle = (value: string) =>
    validateText(value, {
        label: 'Название',
        minLength: VALIDATION_LIMITS.listingTitleMinLength,
        maxLength: VALIDATION_LIMITS.listingTitleMaxLength,
    });

export const validateListingDescription = (value: string) => {
    const normalized = normalizeMultiline(value);

    if (!normalized) {
        return null;
    }
    if (normalized.length > VALIDATION_LIMITS.listingDescriptionMaxLength) {
        return formatValidationError(
            `Поле "Описание" должно содержать не больше ${VALIDATION_LIMITS.listingDescriptionMaxLength} символов.`
        );
    }

    return null;
};

export const validateReviewText = (value: string) =>
    validateText(value, {
        label: 'Отзыв',
        minLength: VALIDATION_LIMITS.reviewMinLength,
        maxLength: VALIDATION_LIMITS.reviewMaxLength,
        multiline: true,
    });

export const validateMessageText = (value: string) =>
    validateText(value, {
        label: 'Сообщение',
        minLength: 1,
        maxLength: VALIDATION_LIMITS.messageMaxLength,
        multiline: true,
    });

export const validateSearchText = (value: string) => {
    const normalized = normalizeSingleLine(value);

    if (!normalized) {
        return null;
    }
    if (normalized.length > VALIDATION_LIMITS.searchMaxLength) {
        return formatValidationError(
            `Поисковый запрос должен содержать не больше ${VALIDATION_LIMITS.searchMaxLength} символов.`
        );
    }

    return null;
};

export const validateCityQuery = (value: string) => {
    const normalized = normalizeSingleLine(value);

    if (!normalized) {
        return null;
    }
    if (normalized.length > VALIDATION_LIMITS.cityQueryMaxLength) {
        return formatValidationError(
            `Название города должно содержать не больше ${VALIDATION_LIMITS.cityQueryMaxLength} символов.`
        );
    }

    return null;
};

export const validatePrice = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) {
        return formatValidationError('Укажите цену.');
    }
    if (!Number.isInteger(value)) {
        return formatValidationError('Цена должна быть целым числом.');
    }
    if (value < VALIDATION_LIMITS.priceMin) {
        return formatValidationError(
            `Цена должна быть не меньше ${VALIDATION_LIMITS.priceMin}.`
        );
    }
    if (value > VALIDATION_LIMITS.priceMax) {
        return formatValidationError(
            `Цена должна быть не больше ${VALIDATION_LIMITS.priceMax}.`
        );
    }

    return null;
};

export const sanitizePriceInput = (value: string) => {
    return value.replace(/\D/g, '');
};

export const parsePriceInput = (value: string) => {
    const normalized = sanitizePriceInput(value);

    if (!normalized) {
        return undefined;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
};

export const formatPriceInput = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) {
        return '';
    }

    return Math.round(value).toString();
};

export const validateOptionalPrice = (value: number | null) => {
    if (value == null) {
        return null;
    }

    return validatePrice(value);
};

export const validateRadius = (value: number | null) => {
    if (value == null) {
        return null;
    }
    if (Number.isNaN(value)) {
        return formatValidationError('Укажите корректный радиус.');
    }
    if (value < VALIDATION_LIMITS.radiusMin) {
        return formatValidationError(
            `Радиус должен быть не меньше ${VALIDATION_LIMITS.radiusMin} км.`
        );
    }
    if (value > VALIDATION_LIMITS.radiusMax) {
        return formatValidationError(
            `Радиус должен быть не больше ${VALIDATION_LIMITS.radiusMax} км.`
        );
    }

    return null;
};

export const validatePriceRange = (
    minPrice: number | null,
    maxPrice: number | null
) => {
    const minError = validateOptionalPrice(minPrice);
    if (minError) {
        return minError;
    }

    const maxError = validateOptionalPrice(maxPrice);
    if (maxError) {
        return maxError;
    }

    if (
        minPrice != null &&
        maxPrice != null &&
        minPrice > maxPrice
    ) {
        return formatValidationError(
            'Минимальная цена не может быть больше максимальной.'
        );
    }

    return null;
};

export const validateRequiredSelection = (
    value: string,
    label: string
) => {
    if (!value) {
        return formatValidationError(`Выберите значение поля "${label}".`);
    }

    return null;
};

export const validateImageFiles = (
    newFiles: File[],
    existingCount = 0
) => {
    if (existingCount + newFiles.length > VALIDATION_LIMITS.maxImageCount) {
        return formatValidationError(
            `Можно загрузить не больше ${VALIDATION_LIMITS.maxImageCount} фотографий.`
        );
    }

    for (const file of newFiles) {
        const extension = file.name
            .slice(file.name.lastIndexOf('.'))
            .toLowerCase();

        if (!ALLOWED_IMAGE_EXTENSIONS.includes(extension)) {
            return formatValidationError(
                `Разрешены файлы ${ALLOWED_IMAGE_FORMATS_LABEL}.`
            );
        }
        if (
            file.type &&
            !ALLOWED_IMAGE_MIME_TYPES.includes(file.type)
        ) {
            return formatValidationError(
                `Разрешены файлы ${ALLOWED_IMAGE_FORMATS_LABEL}.`
            );
        }
        if (file.size > VALIDATION_LIMITS.maxImageSizeBytes) {
            return formatValidationError(
                'Размер одного изображения не должен превышать 10 МБ.'
            );
        }
    }

    return null;
};

const STATUS_CODE_MESSAGE_REGEX = /^Request failed with status code \d+$/;

export const getApiErrorMessage = (
    error: unknown,
    fallbackMessage: string
) => {
    if (typeof error !== 'object' || error === null) {
        return fallbackMessage;
    }

    const response = (
        error as {
            response?: {
                data?: unknown;
            };
            message?: unknown;
        }
    ).response;

    if (typeof response?.data === 'string' && response.data.trim()) {
        return response.data;
    }

    if (
        response?.data &&
        typeof response.data === 'object' &&
        'title' in response.data &&
        typeof response.data.title === 'string'
    ) {
        return response.data.title;
    }

    const message = (error as { message?: unknown }).message;
    if (
        typeof message === 'string' &&
        message.trim() &&
        !STATUS_CODE_MESSAGE_REGEX.test(message)
    ) {
        return message;
    }

    return fallbackMessage;
};
