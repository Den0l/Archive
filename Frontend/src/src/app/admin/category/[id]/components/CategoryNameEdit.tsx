'use client';

import { useState } from 'react';
import {
    normalizeSingleLine,
    validateEntityName,
    VALIDATION_LIMITS,
} from '@/utils/validation';

interface CategoryNameEditProps {
    categoryName: string;
    onSave: (newName: string) => void;
}

export default function CategoryNameEdit({
    categoryName,
    onSave,
}: CategoryNameEditProps) {
    const [name, setName] = useState(categoryName);
    const [error, setError] = useState('');

    const handleSave = () => {
        const normalizedName = normalizeSingleLine(name);
        const validationError = validateEntityName(
            'Название категории',
            normalizedName
        );

        setName(normalizedName);
        setError(validationError || '');
        if (validationError) {
            return;
        }

        onSave(normalizedName);
    };

    return (
        <div className="mt-4">
            <label htmlFor="categoryName">Редактирование названия категории</label>
            <input
                type="text"
                className={`form-control ${error ? 'is-invalid' : ''}`}
                id="categoryName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                    const normalized = normalizeSingleLine(name);
                    setName(normalized);
                    setError(
                        validateEntityName(
                            'Название категории',
                            normalized
                        ) || ''
                    );
                }}
                minLength={VALIDATION_LIMITS.entityNameMinLength}
                maxLength={VALIDATION_LIMITS.entityNameMaxLength}
                aria-invalid={Boolean(error)}
            />
            {error && (
                <div className="invalid-feedback d-block">{error}</div>
            )}
            <button
                className="btn btn-primary mt-2"
                onClick={handleSave}
            >
                Сохранить
            </button>
        </div>
    );
}
