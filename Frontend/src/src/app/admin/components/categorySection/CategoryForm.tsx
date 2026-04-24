'use client';

import { useState } from 'react';
import {
    normalizeSingleLine,
    validateEntityName,
    VALIDATION_LIMITS,
} from '@/utils/validation';

interface CategoryFormProps {
    onSubmit: (name: string) => boolean | Promise<boolean>;
    initialValue?: string;
    placeholder?: string;
}

export default function CategoryForm({
    onSubmit,
    initialValue = '',
    placeholder = 'Название категории',
}: CategoryFormProps) {
    const [categoryName, setCategoryName] = useState(initialValue);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        const normalizedName = normalizeSingleLine(categoryName);
        const validationError = validateEntityName(
            'Название категории',
            normalizedName
        );

        setCategoryName(normalizedName);
        setError(validationError || '');
        if (validationError) {
            return;
        }

        const isSubmitted = await onSubmit(normalizedName);
        if (isSubmitted) {
            setCategoryName('');
        }
    };

    return (
        <div className="mt-2 admin-create-row admin-category-form">
            <div className="admin-create-row__field">
                <input
                    type="text"
                    className={`form-control admin-create-row__control ${
                        error ? 'is-invalid' : ''
                    }`}
                    value={categoryName}
                    onChange={(e) => {
                        setCategoryName(e.target.value);
                        setError('');
                    }}
                    onBlur={() => {
                        const normalized = normalizeSingleLine(categoryName);
                        setCategoryName(normalized);
                        setError(
                            validateEntityName(
                                'Название категории',
                                normalized
                            ) || ''
                        );
                    }}
                    placeholder={placeholder}
                    minLength={VALIDATION_LIMITS.entityNameMinLength}
                    maxLength={VALIDATION_LIMITS.entityNameMaxLength}
                    aria-invalid={Boolean(error)}
                />
                <div className="invalid-feedback d-block field-error-slot">
                    {error || '\u00A0'}
                </div>
            </div>
            <button
                type="button"
                className="btn btn-success admin-create-row__submit admin-category-form__submit"
                onClick={() => void handleSubmit()}
            >
                Добавить категорию
            </button>
        </div>
    );
}
