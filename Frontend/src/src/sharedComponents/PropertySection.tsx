import { useEffect, useState } from 'react';

interface PropertySectionProps {
    name: string;
    values: { id: string; name: string }[];
    selected: string[];
    onToggle: (id: string) => void;
}

export default function PropertySection({
    name,
    values,
    selected,
    onToggle,
}: PropertySectionProps) {
    const [open, setOpen] = useState(false);
    return (
        <div className="mb-2">
            <h5
                className="mb-1"
                style={{ cursor: 'pointer' }}
                onClick={() => setOpen((o) => !o)}
            >
                {name}
                <span className="ms-2">{open ? '▾' : '▸'}</span>
            </h5>
            {open && (
                <div className="ps-4">
                    {values.map((v) => (
                        <div
                            key={v.id}
                            className="form-check"
                        >
                            <input
                                id={v.id}
                                type="checkbox"
                                className="form-check-input"
                                checked={selected.includes(v.id)}
                                onChange={() => onToggle(v.id)}
                            />
                            <label
                                htmlFor={v.id}
                                className="form-check-label"
                            >
                                {v.name}
                            </label>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
