'use client';

import Link from 'next/link';
import React, { useCallback, useState } from 'react';
import {
    addAdminRole,
    deleteUser,
    fetchAllUserDetails,
    removeAdminRole,
} from '@/services/userService';
import { UserDetail } from '@/types/api/users';
import { useNotification } from '@/context/NotificationContext';
import { useConfirmDialog } from '@/context/ConfirmDialogContext';
import { getApiErrorMessage } from '@/utils/validation';
import { useAsyncData } from '@/sharedComponents/hooks/useAsyncData';
import AdminActionsMenu from './AdminActionsMenu';

export default function UserManagementSection(): JSX.Element {
    const { addNotification } = useNotification();
    const { confirm } = useConfirmDialog();
    const [roleUpdatingUserId, setRoleUpdatingUserId] = useState<string | null>(
        null
    );

    const notifyError = useCallback(
        (error: unknown, fallback: string) =>
            addNotification(getApiErrorMessage(error, fallback), {
                level: 'error',
                importance: 'high',
            }),
        [addNotification]
    );

    const {
        data: users,
        setData: setUsers,
        loading,
    } = useAsyncData<UserDetail[]>(fetchAllUserDetails, [], {
        onError: (error) => notifyError(error, 'Не удалось загрузить пользователей.'),
    });

    const handleDelete = async (userId: string) => {
        const shouldDelete = await confirm({
            title: 'Удаление пользователя',
            message: 'Вы уверены, что хотите удалить этого пользователя?',
            confirmText: 'Удалить',
            cancelText: 'Отмена',
            variant: 'danger',
        });

        if (!shouldDelete) {
            return;
        }

        try {
            await deleteUser(userId);
            setUsers((prev) => prev.filter((user) => user.id !== userId));
            addNotification('Пользователь успешно удалён.', { level: 'success' });
        } catch (error) {
            notifyError(error, 'Не удалось удалить пользователя.');
        }
    };

    const handleAdminRoleChange = async (
        userId: string,
        shouldBeAdmin: boolean
    ) => {
        const shouldApplyRoleChange = await confirm({
            title: shouldBeAdmin
                ? 'Назначение администратора'
                : 'Снятие роли администратора',
            message: shouldBeAdmin
                ? 'Вы уверены, что хотите выдать роль администратора?'
                : 'Вы уверены, что хотите снять роль администратора?',
            confirmText: shouldBeAdmin ? 'Назначить' : 'Снять роль',
            cancelText: 'Отмена',
            variant: shouldBeAdmin ? 'primary' : 'danger',
        });

        if (!shouldApplyRoleChange) {
            return;
        }

        setRoleUpdatingUserId(userId);
        try {
            const data = shouldBeAdmin
                ? await addAdminRole(userId)
                : await removeAdminRole(userId);
            setUsers((prev) =>
                prev.map((user) => (user.id === userId ? data : user))
            );
            addNotification(
                shouldBeAdmin
                    ? 'Роль администратора добавлена.'
                    : 'Роль администратора удалена.',
                { level: 'success' }
            );
        } catch (error) {
            notifyError(
                error,
                shouldBeAdmin
                    ? 'Не удалось добавить роль администратора.'
                    : 'Не удалось удалить роль администратора.'
            );
        } finally {
            setRoleUpdatingUserId(null);
        }
    };

    return (
        <div className="card-admin mb-4">
            <div className="card-header">
                <h3 className="mb-0">Управление пользователями</h3>
            </div>
            <div className="card-body">
                {loading && <div className="loading-centered">Загрузка</div>}
                {!loading && users.length === 0 && (
                    <div className="text-muted">Пользователи не найдены</div>
                )}
                {users.length > 0 && (
                    <ul className="list-group admin-management-list">
                        {users.map((user) => (
                            <li
                                key={user.id}
                                className="list-group-item admin-management-item d-flex align-items-center"
                            >
                                <span className="text-truncate flex-grow-1 me-3 admin-management-item__title">
                                    <Link
                                        href={`/user/${user.id}`}
                                        className="fw-bold text-decoration-none"
                                        style={{
                                            display: 'inline-block',
                                            maxWidth: '100%',
                                        }}
                                    >
                                        {user.nickname}
                                    </Link>
                                </span>
                                <AdminActionsMenu className="flex-shrink-0 admin-management-item__actions">
                                    <div className="form-check d-inline-flex align-items-center admin-management-item__role-toggle">
                                        <input
                                            id={`admin-role-${user.id}`}
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={user.roles.includes('Admin')}
                                            disabled={
                                                roleUpdatingUserId === user.id
                                            }
                                            onChange={(event) =>
                                                void handleAdminRoleChange(
                                                    user.id,
                                                    event.target.checked
                                                )
                                            }
                                        />
                                        <label
                                            className="form-check-label"
                                            htmlFor={`admin-role-${user.id}`}
                                        >
                                            Администратор
                                        </label>
                                    </div>
                                    <button
                                        className="btn btn-danger me-2 admin-management-item__button"
                                        onClick={() => void handleDelete(user.id)}
                                    >
                                        Удалить
                                    </button>
                                </AdminActionsMenu>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
