import { ReactNode } from 'react';
import styles from './AdminElements.module.css';

export default function AdminLayout({ children }: { children: ReactNode }) {
    return <div className={styles.adminScope}>{children}</div>;
}
