'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { type ThemeMode, useTheme } from '@/context/ThemeContext';
import RequireAuth from '@/sharedComponents/RequireAuth';
import {
    changePassword,
    confirmCurrentEmailByCode,
    confirmEmailChangeByCode,
    fetchUserSettings,
    requestCurrentEmailVerificationCode,
    requestEmailChange,
    updateNotificationPreferences,
} from '@/services/settingsService';
import {
    fetchSubscriptions,
    unsubscribeFromSeller,
} from '@/services/subscriptionService';
import {
    NotificationPreferences,
    SellerSubscription,
    UserSettings,
} from '@/types/api/users';
import { getApiErrorMessage } from '@/utils/validation';
import styles from './SettingsPage.module.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 128;

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
    notifyEmailOnNewMessage: true,
    notifyEmailOnSellerOrder: true,
    notifyEmailOnFollowedSellerListing: true,
    notifyEmailOnLogin: true,
};

const THEME_OPTIONS: Array<{
    value: ThemeMode;
    title: string;
}> = [
    {
        value: 'classic',
        title: 'Нулевые',
    },
    {
        value: 'light',
        title: 'Светлая',
    },
    {
        value: 'dark',
        title: 'Тёмная',
    },
];

const validateEmail = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return 'Введите новый e-mail';
    if (!EMAIL_REGEX.test(normalized)) return 'Укажите корректный e-mail';
    return '';
};

const validateCode = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return 'Введите код подтверждения';
    if (normalized.length < 4 || normalized.length > 20) {
        return 'Код подтверждения должен содержать от 4 до 20 символов';
    }
    return '';
};

const validatePassword = (value: string, label: string) => {
    if (!value) return `Введите ${label.toLowerCase()}`;
    if (value.length < PASSWORD_MIN_LENGTH) {
        return `${label} должен содержать минимум ${PASSWORD_MIN_LENGTH} символов`;
    }
    if (value.length > PASSWORD_MAX_LENGTH) {
        return `${label} должен содержать не более ${PASSWORD_MAX_LENGTH} символов`;
    }
    return '';
};

function UserSettingsContent() {
    const router = useRouter();
    const { user, loading, logout } = useAuth();
    const { addNotification } = useNotification();
    const { theme, setTheme } = useTheme();

    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [subscriptions, setSubscriptions] = useState<SellerSubscription[]>([]);
    const [pageLoading, setPageLoading] = useState(true);

    const [notificationForm, setNotificationForm] =
        useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS);
    const [notificationsSaving, setNotificationsSaving] = useState(false);

    const [newEmail, setNewEmail] = useState('');
    const [emailChangeCode, setEmailChangeCode] = useState('');
    const [emailChangeError, setEmailChangeError] = useState('');
    const [emailSubmitting, setEmailSubmitting] = useState(false);
    const [emailConfirmSubmitting, setEmailConfirmSubmitting] = useState(false);

    const [emailVerificationCode, setEmailVerificationCode] = useState('');
    const [emailVerificationError, setEmailVerificationError] = useState('');
    const [emailVerificationSubmitting, setEmailVerificationSubmitting] =
        useState(false);
    const [isEmailVerificationInputVisible, setIsEmailVerificationInputVisible] =
        useState(false);
    const [lastAutoSubmittedEmailCode, setLastAutoSubmittedEmailCode] =
        useState('');

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSubmitting, setPasswordSubmitting] = useState(false);

    const [removingSellerId, setRemovingSellerId] = useState<string | null>(null);

    useEffect(() => {
        if (loading || !user) return;

        const loadData = async () => {
            setPageLoading(true);
            try {
                const [settingsResponse, subscriptionsResponse] = await Promise.all([
                    fetchUserSettings(),
                    fetchSubscriptions(),
                ]);
                setSettings(settingsResponse);
                setNotificationForm(settingsResponse.notifications);
                setSubscriptions(subscriptionsResponse);
            } catch (error) {
                addNotification(
                    getApiErrorMessage(error, 'Не удалось загрузить настройки профиля.'),
                    { level: 'error', importance: 'high' }
                );
            } finally {
                setPageLoading(false);
            }
        };

        void loadData();
    }, [addNotification, loading, router, user]);

    const applySettings = useCallback((next: UserSettings) => {
        setSettings(next);
        setNotificationForm(next.notifications);
    }, []);

    const handleNotificationSave = async () => {
        setNotificationsSaving(true);
        try {
            applySettings(await updateNotificationPreferences(notificationForm));
            addNotification('Настройки уведомлений сохранены.', { level: 'success' });
        } catch (error) {
            addNotification(
                getApiErrorMessage(error, 'Не удалось сохранить настройки уведомлений.'),
                { level: 'error', importance: 'high' }
            );
        } finally {
            setNotificationsSaving(false);
        }
    };

    const handleRequestCurrentEmailCode = async () => {
        setEmailVerificationError('');
        setEmailVerificationSubmitting(true);
        try {
            await requestCurrentEmailVerificationCode();
            setIsEmailVerificationInputVisible(true);
            setEmailVerificationCode('');
            setLastAutoSubmittedEmailCode('');
            addNotification('Код подтверждения отправлен на текущую почту.', {
                level: 'success',
            });
        } catch (error) {
            setEmailVerificationError(
                getApiErrorMessage(
                    error,
                    'Не удалось отправить код подтверждения текущей почты.'
                )
            );
        } finally {
            setEmailVerificationSubmitting(false);
        }
    };

    useEffect(() => {
        if (!isEmailVerificationInputVisible || settings?.emailConfirmed) {
            return;
        }

        const normalizedCode = emailVerificationCode.trim();
        if (!normalizedCode) {
            setEmailVerificationError('');
            return;
        }

        if (normalizedCode.length < 4) {
            setEmailVerificationError('');
            return;
        }

        const nextError = validateCode(normalizedCode);
        setEmailVerificationError(nextError);
        if (
            nextError ||
            emailVerificationSubmitting ||
            normalizedCode === lastAutoSubmittedEmailCode
        ) {
            return;
        }

        const timerId = window.setTimeout(async () => {
            setEmailVerificationSubmitting(true);
            setLastAutoSubmittedEmailCode(normalizedCode);
            try {
                applySettings(await confirmCurrentEmailByCode({ code: normalizedCode }));
                setIsEmailVerificationInputVisible(false);
                setEmailVerificationCode('');
                setEmailVerificationError('');
                setLastAutoSubmittedEmailCode('');
                addNotification('Почта успешно подтверждена.', {
                    level: 'success',
                    importance: 'high',
                });
            } catch (error) {
                setEmailVerificationError(
                    getApiErrorMessage(error, 'Не удалось подтвердить текущую почту.')
                );
            } finally {
                setEmailVerificationSubmitting(false);
            }
        }, 450);

        return () => window.clearTimeout(timerId);
    }, [
        addNotification,
        applySettings,
        emailVerificationCode,
        emailVerificationSubmitting,
        isEmailVerificationInputVisible,
        lastAutoSubmittedEmailCode,
        settings?.emailConfirmed,
    ]);

    const handleEmailChangeRequest = async (event: React.FormEvent) => {
        event.preventDefault();
        const normalizedEmail = newEmail.trim();
        const nextEmailError = validateEmail(normalizedEmail);
        setNewEmail(normalizedEmail);
        setEmailChangeError(nextEmailError);
        if (nextEmailError) return;

        setEmailSubmitting(true);
        try {
            applySettings(await requestEmailChange({ newEmail: normalizedEmail }));
            setEmailChangeCode('');
            setEmailChangeError('');
            addNotification('Код для подтверждения новой почты отправлен.', {
                level: 'success',
                importance: 'high',
            });
        } catch (error) {
            setEmailChangeError(
                getApiErrorMessage(error, 'Не удалось отправить код для смены почты.')
            );
        } finally {
            setEmailSubmitting(false);
        }
    };

    const handleEmailChangeConfirm = async (event: React.FormEvent) => {
        event.preventDefault();
        const code = emailChangeCode.trim();
        const nextError = validateCode(code);
        setEmailChangeCode(code);
        setEmailChangeError(nextError);
        if (nextError) return;

        setEmailConfirmSubmitting(true);
        try {
            applySettings(await confirmEmailChangeByCode({ code }));
            setNewEmail('');
            setEmailChangeCode('');
            setEmailChangeError('');
            addNotification('Новая почта подтверждена и сохранена.', {
                level: 'success',
                importance: 'high',
            });
        } catch (error) {
            setEmailChangeError(
                getApiErrorMessage(error, 'Не удалось подтвердить смену почты.')
            );
        } finally {
            setEmailConfirmSubmitting(false);
        }
    };

    const handlePasswordChange = async (event: React.FormEvent) => {
        event.preventDefault();
        const nextPasswordError =
            validatePassword(currentPassword, 'Текущий пароль') ||
            validatePassword(newPassword, 'Новый пароль') ||
            validatePassword(confirmNewPassword, 'Подтверждение пароля') ||
            (newPassword !== confirmNewPassword ? 'Новые пароли не совпадают' : '');

        setPasswordError(nextPasswordError);
        if (nextPasswordError) return;

        setPasswordSubmitting(true);
        try {
            await changePassword({
                currentPassword,
                newPassword,
                confirmNewPassword,
            });
            addNotification('Пароль изменён. Выполните вход заново.', {
                level: 'success',
                importance: 'high',
            });
            logout();
        } catch (error) {
            setPasswordError(getApiErrorMessage(error, 'Не удалось изменить пароль.'));
        } finally {
            setPasswordSubmitting(false);
        }
    };

    const handleUnsubscribe = async (sellerId: string) => {
        setRemovingSellerId(sellerId);
        try {
            await unsubscribeFromSeller(sellerId);
            setSubscriptions((prev) =>
                prev.filter((subscription) => subscription.sellerId !== sellerId)
            );
            addNotification('Подписка удалена.', { level: 'success' });
        } catch (error) {
            addNotification(
                getApiErrorMessage(error, 'Не удалось отменить подписку.'),
                { level: 'error', importance: 'high' }
            );
        } finally {
            setRemovingSellerId(null);
        }
    };

    if (loading || pageLoading) {
        return <div className="page-loading-state">Загрузка</div>;
    }

    if (!user || !settings) {
        return null;
    }

    const currentThemeOption = THEME_OPTIONS.find(
        (themeOption) => themeOption.value === theme
    );

    return (
        <div className={`container my-5 ${styles.settingsPage}`}>
            <div className={styles.settingsHeader}>
                <h1 className="mb-1">Настройки профиля</h1>
            </div>

            <div className={styles.settingsGrid}>
            <section className={`card shadow-sm border-0 ${styles.settingsCard} ${styles.emailCard}`}><div className="card-body p-4">
                <h2 className="h4 mb-3">Почта</h2>
                <p className="mb-3 d-flex align-items-center gap-2 flex-wrap">
                    <strong>Текущий e-mail:</strong>
                    <span>{settings.email}</span>
                    <span
                        className={`email-status-icon ${
                            settings.emailConfirmed
                                ? 'email-status-icon--confirmed'
                                : 'email-status-icon--unconfirmed'
                        }`}
                        role="img"
                        aria-label={
                            settings.emailConfirmed
                                ? 'Почта подтверждена'
                                : 'Почта не подтверждена'
                        }
                        title={
                            settings.emailConfirmed
                                ? 'Почта подтверждена'
                                : 'Почта не подтверждена'
                        }
                    >
                        {settings.emailConfirmed ? '✓' : '✗'}
                    </span>
                </p>

                {!settings.emailConfirmed && (
                    <>
                        {!isEmailVerificationInputVisible ? (
                            <button
                                type="button"
                                className={`btn btn-outline-primary btn-sm mb-3 ${styles.sectionButton}`}
                                onClick={handleRequestCurrentEmailCode}
                                disabled={emailVerificationSubmitting}
                            >
                                {emailVerificationSubmitting
                                    ? 'Отправляем код...'
                                    : 'Отправить код подтверждения'}
                            </button>
                        ) : (
                            <div className="mb-3">
                                <label
                                    className="form-label"
                                    htmlFor="emailVerificationCode"
                                >
                                    Код подтверждения
                                </label>
                                <input
                                    id="emailVerificationCode"
                                    type="text"
                                    className={`form-control ${
                                        emailVerificationError ? 'is-invalid' : ''
                                    }`}
                                    value={emailVerificationCode}
                                    onChange={(e) => {
                                        setEmailVerificationCode(e.target.value);
                                        setEmailVerificationError('');
                                        setLastAutoSubmittedEmailCode('');
                                    }}
                                    placeholder="Введите код из письма"
                                    disabled={emailVerificationSubmitting}
                                    autoFocus
                                />
                                <div className="invalid-feedback d-block mt-2">
                                    {emailVerificationError ||
                                        (emailVerificationSubmitting
                                            ? 'Проверяем код...'
                                            : ' ') ||
                                        '\u00A0'}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {settings.pendingEmail && (
                    <div className={styles.pendingEmailInfo}>
                        Ожидает подтверждения новая почта: {settings.pendingEmail}
                    </div>
                )}

                <form onSubmit={handleEmailChangeRequest}>
                    <label className="form-label" htmlFor="newEmail">Новый e-mail</label>
                    <input id="newEmail" type="email" className={`form-control ${emailChangeError ? 'is-invalid' : ''}`} value={newEmail} onChange={(e) => { setNewEmail(e.target.value); setEmailChangeError(''); }} placeholder="Введите новый e-mail" disabled={emailSubmitting || emailConfirmSubmitting} />
                    <div className="invalid-feedback d-block mt-2">{emailChangeError || '\u00A0'}</div>
                    <button
                        type="submit"
                        className={`btn btn-primary ${styles.sectionButton}`}
                        disabled={emailSubmitting || emailConfirmSubmitting}
                    >
                        {emailSubmitting ? 'Отправляем код...' : 'Изменить e-mail'}
                    </button>
                </form>

                {settings.pendingEmail && (
                    <form onSubmit={handleEmailChangeConfirm} className="mt-3">
                        <label className="form-label" htmlFor="emailChangeCode">Код подтверждения новой почты</label>
                        <input id="emailChangeCode" type="text" className={`form-control ${emailChangeError ? 'is-invalid' : ''}`} value={emailChangeCode} onChange={(e) => { setEmailChangeCode(e.target.value); setEmailChangeError(''); }} placeholder="Введите код из письма" disabled={emailSubmitting || emailConfirmSubmitting} />
                        <button
                            type="submit"
                            className={`btn btn-primary mt-2 ${styles.sectionButton}`}
                            disabled={emailSubmitting || emailConfirmSubmitting}
                        >
                            {emailConfirmSubmitting ? 'Подтверждаем...' : 'Подтвердить смену e-mail'}
                        </button>
                    </form>
                )}
            </div></section>

            <section className={`card shadow-sm border-0 ${styles.settingsCard} ${styles.passwordCard}`}><div className="card-body p-4">
                <h2 className="h4 mb-3">Пароль</h2>
                <form onSubmit={handlePasswordChange}>
                    <div className={styles.passwordFields}>
                        <div className={styles.passwordField}><label className="form-label">Текущий пароль</label><input type="password" className={`form-control ${passwordError ? 'is-invalid' : ''}`} value={currentPassword} onChange={(e)=>{setCurrentPassword(e.target.value);setPasswordError('');}} disabled={passwordSubmitting}/></div>
                        <div className={styles.passwordField}><label className="form-label">Новый пароль</label><input type="password" className={`form-control ${passwordError ? 'is-invalid' : ''}`} value={newPassword} onChange={(e)=>{setNewPassword(e.target.value);setPasswordError('');}} disabled={passwordSubmitting}/></div>
                        <div className={styles.passwordField}><label className="form-label">Повторите новый пароль</label><input type="password" className={`form-control ${passwordError ? 'is-invalid' : ''}`} value={confirmNewPassword} onChange={(e)=>{setConfirmNewPassword(e.target.value);setPasswordError('');}} disabled={passwordSubmitting}/></div>
                    </div>
                    <div className="invalid-feedback d-block mt-2">{passwordError || '\u00A0'}</div>
                    <button
                        type="submit"
                        className={`btn btn-primary mt-2 ${styles.sectionButton}`}
                        disabled={passwordSubmitting}
                    >
                        {passwordSubmitting ? 'Сохраняем пароль...' : 'Изменить пароль'}
                    </button>
                </form>
            </div></section>

            <section className={`card shadow-sm border-0 ${styles.settingsCard} ${styles.notificationsCard}`}><div className="card-body p-4">
                <h2 className="h4 mb-3">Уведомления на почту</h2>
                <div className="form-check mb-3"><input id="notifyEmailOnNewMessage" type="checkbox" className="form-check-input" checked={notificationForm.notifyEmailOnNewMessage} onChange={(e)=>setNotificationForm((p)=>({...p,notifyEmailOnNewMessage:e.target.checked}))}/><label className="form-check-label" htmlFor="notifyEmailOnNewMessage">Новые сообщения в чате</label></div>
                <div className="form-check mb-3"><input id="notifyEmailOnSellerOrder" type="checkbox" className="form-check-input" checked={notificationForm.notifyEmailOnSellerOrder} onChange={(e)=>setNotificationForm((p)=>({...p,notifyEmailOnSellerOrder:e.target.checked}))}/><label className="form-check-label" htmlFor="notifyEmailOnSellerOrder">Заказы от покупателей</label></div>
                <div className="form-check mb-3"><input id="notifyEmailOnFollowedSellerListing" type="checkbox" className="form-check-input" checked={notificationForm.notifyEmailOnFollowedSellerListing} onChange={(e)=>setNotificationForm((p)=>({...p,notifyEmailOnFollowedSellerListing:e.target.checked}))}/><label className="form-check-label" htmlFor="notifyEmailOnFollowedSellerListing">Новое объявление у продавца</label></div>
                <div className="form-check mb-4"><input id="notifyEmailOnLogin" type="checkbox" className="form-check-input" checked={notificationForm.notifyEmailOnLogin} onChange={(e)=>setNotificationForm((p)=>({...p,notifyEmailOnLogin:e.target.checked}))}/><label className="form-check-label" htmlFor="notifyEmailOnLogin">Вход в аккаунт</label></div>
                <button
                    type="button"
                    className={`btn btn-primary ${styles.sectionButton}`}
                    onClick={handleNotificationSave}
                    disabled={notificationsSaving}
                >
                    {notificationsSaving ? 'Сохраняем настройки...' : 'Сохранить уведомления'}
                </button>
            </div></section>

            <section className={`card shadow-sm border-0 ${styles.settingsCard} ${styles.themeCard}`}><div className="card-body p-4">
                <h2 className="h4 mb-3">Тема сайта</h2>
                <div
                    className={styles.themeOptions}
                    role="radiogroup"
                    aria-label="Выбор темы сайта"
                >
                    {THEME_OPTIONS.map((themeOption) => (
                        <button
                            key={themeOption.value}
                            type="button"
                            role="radio"
                            aria-checked={theme === themeOption.value}
                            className={`${styles.themeOption} ${
                                theme === themeOption.value
                                    ? styles.themeOptionActive
                                    : ''
                            }`}
                            onClick={() => setTheme(themeOption.value)}
                        >
                            <span className={styles.themeOptionTitle}>
                                {themeOption.title}
                            </span>
                        </button>
                    ))}
                </div>
            </div></section>

            <section className={`card shadow-sm border-0 ${styles.settingsCard} ${styles.subscriptionsCard}`}><div className="card-body p-4">
                <h2 className="h4 mb-3">Подписки на продавцов</h2>
                {subscriptions.length === 0 ? (
                    <p className="text-muted mb-0">У вас пока нет подписок на продавцов.</p>
                ) : (
                    <div
                        className={`list-group list-group-flush ${styles.subscriptionsList} ${styles.subscriptionsListScroll}`}
                    >
                        {subscriptions.map((subscription) => (
                            <div
                                key={subscription.sellerId}
                                className={`list-group-item px-0 d-flex justify-content-between align-items-center ${styles.subscriptionItem}`}
                            >
                                <div className={styles.subscriptionNameWrap}>
                                    <a
                                        href={`/user/${subscription.sellerId}`}
                                        className={`fw-semibold text-decoration-none ${styles.subscriptionLink}`}
                                        title={subscription.sellerNickname}
                                    >
                                        {subscription.sellerNickname}
                                    </a>
                                </div>
                                <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => handleUnsubscribe(subscription.sellerId)} disabled={removingSellerId === subscription.sellerId}>
                                    {removingSellerId === subscription.sellerId ? 'Отписываем...' : 'Отписаться'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div></section>
            </div>
        </div>
    );
}

export default function UserSettingsPage() {
    return (
        <RequireAuth>
            <UserSettingsContent />
        </RequireAuth>
    );
}
