'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
    validateEmail,
    validatePassword,
    VALIDATION_LIMITS,
} from '@/utils/validation';

export default function Login() {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{
        username?: string;
        password?: string;
    }>({});
    const router = useRouter();
    const [loading, setLoading] = useState<boolean>(false);

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
            return;
        }

        setLoading(true);
        try {
            await login(normalizedUsername, password);
            router.push('/');
        } catch {
            setError('Неверное имя пользователя или пароль');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container-login mt-5">
            <h1 className="text-center">Вход</h1>
            <form onSubmit={handleSubmit}>
                {error && <p className="text-danger">{error}</p>}
                <div className="form-group">
                    <label htmlFor="username">Email</label>
                    <input
                        type="email"
                        id="username"
                        className={`form-control ${
                            fieldErrors.username ? 'is-invalid' : ''
                        }`}
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
                        disabled={loading}
                        required
                    />
                    {fieldErrors.username && (
                        <div className="invalid-feedback d-block">
                            {fieldErrors.username}
                        </div>
                    )}
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
                        autoComplete="current-password"
                        aria-invalid={Boolean(fieldErrors.password)}
                        disabled={loading}
                        required
                    />
                    {fieldErrors.password && (
                        <div className="invalid-feedback d-block">
                            {fieldErrors.password}
                        </div>
                    )}
                </div>
                <button
                    type="submit"
                    className="btn btn-primary mt-3"
                    disabled={loading}
                >
                    {loading ? 'Вход...' : 'Вход'}
                </button>
            </form>
        </div>
    );
}
