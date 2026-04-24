'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeSingleLine } from '@/utils/validation';
import { useClickOutside } from '@/sharedComponents/hooks/useClickOutside';

interface SearchableDropdownProps {
    options: { id: string; name: string }[];
    selectedId: string;
    onSelect: (id: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    isInvalid?: boolean;
}

export default function SearchableDropdown({
    options,
    selectedId,
    onSelect,
    placeholder,
    searchPlaceholder = 'Введите для поиска...',
    isInvalid = false,
}: SearchableDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selected = useMemo(
        () => options.find((option) => option.id === selectedId),
        [options, selectedId]
    );

    useEffect(() => {
        if (selected?.name) {
            setInputValue(selected.name);
        }
    }, [selected?.name]);

    const closeDropdown = useCallback(() => {
        setIsOpen(false);
    }, []);

    useClickOutside(wrapperRef, closeDropdown);

    const filteredOptions = useMemo(() => {
        const normalized = normalizeSingleLine(inputValue).toLowerCase();
        if (!normalized) {
            return options;
        }
        return options.filter((option) =>
            option.name.toLowerCase().includes(normalized)
        );
    }, [inputValue, options]);

    const handleSelect = (id: string, name: string) => {
        setInputValue(name);
        onSelect(id);
        setIsOpen(false);
    };

    const handleBlur = () => {
        const normalized = normalizeSingleLine(inputValue).toLowerCase();
        if (!normalized) {
            return;
        }
        const match = options.find(
            (option) => option.name.toLowerCase() === normalized
        );
        if (match) {
            onSelect(match.id);
            setInputValue(match.name);
        }
    };

    return (
        <div
            className="position-relative"
            ref={wrapperRef}
        >
            <input
                type="text"
                className={`form-control ${isInvalid ? 'is-invalid' : ''}`}
                value={inputValue}
                placeholder={placeholder || 'Выберите...'}
                onChange={(event) => {
                    setInputValue(event.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                onClick={() => setIsOpen(true)}
                onBlur={handleBlur}
            />

            {isOpen && (
                <ul
                    className="list-group position-absolute w-100 mt-1 shadow-sm"
                    style={{
                        zIndex: 1000,
                        borderRadius: '0.375rem',
                    }}
                >
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((option) => (
                            <li
                                key={option.id}
                                className="list-group-product list-group-item-action"
                                style={{ cursor: 'pointer' }}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() =>
                                    handleSelect(option.id, option.name)
                                }
                            >
                                {option.name}
                            </li>
                        ))
                    ) : (
                        <li className="list-group-item text-muted">
                            {searchPlaceholder || 'Нет совпадений.'}
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}
