import './globals.css';
import { Inter } from 'next/font/google';
import TopMenu from './ui/TopMenu';
import { Metadata } from 'next';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { FavoriteProvider } from '@/context/FavoriteContext';
import { MessageNotificationProvider } from '@/context/MessageNotificationContext';
import { Suspense } from 'react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: process.env.NEXT_PUBLIC_MARKETPLACE_NAME,
    description: 'An outdoor marketplace',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <AuthProvider>
                    <CartProvider>
                        <FavoriteProvider>
                            <MessageNotificationProvider>
                                <Suspense fallback={null}>
                                    <TopMenu />
                                </Suspense>
                                {children}
                            </MessageNotificationProvider>
                        </FavoriteProvider>
                    </CartProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
