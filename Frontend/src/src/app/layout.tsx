import './globals.css';
import { Inter } from 'next/font/google';
import TopMenu from './ui/TopMenu';
import { Metadata } from 'next';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { FavoriteProvider } from '@/context/FavoriteContext';
import { MessageNotificationProvider } from '@/context/MessageNotificationContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ConfirmDialogProvider } from '@/context/ConfirmDialogContext';
import { ThemeProvider } from '@/context/ThemeContext';
import NotificationContainer from '@/sharedComponents/NotificationContainer';
import { Suspense } from 'react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: process.env.NEXT_PUBLIC_MARKETPLACE_NAME,
    description: 'An outdoor marketplace',
};

const themeInitScript = `
(() => {
    const storageKey = 'bs-marketplace-theme-v2';
    const legacyStorageKey = 'bs-marketplace-theme';
    const isKnownTheme = (value) =>
        value === 'classic' || value === 'light' || value === 'dark';
    const getColorScheme = (theme) => (theme === 'dark' ? 'dark' : 'light');

    try {
        const storedTheme = localStorage.getItem(storageKey);
        let theme = 'classic';

        if (isKnownTheme(storedTheme)) {
            theme = storedTheme;
        } else {
            const legacyTheme = localStorage.getItem(legacyStorageKey);
            if (legacyTheme === 'dark') {
                theme = 'dark';
            }
        }

        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = getColorScheme(theme);
    } catch {
        document.documentElement.setAttribute('data-theme', 'classic');
        document.documentElement.style.colorScheme = 'light';
    }
})();
`;

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
            </head>
            <body className={inter.className}>
                <ThemeProvider>
                    <AuthProvider>
                        <CartProvider>
                            <FavoriteProvider>
                                <MessageNotificationProvider>
                                    <NotificationProvider>
                                        <ConfirmDialogProvider>
                                            <Suspense fallback={null}>
                                                <TopMenu />
                                            </Suspense>
                                            {children}
                                            <NotificationContainer />
                                        </ConfirmDialogProvider>
                                    </NotificationProvider>
                                </MessageNotificationProvider>
                            </FavoriteProvider>
                        </CartProvider>
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
