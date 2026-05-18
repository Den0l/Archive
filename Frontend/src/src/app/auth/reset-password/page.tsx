'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNotification } from '@/context/NotificationContext';
import { resetPassword } from '@/services/authService';
import {
    getApiErrorMessage,
    validateEmail,
    validatePassword,
    VALIDATION_LIMITS,
} from '@/utils/validation';

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { addNotification } = useNotification();

    const email = useMemo(
        () => (searchParams.get('email') ?? '').trim(),
        [searchParams]
    );
    const token = useMemo(
        () => searchParams.get('token') ?? '',
        [searchParams]
    );

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{
        newPassword?: string;
        confirmPassword?: string;
    }>({});
    const [loading, setLoading] = useState(false);

    const linkInvalid = !email || !token || Boolean(validateEmail(email));

    useEffect(() => {
        if (linkInvalid) {
            addNotification(
                'Ссылка для сброса пароля недействительна или устарела.',
                { level: 'error', importance: 'high' }
            );
        }
    }, [linkInvalid, addNotification]);

    const handleSubmit = async (event: { preventDefault: () => void }) => {
        event.preventDefault();
        if (linkInvalid) {
            return;
        }

        const passwordError = validatePassword(newPassword);
        const confirmError =
            newPassword === confirmPassword ? undefined : 'Пароли не совпадают';
        const nextErrors = {
            newPassword: passwordError || undefined,
            confirmPassword: confirmError,
        };
        setFieldErrors(nextErrors);
        if (Object.values(nextErrors).some(Boolean)) {
            return;
        }

        setLoading(true);
        try {
            await resetPassword({ email, token, newPassword });
            addNotification(
                'Пароль успешно изменён. Войдите с новым паролем.',
                { level: 'success' }
            );
            router.push('/auth/login');
        } catch (err) {
            addNotification(
                getApiErrorMessage(
                    err,
                    'Не удалось сбросить пароль. Возможно, ссылка устарела - запросите новую.'
                ),
                { level: 'error', importance: 'high' }
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container-login mt-5">
            <h1 className="text-center">Сброс пароля</h1>

            {linkInvalid ? (
                <div className="text-center mt-4">
                    <p className="text-muted">
                        Ссылка для сброса пароля недействительна.
                    </p>
                    <Link href="/auth/login" className="link-primary">
                        Вернуться на страницу входа
                    </Link>
                </div>
            ) : (
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            className="form-control"
                            value={email}
                            disabled
                            readOnly
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="new-password">Новый пароль</label>
                        <input
                            type="password"
                            id="new-password"
                            className={`form-control ${
                                fieldErrors.newPassword ? 'is-invalid' : ''
                            }`}
                            value={newPassword}
                            onChange={(event) => {
                                setNewPassword(event.target.value);
                                setFieldErrors((prev) => ({
                                    ...prev,
                                    newPassword: undefined,
                                }));
                            }}
                            onBlur={() =>
                                setFieldErrors((prev) => ({
                                    ...prev,
                                    newPassword:
                                        validatePassword(newPassword) ||
                                        undefined,
                                }))
                            }
                            minLength={VALIDATION_LIMITS.passwordMinLength}
                            maxLength={VALIDATION_LIMITS.passwordMaxLength}
                            placeholder="Введите новый пароль"
                            autoComplete="new-password"
                            disabled={loading}
                            required
                        />
                        <div className="invalid-feedback d-block field-error-slot">
                            {fieldErrors.newPassword || '\u00A0'}
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirm-password">
                            Подтверждение пароля
                        </label>
                        <input
                            type="password"
                            id="confirm-password"
                            className={`form-control ${
                                fieldErrors.confirmPassword ? 'is-invalid' : ''
                            }`}
                            value={confirmPassword}
                            onChange={(event) => {
                                setConfirmPassword(event.target.value);
                                setFieldErrors((prev) => ({
                                    ...prev,
                                    confirmPassword: undefined,
                                }));
                            }}
                            onBlur={() =>
                                setFieldErrors((prev) => ({
                                    ...prev,
                                    confirmPassword:
                                        newPassword === confirmPassword
                                            ? undefined
                                            : 'Пароли не совпадают',
                                }))
                            }
                            minLength={VALIDATION_LIMITS.passwordMinLength}
                            maxLength={VALIDATION_LIMITS.passwordMaxLength}
                            placeholder="Повторите новый пароль"
                            autoComplete="new-password"
                            disabled={loading}
                            required
                        />
                        <div className="invalid-feedback d-block field-error-slot">
                            {fieldErrors.confirmPassword || '\u00A0'}
                        </div>
                    </div>
                    <div className="d-flex justify-content-center">
                        <button
                            type="submit"
                            className="btn btn-primary mt-2 mb-3"
                            disabled={loading}
                        >
                            {loading ? 'Сохранение...' : 'Установить пароль'}
                        </button>
                    </div>

                    <div className="text-center mt-2">
                        <Link href="/auth/login" className="link-primary">
                            Вернуться на страницу входа
                        </Link>
                    </div>
                </form>
            )}
        </div>
    );
}

function ResetPasswordFallback() {
    return (
        <div className="container-login mt-5">
            <h1 className="text-center">Сброс пароля</h1>
            <p className="text-center text-muted mt-4">
                Подготавливаем форму сброса пароля...
            </p>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<ResetPasswordFallback />}>
            <ResetPasswordContent />
        </Suspense>
    );
}
