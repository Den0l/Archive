'use client';

import { useState } from 'react';
import {
    normalizeSingleLine,
    validateEntityName,
    VALIDATION_LIMITS,
} from '@/utils/validation';

interface CategoryFormProps {
    onSubmit: (name: string) => void;
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

    const handleSubmit = () => {
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

        onSubmit(normalizedName);
        setCategoryName('');
    };

    return (
        <div className="mt-2">
            <input
                type="text"
                className={`form-control ${error ? 'is-invalid' : ''}`}
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
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
            {error && (
                <div className="invalid-feedback d-block">{error}</div>
            )}
            <button
                type="button"
                className="btn btn-success ml-2"
                onClick={handleSubmit}
            >
                Добавить категорию
            </button>
        </div>
    );
}
