'use client';

import { useEffect, useRef, useState } from 'react';

interface AdminActionsMenuProps {
    children: React.ReactNode;
    className?: string;
    buttonLabel?: string;
}

export default function AdminActionsMenu({
    children,
    className = '',
    buttonLabel = 'Действия',
}: AdminActionsMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            if (!isOpen) {
                return;
            }

            const target = event.target as Node | null;
            if (!target || !rootRef.current?.contains(target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [isOpen]);

    return (
        <div
            ref={rootRef}
            className={`admin-actions-menu ${
                isOpen ? 'admin-actions-menu--open' : ''
            } ${className}`.trim()}
        >
            <button
                type="button"
                className="btn btn-sm btn-outline-secondary admin-actions-menu__trigger"
                aria-label={buttonLabel}
                aria-expanded={isOpen}
                onClick={() => setIsOpen((prev) => !prev)}
            >
                ⋯
            </button>
            <div className="admin-actions-menu__panel">{children}</div>
        </div>
    );
}

