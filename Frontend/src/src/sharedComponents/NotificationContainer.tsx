"use client";

import React, { useEffect } from 'react';
import { useNotification } from '@/context/NotificationContext';

const NotificationContainer: React.FC = () => {
    const { notifications, removeNotification } = useNotification();

    useEffect(() => {
        if (notifications.length === 0) {
            return;
        }

        const timers = notifications.map((notification) =>
            window.setTimeout(
                () => removeNotification(notification.id),
                notification.durationMs
            )
        );

        return () => {
            timers.forEach((timerId) => window.clearTimeout(timerId));
        };
    }, [notifications, removeNotification]);

    return (
        <div
            className="notification-viewport"
            aria-live="polite"
            aria-atomic="false"
        >
            {notifications.map((notification) => (
                <article
                    key={notification.id}
                    className={`notification-toast notification-toast--${notification.level}`}
                    role="status"
                >
                    <button
                        type="button"
                        className="notification-toast__close"
                        onClick={() => removeNotification(notification.id)}
                        aria-label="Закрыть уведомление"
                    >
                        ×
                    </button>
                    <div className="notification-toast__body">
                        {notification.message}
                    </div>
                </article>
            ))}
        </div>
    );
};

export default NotificationContainer;
