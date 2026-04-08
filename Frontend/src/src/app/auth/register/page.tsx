'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerUser } from '@/services/authService';
import {
    getApiErrorMessage,
    normalizeSingleLine,
    validateEmail,
    validateNickname,
    validatePassword,
    VALIDATION_LIMITS,
} from '@/utils/validation';

export default function Register() {
    const [username, setUsername] = useState('');
    const [nickname, setNickname] = useState('');
    const [password, setPassword] = useState('');
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{
        username?: string;
        nickname?: string;
        password?: string;
        consent?: string;
    }>({});
    const router = useRouter();

    const handleSubmit = async (e: { preventDefault: () => void }) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const normalizedUsername = username.trim();
        const normalizedNickname = normalizeSingleLine(nickname);
        const nextFieldErrors = {
            username: validateEmail(normalizedUsername) || undefined,
            nickname: validateNickname(normalizedNickname) || undefined,
            password: validatePassword(password) || undefined,
            consent: consentAccepted
                ? undefined
                : 'Подтвердите согласие на обработку персональных данных.',
        };

        setFieldErrors(nextFieldErrors);
        setUsername(normalizedUsername);
        setNickname(normalizedNickname);

        if (Object.values(nextFieldErrors).some(Boolean)) {
            return;
        }

        try {
            await registerUser({
                username: normalizedUsername,
                nickname: normalizedNickname,
                password,
            });
            setSuccess(
                'Регистрация выполнена успешно! Пожалуйста, выполните вход.'
            );
            router.push('/auth/login');
        } catch (error) {
            const message = getApiErrorMessage(
                error,
                'Регистрация не удалась. Попробуйте снова.'
            );
            if (message.toLowerCase().includes('почта')) {
                setFieldErrors((prev) => ({
                    ...prev,
                    username: 'Этот email уже зарегистрирован.',
                }));
                setError('');
                return;
            }
            if (message.toLowerCase().includes('никнейм')) {
                setFieldErrors((prev) => ({
                    ...prev,
                    nickname: 'Этот никнейм уже занят.',
                }));
                setError('');
                return;
            }
            setError(message);
        }
    };

    return (
        <div className="container-login mt-5">
            <h1 className="text-center">Регистрация</h1>
            <form onSubmit={handleSubmit}>
                {error && <p className="text-danger">{error}</p>}
                {success && <p className="text-success">{success}</p>}
                <div className="form-group">
                    <label htmlFor="username">Электронная почта</label>
                    <input
                        type="email"
                        className={`form-control ${
                            fieldErrors.username ? 'is-invalid' : ''
                        }`}
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
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
                        autoComplete="email"
                        aria-invalid={Boolean(fieldErrors.username)}
                        required
                    />
                    {fieldErrors.username && (
                        <div className="invalid-feedback d-block">
                            {fieldErrors.username}
                        </div>
                    )}
                </div>
                <div className="form-group">
                    <label htmlFor="nickname">Никнейм</label>
                    <input
                        type="text"
                        className={`form-control ${
                            fieldErrors.nickname ? 'is-invalid' : ''
                        }`}
                        id="nickname"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        onBlur={() => {
                            const normalized = normalizeSingleLine(nickname);
                            setNickname(normalized);
                            setFieldErrors((prev) => ({
                                ...prev,
                                nickname:
                                    validateNickname(normalized) || undefined,
                            }));
                        }}
                        minLength={VALIDATION_LIMITS.nicknameMinLength}
                        maxLength={VALIDATION_LIMITS.nicknameMaxLength}
                        autoComplete="nickname"
                        aria-invalid={Boolean(fieldErrors.nickname)}
                        required
                    />
                    {fieldErrors.nickname && (
                        <div className="invalid-feedback d-block">
                            {fieldErrors.nickname}
                        </div>
                    )}
                </div>
                <div className="form-group">
                    <label htmlFor="password">Пароль</label>
                    <input
                        type="password"
                        className={`form-control ${
                            fieldErrors.password ? 'is-invalid' : ''
                        }`}
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onBlur={() =>
                            setFieldErrors((prev) => ({
                                ...prev,
                                password:
                                    validatePassword(password) || undefined,
                            }))
                        }
                        minLength={VALIDATION_LIMITS.passwordMinLength}
                        maxLength={VALIDATION_LIMITS.passwordMaxLength}
                        autoComplete="new-password"
                        aria-invalid={Boolean(fieldErrors.password)}
                        required
                    />
                    {fieldErrors.password && (
                        <div className="invalid-feedback d-block">
                            {fieldErrors.password}
                        </div>
                    )}
                </div>
                <div className="form-group mt-3">
                    <div className="form-check">
                        <input
                            className={`form-check-input ${
                                fieldErrors.consent ? 'is-invalid' : ''
                            }`}
                            type="checkbox"
                            id="consent"
                            checked={consentAccepted}
                            onChange={(e) => {
                                setConsentAccepted(e.target.checked);
                                setFieldErrors((prev) => ({
                                    ...prev,
                                    consent: undefined,
                                }));
                            }}
                            aria-invalid={Boolean(fieldErrors.consent)}
                            required
                        />
                        <label
                            className="form-check-label"
                            htmlFor="consent"
                        >
                            Я согласен(а) на обработку персональных данных
                        </label>
                    </div>
                    {fieldErrors.consent && (
                        <div className="invalid-feedback d-block">
                            {fieldErrors.consent}
                        </div>
                    )}
                </div>
                <button
                    type="submit"
                    className="btn btn-primary mt-3"
                >
                    Зарегистрироваться
                </button>
            </form>
        </div>
    );
}
