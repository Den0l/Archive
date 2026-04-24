'use client';

import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from 'react';
import Modal from 'react-bootstrap/Modal';
import { requireContext } from '@/context/contextUtils';

type ConfirmVariant = 'primary' | 'danger' | 'secondary';

export type ConfirmDialogOptions = {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmVariant;
};

type ConfirmDialogRequest = Required<ConfirmDialogOptions> & {
    resolve: (value: boolean) => void;
};

type ConfirmDialogContextValue = {
    confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
};

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | undefined>(
    undefined
);

const DEFAULT_OPTIONS: Omit<Required<ConfirmDialogOptions>, 'message'> = {
    title: 'Подтверждение',
    confirmText: 'Подтвердить',
    cancelText: 'Отмена',
    variant: 'primary',
};

const resolveButtonClassName = (variant: ConfirmVariant) => {
    if (variant === 'danger') {
        return 'btn btn-danger';
    }
    if (variant === 'secondary') {
        return 'btn btn-secondary';
    }
    return 'btn btn-primary';
};

export function ConfirmDialogProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [currentRequest, setCurrentRequest] =
        useState<ConfirmDialogRequest | null>(null);
    const queueRef = useRef<ConfirmDialogRequest[]>([]);

    const finalizeRequest = useCallback((result: boolean) => {
        setCurrentRequest((prev) => {
            if (!prev) {
                return prev;
            }

            prev.resolve(result);
            return queueRef.current.shift() ?? null;
        });
    }, []);

    const confirm = useCallback((options: ConfirmDialogOptions) => {
        const normalizedOptions: ConfirmDialogRequest = {
            ...DEFAULT_OPTIONS,
            ...options,
            resolve: () => {},
        };

        return new Promise<boolean>((resolve) => {
            const request: ConfirmDialogRequest = {
                ...normalizedOptions,
                resolve,
            };

            setCurrentRequest((prev) => {
                if (prev) {
                    queueRef.current.push(request);
                    return prev;
                }

                return request;
            });
        });
    }, []);

    const value = useMemo<ConfirmDialogContextValue>(
        () => ({
            confirm,
        }),
        [confirm]
    );

    return (
        <ConfirmDialogContext.Provider value={value}>
            {children}
            <Modal
                show={Boolean(currentRequest)}
                onHide={() => finalizeRequest(false)}
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title>{currentRequest?.title}</Modal.Title>
                </Modal.Header>
                <Modal.Body>{currentRequest?.message}</Modal.Body>
                <Modal.Footer>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => finalizeRequest(false)}
                    >
                        {currentRequest?.cancelText}
                    </button>
                    <button
                        type="button"
                        className={resolveButtonClassName(
                            currentRequest?.variant ?? 'primary'
                        )}
                        onClick={() => finalizeRequest(true)}
                    >
                        {currentRequest?.confirmText}
                    </button>
                </Modal.Footer>
            </Modal>
        </ConfirmDialogContext.Provider>
    );
}

export const useConfirmDialog = () => {
    return requireContext(
        useContext(ConfirmDialogContext),
        'useConfirmDialog',
        'ConfirmDialogProvider'
    );
};
