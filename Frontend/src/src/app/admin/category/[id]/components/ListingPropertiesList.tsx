'use client';

import { ListingProperty } from '@/types/api/listingProperties';
import AdminActionsMenu from '@/app/admin/components/AdminActionsMenu';

interface ListingPropertiesListProps {
    listingProperties: ListingProperty[];
    onRemove: (propertyId: string) => void;
}

export default function ListingPropertiesList({
    listingProperties,
    onRemove,
}: ListingPropertiesListProps) {
    return (
        <div>
            <ul className="p-0 m-0 admin-category-property-list">
                {listingProperties.map((property, index) => (
                    <li
                        key={property.id}
                        className={`
            d-flex justify-content-between align-items-center admin-category-property-row
            py-2 ${index < listingProperties.length - 1 ? 'border-bottom' : ''}
          `}
                    >
                        <span className="admin-category-property-row__name">
                            {property.name}
                        </span>
                        <AdminActionsMenu className="admin-category-property-row__actions">
                            <button
                                className="btn btn-sm btn-outline-danger admin-category-property-row__button"
                                onClick={() => onRemove(property.id)}
                            >
                                Удалить
                            </button>
                        </AdminActionsMenu>
                    </li>
                ))}
                {listingProperties.length === 0 && (
                    <li className="text-center text-muted py-2">
                        Нету категорий
                    </li>
                )}
            </ul>
        </div>
    );
}