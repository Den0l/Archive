'use client';

import { useState } from 'react';
import {
    normalizeSingleLine,
    validateEntityName,
    VALIDATION_LIMITS,
} from '@/utils/validation';

interface ListingPropertyValueFormProps {
    onSubmit: (name: string) => void;
}

export default function ListingPropertyValueForm({
    onSubmit,
}: ListingPropertyValueFormProps) {
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        const normalizedName = normalizeSingleLine(name);
        const validationError = validateEntityName(
            'Название значения',
            normalizedName
        );

        setName(normalizedName);
        setError(validationError || '');
        if (validationError) {
            return;
        }

        onSubmit(normalizedName);
        setName('');
    };

    return (
        <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center gap-2 mt-2">
            <div className="flex-grow-1 w-100">
                <input
                    type="text"
                    className={`form-control flex-grow-1 ${
                        error ? 'is-invalid' : ''
                    }`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => {
                        const normalized = normalizeSingleLine(name);
                        setName(normalized);
                        setError(
                            validateEntityName(
                                'Название значения',
                                normalized
                            ) || ''
                        );
                    }}
                    placeholder="Название значения"
                    minLength={VALIDATION_LIMITS.entityNameMinLength}
                    maxLength={VALIDATION_LIMITS.entityNameMaxLength}
                    aria-invalid={Boolean(error)}
                />
                {error && (
                    <div className="invalid-feedback d-block">{error}</div>
                )}
            </div>
            <button
                type="button"
                className="btn btn-success w-100 w-md-auto"
                onClick={handleSubmit}
            >
                Добавить значение
            </button>
        </div>
    );
}
