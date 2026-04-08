'use client';
import { ListingProperty } from '@/types/api/listingProperties';

interface AvailablePropertiesListProps {
    availableProperties: ListingProperty[];
    selectedProperties: string[];
    onCheckboxChange: (propertyId: string) => void;
    onAdd: () => void;
}

export default function AvailablePropertiesList({
    availableProperties,
    selectedProperties,
    onCheckboxChange,
    onAdd,
}: AvailablePropertiesListProps) {
    return (
        <div className="mt-4">
            <ul className="list-unstyled p-0 m-0">
                {availableProperties.map((property, index) => (
                    <li
                        key={property.id}
                        className={`
          d-flex justify-content-between align-items-center
          py-2 ${index < availableProperties.length - 1 ? 'border-bottom' : ''}
        `}
                    >
                        <div className="form-check d-flex align-items-center">
                            <input
                                className="form-check-input me-2"
                                type="checkbox"
                                checked={selectedProperties.includes(
                                    property.id
                                )}
                                onChange={() => onCheckboxChange(property.id)}
                                id={`prop-${property.id}`}
                            />
                            <label
                                className="form-check-label"
                                htmlFor={`prop-${property.id}`}
                            >
                                {property.name}
                            </label>
                        </div>
                    </li>
                ))}
                {availableProperties.length === 0 && (
                    <li className="text-center text-muted py-2">
                        Нет доступных характеристик.
                    </li>
                )}
            </ul>

            <div className="mt-3 text-end">
                <button
                    className="btn btn-success"
                    onClick={onAdd}
                    disabled={selectedProperties.length === 0}
                >
                    Добавить Выбранные характеристики
                </button>
            </div>
        </div>
    );
}
