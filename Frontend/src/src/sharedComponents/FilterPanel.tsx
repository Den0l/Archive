'use client';

import { useEffect, useState } from 'react';
import CitySelector from './CitySelector';
import { City } from '@/types/api/cities';
import { StateOfItem } from '@/types/api/stateOfItem';
import {
    CategoryDetail,
    ListingFilter,
    Ordering,
    OrderingDirection,
} from '@/types/api/categories';
import PropertySection from './PropertySection';
import { fetchCategoryByName } from '@/services/categoryService';
import { fetchStatesOfItem } from '@/services/stateOfItemService';
import {
    normalizeSingleLine,
    validatePriceRange,
    validateRadius,
    validateSearchText,
    VALIDATION_LIMITS,
} from '@/utils/validation';

interface FilterPanelProps {
    categoryName: string | null;
    priceEnabled?: boolean;
    stateOfItemEnabled?: boolean;
    listingPropertiesEnabled?: boolean;
    cityEnabled?: boolean;
    radiusEnabled?: boolean;
    searchEnabled?: boolean;
    orderingEnabled?: boolean;
    onFilterSubmit: (filter: ListingFilter) => void;
}

export function FilterPanel({
    categoryName,
    priceEnabled = true,
    stateOfItemEnabled = false,
    listingPropertiesEnabled = false,
    cityEnabled = false,
    radiusEnabled = false,
    searchEnabled = false,
    orderingEnabled = true,
    onFilterSubmit,
}: FilterPanelProps) {
    // current filter state
    const [priceMin, setPriceMin] = useState<number | null>(null);
    const [priceMax, setPriceMax] = useState<number | null>(null);
    const [selectedStates, setSelectedStates] = useState<string[]>([]);
    const [selectedPropertyValues, setSelectedPropertyValues] = useState<
        string[]
    >([]);
    const [city, setCity] = useState<City | null>(null);
    const [radius, setRadius] = useState<number | null>(null);
    const [search, setSearch] = useState<string | null>(null);
    const [ordering, setOrdering] = useState<Ordering>(Ordering.CreatedAt);
    const [orderingDirection, setOrderingDirection] =
        useState<OrderingDirection>(OrderingDirection.Descending);
    const [filterError, setFilterError] = useState('');

    // filter options for state of item and properties of category
    const [statesOfItem, setStatesOfItem] = useState<StateOfItem[]>([]);
    const [categoryDetail, setCategoryDetail] = useState<CategoryDetail | null>(
        null
    );

    // styling of collapsible filters
    const [showProperties, setShowProperties] = useState(false);

    useEffect(() => {
        if (categoryName && listingPropertiesEnabled) {
            fetchCategoryByName(categoryName)
                .then((data) => setCategoryDetail(data))
                .catch(console.error);
        }
        if (stateOfItemEnabled) {
            fetchStatesOfItem()
                .then((data) => setStatesOfItem(data))
                .catch(console.error);
        }
    }, [categoryName, listingPropertiesEnabled, stateOfItemEnabled]);

    const apply = () => {
        const normalizedSearch = normalizeSingleLine(search ?? '');
        const searchError = validateSearchText(normalizedSearch);
        const priceError = validatePriceRange(priceMin, priceMax);
        const radiusError = validateRadius(radius);
        const nextError = searchError || priceError || radiusError || '';

        setSearch(normalizedSearch || null);
        setFilterError(nextError);
        if (nextError) {
            return;
        }

        onFilterSubmit({
            priceMin,
            priceMax,
            sellerId: null,
            cityId: city?.id ?? null,
            radius,
            search: normalizedSearch || null,
            ordering,
            orderingDirection: orderingDirection,
            stateOfItemIds: selectedStates,
            selectedListingPropertyValueIds: selectedPropertyValues,
        });
    };
    const toggleState = (id: string) =>
        setSelectedStates((s) =>
            s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
        );
    const toggleProp = (id: string) =>
        setSelectedPropertyValues((p) =>
            p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
        );
    return (
        <div className="filter-panel">
            {orderingEnabled && (
                <div className="mb-3">
                    <h3>Сортировка</h3>
                    <div className="d-flex gap-2 mb-1">
                        <button
                            className={
                                ordering === Ordering.CreatedAt
                                    ? 'btn btn-primary'
                                    : 'btn btn-outline-secondary'
                            }
                            onClick={() => setOrdering(Ordering.CreatedAt)}
                        >
                            Дата
                        </button>
                        <button
                            className={
                                ordering === Ordering.Price
                                    ? 'btn btn-primary'
                                    : 'btn btn-outline-secondary'
                            }
                            onClick={() => setOrdering(Ordering.Price)}
                        >
                            Цена
                        </button>
                    </div>
                    <div className="d-flex gap-2">
                        <button
                            className={
                                orderingDirection ===
                                OrderingDirection.Ascending
                                    ? 'btn btn-primary'
                                    : 'btn btn-outline-secondary'
                            }
                            onClick={() =>
                                setOrderingDirection(
                                    OrderingDirection.Ascending
                                )
                            }
                        >
                            ↑
                        </button>
                        <button
                            className={
                                orderingDirection ===
                                OrderingDirection.Descending
                                    ? 'btn btn-primary'
                                    : 'btn btn-outline-secondary'
                            }
                            onClick={() =>
                                setOrderingDirection(
                                    OrderingDirection.Descending
                                )
                            }
                        >
                            ↓
                        </button>
                    </div>
                </div>
            )}

            {priceEnabled && (
                <div className="mb-3">
                    <h3>Цена</h3>
                    <input
                        type="number"
                        placeholder="Мин"
                        className="form-control"
                        value={priceMin ?? ''}
                        onChange={(e) =>
                            setPriceMin(
                                e.target.value ? Number(e.target.value) : null
                            )
                        }
                        min={VALIDATION_LIMITS.priceMin}
                        max={VALIDATION_LIMITS.priceMax}
                        step="0.01"
                    />
                    <input
                        type="number"
                        placeholder="Макс"
                        className="form-control"
                        value={priceMax ?? ''}
                        onChange={(e) =>
                            setPriceMax(
                                e.target.value ? Number(e.target.value) : null
                            )
                        }
                        min={VALIDATION_LIMITS.priceMin}
                        max={VALIDATION_LIMITS.priceMax}
                        step="0.01"
                    />
                </div>
            )}

            {searchEnabled && (
                <div className="mb-3">
                    <h3>Поиск</h3>
                    <input
                        placeholder="Введите название"
                        type="text"
                        className="form-control"
                        value={search ?? ''}
                        onChange={(e) => setSearch(e.target.value || null)}
                        onBlur={() =>
                            setSearch(normalizeSingleLine(search ?? '') || null)
                        }
                        maxLength={VALIDATION_LIMITS.searchMaxLength}
                    />
                </div>
            )}

            {cityEnabled && (
                <div className="mb-3">
                    <h3>Город</h3>
                    <CitySelector
                        onCitySelect={setCity}
                        placeholder="Выберите город"
                    />
                </div>
            )}

            {radiusEnabled && (
                <div className="mb-3">
                    <h3>Радиус (км)</h3>
                    <input
                        type="number"
                        className="form-control"
                        value={radius ?? ''}
                        onChange={(e) =>
                            setRadius(
                                e.target.value ? Number(e.target.value) : null
                            )
                        }
                        min={VALIDATION_LIMITS.radiusMin}
                        max={VALIDATION_LIMITS.radiusMax}
                        step="1"
                    />
                </div>
            )}

            {stateOfItemEnabled && (
                <div className="mb-3">
                    <h3>
                        Состояние товара:
                    </h3>
                    <div className="ps-2">
                        {statesOfItem.map((s) => (
                            <div
                                key={s.id}
                                className="form-check"
                            >
                                <input
                                    id={s.id}
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={selectedStates.includes(s.id)}
                                    onChange={() => toggleState(s.id)}
                                />
                                <label
                                    htmlFor={s.id}
                                    className="form-check-label"
                                >
                                    {s.name}
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {listingPropertiesEnabled && categoryDetail && (
                <div className="mb-3">
                    <h3
                        style={{ cursor: 'pointer' }}
                        onClick={() => setShowProperties((p) => !p)}
                    >
                        Параметры{' '}
                        <span className="ms-2">
                            {showProperties ? '▾' : '▸'}
                        </span>
                    </h3>
                    {showProperties && (
                        <div className="ps-2">
                            {categoryDetail.listingProperties.map((prop) => (
                                <PropertySection
                                    key={prop.id}
                                    name={prop.name}
                                    values={prop.listingPropertyValues.map(
                                        (v) => ({ id: v.id, name: v.name })
                                    )}
                                    selected={selectedPropertyValues}
                                    onToggle={toggleProp}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
            {filterError && (
                <div className="text-danger mb-2">{filterError}</div>
            )}
            <button
                className="btn btn-outline-secondary"
                onClick={apply}
            >
                Применить
            </button>
        </div>
    );
}
