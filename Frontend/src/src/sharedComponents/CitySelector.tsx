'use client';

import React, { useState, useEffect, useRef } from 'react';
import { City } from '@/types/api/cities';
import { fetchCities } from '@/services/cityService';
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

    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (
                wrapperRef.current &&
                !wrapperRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('click', onClickOutside);
        return () => document.removeEventListener('click', onClickOutside);
    }, []);

    const filterCities = (term: string, cities: City[]) => {
        const normalizedTerm = normalizeSingleLine(term).toLowerCase();
        if (!normalizedTerm) {
            return cities;
        }
        return cities.filter((city) =>
            city.name.toLowerCase().includes(normalizedTerm)
        );
    };

    const loadAllCities = async () => {
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
    };

    const updateSuggestions = async (term: string) => {
        const normalizedTerm = normalizeSingleLine(term);
        const validationError = validateCityQuery(normalizedTerm);
        setError(validationError || '');

        if (validationError) {
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
    }, [selectedCityId, allCities]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        updateSuggestions(val);
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
            className="position-relative"
            ref={wrapperRef}
        >
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

            {displayError && (
                <div className="invalid-feedback d-block text-danger">
                    <span className="d-block">{displayError}</span>
                </div>
            )}

            {isOpen && suggestions.length > 0 && (
                <ul
                    className="list-group position-absolute w-100"
                    style={{ zIndex: 1000 }}
                >
                    {suggestions.map((city) => (
                        <li
                            key={city.id}
                            className="list-group-city list-group-item-action"
                            onClick={() => handleSelect(city)}
                            style={{ cursor: 'pointer' }}
                        >
                            {city.name} ({city.zipCode}), {city.district},{' '}
                            {city.region}
                        </li>
                    ))}
                </ul>
            )}

            {loading && (
                <div className="position-absolute mt-1 text-muted">
                    Загрузка...
                </div>
            )}
        </div>
    );
}
