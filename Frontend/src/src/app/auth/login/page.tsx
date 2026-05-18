'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from 'react-bootstrap/Modal';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { forgotPassword } from '@/services/authService';
import {
    getApiErrorMessage,
    validateEmail,
    validatePassword,
    VALIDATION_LIMITS,
} from '@/utils/validation';

export default function Login() {
    const { login } = useAuth();
    const { addNotification } = useNotification();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{
        username?: string;
        password?: string;
    }>({});
    const router = useRouter();
    const [loading, setLoading] = useState<boolean>(false);

    const [showForgotModal, setShowForgotModal] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotEmailError, setForgotEmailError] = useState<string | null>(null);
    const [forgotLoading, setForgotLoading] = useState(false);

    useEffect(() => {
        if (!error) {
            return;
        }

        addNotification(error, { level: 'error', importance: 'high' });
    }, [error, addNotification]);

    const handleSubmit = async (e: { preventDefault: () => void }) => {
        e.preventDefault();
        setError('');

        const normalizedUsername = username.trim();
        const nextFieldErrors = {
            username: validateEmail(normalizedUsername) || undefined,
            password: validatePassword(password) || undefined,
        };

        setFieldErrors(nextFieldErrors);
        setUsername(normalizedUsername);

        if (Object.values(nextFieldErrors).some(Boolean)) {
            addNotification('Проверьте обязательные поля формы', {
                level: 'warning',
            });
            return;
        }

        setLoading(true);
        try {
            const result = await login(normalizedUsername, password);
            if (result.mustChangePassword) {
                addNotification(
                    'Вы вошли с временным паролем. Рекомендуем сменить пароль в настройках профиля.',
                    { level: 'warning', importance: 'high' }
                );
            }
            router.push('/');
        } catch {
            setError('Неверное имя пользователя или пароль.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotSubmit = async () => {
        const normalizedEmail = forgotEmail.trim();
        const emailError = validateEmail(normalizedEmail);
        setForgotEmail(normalizedEmail);
        setForgotEmailError(emailError);
        if (emailError) {
            return;
        }

        setForgotLoading(true);
        try {
            await forgotPassword({ email: normalizedEmail });
            addNotification(
                'Если указанный e-mail зарегистрирован, на него будет отправлена ссылка для сброса пароля.',
                { level: 'success' }
            );
            setShowForgotModal(false);
            setForgotEmail('');
            setForgotEmailError(null);
        } catch (err) {
            const message = getApiErrorMessage(
                err,
                'Не удалось отправить запрос. Попробуйте позже.'
            );
            addNotification(message, { level: 'error' });
        } finally {
            setForgotLoading(false);
        }
    };

    const handleCloseForgotModal = () => {
        setShowForgotModal(false);
        setForgotEmail('');
        setForgotEmailError(null);
    };

    return (
        <div className="container-login mt-5">
            <h1 className="text-center">Вход</h1>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="username">Email</label>
                    <input
                        type="email"
                        id="username"
                        className={`form-control ${
                            fieldErrors.username ? 'is-invalid' : ''
                        }`}
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value);
                            setFieldErrors((prev) => ({
                                ...prev,
                                username: undefined,
                            }));
                            setError('');
                        }}
                        onBlur={() => {
                            const normalized = username.trim();
                            setUsername(normalized);
                            setFieldErrors((prev) => ({
                                ...prev,
                                username:
                                    validateEmail(normalized) || undefined,
                            }));
                        }}
                        maxLength={VALIDATION_LIMITS.emailMaxLength}
                        placeholder="Введите email"
                        autoComplete="email"
                        aria-invalid={Boolean(fieldErrors.username)}
                        disabled={loading}
                        required
                    />
                    <div className="invalid-feedback d-block field-error-slot">
                        {fieldErrors.username || '\u00A0'}
                    </div>
                </div>
                <div className="form-group">
                    <label htmlFor="password">Пароль</label>
                    <input
                        type="password"
                        id="password"
                        className={`form-control ${
                            fieldErrors.password ? 'is-invalid' : ''
                        }`}
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setFieldErrors((prev) => ({
                                ...prev,
                                password: undefined,
                            }));
                            setError('');
                        }}
                        onBlur={() =>
                            setFieldErrors((prev) => ({
                                ...prev,
                                password:
                                    validatePassword(password) || undefined,
                            }))
                        }
                        minLength={VALIDATION_LIMITS.passwordMinLength}
                        maxLength={VALIDATION_LIMITS.passwordMaxLength}
                        placeholder="Введите пароль"
                        autoComplete="current-password"
                        aria-invalid={Boolean(fieldErrors.password)}
                        disabled={loading}
                        required
                    />
                    <div className="invalid-feedback d-block field-error-slot">
                        {fieldErrors.password || '\u00A0'}
                    </div>
                </div>
                <div className="d-flex justify-content-center">
                    <button
                        type="submit"
                        className="btn btn-primary mt-2 mb-3"
                        disabled={loading}
                    >
                        {loading ? 'Вход...' : 'Вход'}
                    </button>
                </div>
            </form>

            <div className="text-center mt-2">
                <span className="d-block mb-2">Нет аккаунта? </span>
                <Link href="/auth/register">Зарегистрироваться</Link>
            </div>

            <div className="text-center mt-3">
                <a
                    href="#"
                    className="link-primary"
                    onClick={(e) => {
                        e.preventDefault();
                        setShowForgotModal(true);
                    }}
                >
                    Забыли пароль?
                </a>
            </div>

            <Modal show={showForgotModal} onHide={handleCloseForgotModal} centered>
                <Modal.Header closeButton />
                <Modal.Body>
                    <p className="text-muted mb-3">
                        Введите e-mail, на который зарегистрирован аккаунт. На
                        него будет отправлена ссылка для сброса пароля.
                    </p>
                    <div className="form-group">
                        <label htmlFor="forgot-email">Email</label>
                        <input
                            type="email"
                            id="forgot-email"
                            className={`form-control ${
                                forgotEmailError ? 'is-invalid' : ''
                            }`}
                            value={forgotEmail}
                            onChange={(e) => {
                                setForgotEmail(e.target.value);
                                setForgotEmailError(null);
                            }}
                            onBlur={() => {
                                const normalized = forgotEmail.trim();
                                setForgotEmail(normalized);
                                setForgotEmailError(
                                    validateEmail(normalized)
                                );
                            }}
                            maxLength={VALIDATION_LIMITS.emailMaxLength}
                            placeholder="Введите email"
                            autoComplete="email"
                            aria-invalid={Boolean(forgotEmailError)}
                            disabled={forgotLoading}
                            required
                        />
                        <div className="invalid-feedback d-block field-error-slot">
                            {forgotEmailError || '\u00A0'}
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleCloseForgotModal}
                        disabled={forgotLoading}
                    >
                        Отмена
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleForgotSubmit}
                        disabled={forgotLoading}
                    >
                        {forgotLoading ? 'Отправка...' : 'Отправить'}
                    </button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}
