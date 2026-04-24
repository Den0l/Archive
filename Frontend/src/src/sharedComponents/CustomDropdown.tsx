import { useCallback, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useClickOutside } from '@/sharedComponents/hooks/useClickOutside';

interface CustomDropdownProps {
    options: { id: string; name: string; level?: number }[];
    selectedId: string;
    onSelect: (id: string) => void;
    placeholder?: string;
    isInvalid?: boolean;
}

export default function CustomDropdown({
    options,
    selectedId,
    onSelect,
    placeholder,
    isInvalid = false,
}: CustomDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selected = options.find((option) => option.id === selectedId);
    const closeDropdown = useCallback(() => {
        setIsOpen(false);
    }, []);

    useClickOutside(wrapperRef, closeDropdown);

    return (
        <div
            className="position-relative"
            ref={wrapperRef}
        >
            <div
                className={`form-control d-flex justify-content-between align-items-center ${
                    isInvalid ? 'is-invalid' : ''
                }`}
                style={{ cursor: 'pointer' }}
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <span className={selected ? '' : 'text-muted'}>
                    {selected?.name || placeholder || 'Выберите...'}
                </span>
                <ChevronDown size={18} />
            </div>

            {isOpen && (
                <ul
                    className="list-group position-absolute w-100 mt-1 shadow-sm"
                    style={{
                        zIndex: 1000,
                        borderRadius: '0.375rem',
                    }}
                >
                    {options.map((option) => (
                        <li
                            key={option.id}
                            className="list-group-product list-group-item-action"
                            style={{
                                cursor: 'pointer',
                                paddingLeft: `${1 + (option.level ?? 0) * 1.25}rem`,
                            }}
                            onClick={() => {
                                onSelect(option.id);
                                setIsOpen(false);
                            }}
                        >
                            {option.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
