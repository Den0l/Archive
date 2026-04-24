'use client';

import { useState } from 'react';
import {
    normalizeSingleLine,
    validateEntityName,
    VALIDATION_LIMITS,
} from '@/utils/validation';

interface ListingPropertyValueFormProps {
    onSubmit: (name: string) => boolean | Promise<boolean>;
}

export default function ListingPropertyValueForm({
    onSubmit,
}: ListingPropertyValueFormProps) {
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async () => {
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

        const isSubmitted = await onSubmit(normalizedName);
        if (isSubmitted) {
            setName('');
        }
    };

    return (
        <div className="mt-2 admin-create-row admin-property-value-form">
            <div className="admin-create-row__field">
                <input
                    type="text"
                    className={`form-control admin-create-row__control ${
                        error ? 'is-invalid' : ''
                    }`}
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        setError('');
                    }}
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
                <div className="invalid-feedback d-block field-error-slot">
                    {error || '\u00A0'}
                </div>
            </div>
            <button
                type="button"
                className="btn btn-success admin-create-row__submit admin-property-value-form__submit"
                onClick={() => void handleSubmit()}
            >
                Добавить значение
            </button>
        </div>
    );
}
