'use client';

import { useState } from 'react';
import {
    normalizeSingleLine,
    validateEntityName,
    VALIDATION_LIMITS,
} from '@/utils/validation';

interface ListingPropertyFormProps {
    onSubmit: (name: string) => void;
}

export default function ListingPropertyForm({
    onSubmit,
}: ListingPropertyFormProps) {
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        const normalizedName = normalizeSingleLine(name);
        const validationError = validateEntityName(
            'Название характеристики',
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
        <div className="d-flex mt-2">
            <div className="flex-grow-1">
                <input
                    type="text"
                    className={`form-control ${error ? 'is-invalid' : ''}`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => {
                        const normalized = normalizeSingleLine(name);
                        setName(normalized);
                        setError(
                            validateEntityName(
                                'Название характеристики',
                                normalized
                            ) || ''
                        );
                    }}
                    placeholder="Название характеристики"
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
                className="btn btn-primary ml-2"
                onClick={handleSubmit}
            >
                Добавить характеристику
            </button>
        </div>
    );
}
