'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmEmailChange } from '@/services/authService';
import { removeToken } from '@/services/tokenService';
import { getApiErrorMessage } from '@/utils/validation';

type ConfirmationStatus = 'loading' | 'success' | 'error';

function ConfirmEmailChangeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<ConfirmationStatus>('loading');
    const [message, setMessage] = useState('Подтверждаем новый e-mail...');

    useEffect(() => {
        const userId = searchParams.get('userId');
        const newEmail = searchParams.get('email');
        const token = searchParams.get('token');

        if (!userId || !newEmail || !token) {
            setStatus('error');
            setMessage('Ссылка для подтверждения почты повреждена или неполная.');
            return;
        }

        let isActive = true;
        const confirm = async () => {
            try {
                await confirmEmailChange({
                    userId,
                    newEmail,
                    token,
                });

                removeToken();

                if (!isActive) {
                    return;
                }

                setStatus('success');
                setMessage(
                    'Новая почта подтверждена. Сейчас перенаправим вас на страницу входа.'
                );

                window.setTimeout(() => {
                    router.replace('/auth/login');
                }, 1800);
            } catch (error) {
                if (!isActive) {
                    return;
                }

                setStatus('error');
                setMessage(
                    getApiErrorMessage(
                        error,
                        'Не удалось подтвердить новый e-mail.'
                    )
                );
            }
        };

        void confirm();

        return () => {
            isActive = false;
        };
    }, [router, searchParams]);

    return (
        <div className="container my-5" style={{ maxWidth: 720 }}>
            <div className="card shadow-sm border-0">
                <div className="card-body p-5 text-center">
                    <h1 className="h3 mb-3">Подтверждение новой почты</h1>
                    <p
                        className={
                            status === 'error' ? 'text-danger mb-4' : 'mb-4'
                        }
                    >
                        {message}
                    </p>
                    {status === 'loading' && (
                        <div className="spinner-border" role="status">
                            <span className="visually-hidden">Загрузка</span>
                        </div>
                    )}
                    {status !== 'loading' && (
                        <Link href="/auth/login" className="btn btn-primary">
                            Перейти ко входу
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ConfirmEmailChangePage() {
    return (
        <Suspense
            fallback={
                <div className="container my-5" style={{ maxWidth: 720 }}>
                    <div className="card shadow-sm border-0">
                        <div className="card-body p-5 text-center">
                            <h1 className="h3 mb-3">Подтверждение новой почты</h1>
                            <p className="mb-0">Подготавливаем подтверждение...</p>
                        </div>
                    </div>
                </div>
            }
        >
            <ConfirmEmailChangeContent />
        </Suspense>
    );
}
