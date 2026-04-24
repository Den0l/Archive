'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { City } from '@/types/api/cities';
import { fetchCities } from '@/services/cityService';
import { useClickOutside } from '@/sharedComponents/hooks/useClickOutside';
import {
    normalizeSingleLine,
    validateCityQuery,
    VALIDATION_LIMITS,
} from '@/utils/validation';

interface CitySelectorProps {
    selectedCityId?: string;
    onCitySelect: (city: City) => void;
    placeholder?: string;
    validationError?: string;
}

export default function CitySelector({
    selectedCityId,
    onCitySelect,
    placeholder = '',
    validationError,
}: CitySelectorProps) {
    const [inputValue, setInputValue] = useState('');
    const [allCities, setAllCities] = useState<City[]>([]);
    const [suggestions, setSuggestions] = useState<City[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const loadingPromiseRef = useRef<Promise<City[]> | null>(null);
    const closeSuggestions = useCallback(() => {
        setIsOpen(false);
    }, []);

    useClickOutside(wrapperRef, closeSuggestions, 'click');

    const filterCities = (term: string, cities: City[]) => {
        const normalizedTerm = normalizeSingleLine(term).toLowerCase();
        if (!normalizedTerm) {
            return cities;
        }
        return cities.filter((city) =>
            city.name.toLowerCase().includes(normalizedTerm)
        );
    };

    const loadAllCities = useCallback(async () => {
        if (allCities.length > 0) {
            return allCities;
        }
        if (loadingPromiseRef.current) {
            return loadingPromiseRef.current;
        }
        setLoading(true);
        const promise = fetchCities('')
            .then((cities) => {
                setAllCities(cities);
                return cities;
            })
            .catch((err) => {
                console.error('Error fetching cities:', err);
                return [];
            })
            .finally(() => {
                setLoading(false);
                loadingPromiseRef.current = null;
            });
        loadingPromiseRef.current = promise;
        return promise;
    }, [allCities]);

    const updateSuggestions = async (
        term: string,
        suppressValidationError = false
    ) => {
        const normalizedTerm = normalizeSingleLine(term);
        const validationMessage = validateCityQuery(normalizedTerm);
        if (!suppressValidationError) {
            setError(validationMessage || '');
        }

        if (validationMessage) {
            setSuggestions([]);
            setIsOpen(false);
            return;
        }

        const cities = await loadAllCities();
        if (cities.length > 0) {
            setSuggestions(filterCities(normalizedTerm, cities));
            setIsOpen(true);
            return;
        }

        setLoading(true);
        try {
            const filtered = await fetchCities(normalizedTerm);
            setSuggestions(filtered);
            setIsOpen(true);
        } catch (err) {
            console.error('Error fetching cities:', err);
            setSuggestions([]);
            setIsOpen(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedCityId) {
            return;
        }

        if (allCities.length > 0) {
            const selectedCity = allCities.find(
                (city) => city.id === selectedCityId
            );
            if (selectedCity) {
                setInputValue(selectedCity.name);
            }
            return;
        }

        loadAllCities().then((cities) => {
            const selectedCity = cities.find(
                (city) => city.id === selectedCityId
            );
            if (selectedCity) {
                setInputValue(selectedCity.name);
            }
        });
    }, [selectedCityId, allCities, loadAllCities]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        setError('');
        updateSuggestions(val, true);
    };

    const handleSelect = (city: City) => {
        setInputValue(city.name);
        setError('');
        setIsOpen(false);
        onCitySelect(city);
    };

    const displayError = validationError || error;

    return (
        <div
            className="city-selector"
            ref={wrapperRef}
        >
            <div className="position-relative">
                <input
                    type="text"
                    className={`form-control ${displayError ? 'is-invalid' : ''}`}
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={handleChange}
                    onBlur={() => {
                        const normalized = normalizeSingleLine(inputValue);
                        setInputValue(normalized);
                        setError(validateCityQuery(normalized) || '');
                    }}
                    onFocus={() => {
                        updateSuggestions(inputValue);
                    }}
                    maxLength={VALIDATION_LIMITS.cityQueryMaxLength}
                    aria-invalid={Boolean(displayError)}
                />

                {isOpen && suggestions.length > 0 && (
                    <ul
                        className="list-group position-absolute w-100"
                        style={{
                            zIndex: 1000,
                            top: 'calc(100% + 0.25rem)',
                            left: 0,
                        }}
                    >
                        {suggestions.map((city) => (
                            <li
                                key={city.id}
                                className="list-group-city list-group-item-action"
                                onClick={() => handleSelect(city)}
                                style={{ cursor: 'pointer' }}
                            >
                                {city.name},{' '}
                                {city.region}
                            </li>
                        ))}
                    </ul>
                )}

                {loading && (
                    <div
                        className="position-absolute text-muted"
                        style={{ top: 'calc(100% + 0.25rem)', left: 0 }}
                    >
                        Загрузка...
                    </div>
                )}
            </div>

            <div className="invalid-feedback d-block text-danger field-error-slot">
                <span className="d-block">{displayError || '\u00A0'}</span>
            </div>
        </div>
    );
}
