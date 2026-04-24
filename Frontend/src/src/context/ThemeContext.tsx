'use client';

import {
    ReactNode,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { requireContext } from '@/context/contextUtils';

export type ThemeMode = 'classic' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'bs-marketplace-theme-v2';
const LEGACY_THEME_STORAGE_KEY = 'bs-marketplace-theme';

const isThemeMode = (value: unknown): value is ThemeMode => {
    return value === 'classic' || value === 'light' || value === 'dark';
};

const mapLegacyTheme = (value: unknown): ThemeMode | null => {
    if (value === 'dark') {
        return 'dark';
    }

    if (value === 'light') {
        return 'classic';
    }

    return null;
};

const getInitialTheme = (): ThemeMode => {
    if (typeof window === 'undefined') {
        return 'classic';
    }

    try {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (isThemeMode(savedTheme)) {
            return savedTheme;
        }

        const legacyTheme = mapLegacyTheme(
            localStorage.getItem(LEGACY_THEME_STORAGE_KEY)
        );
        if (legacyTheme) {
            return legacyTheme;
        }
    } catch {
        // Игнорируем ошибки чтения localStorage.
    }

    return 'classic';
};

const getColorScheme = (theme: ThemeMode) => (theme === 'dark' ? 'dark' : 'light');

const applyThemeToDocument = (theme: ThemeMode) => {
    if (typeof document === 'undefined') {
        return;
    }

    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = getColorScheme(theme);
};

interface ThemeContextType {
    theme: ThemeMode;
    setTheme: (nextTheme: ThemeMode) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const NEXT_THEME_MAP: Record<ThemeMode, ThemeMode> = {
    classic: 'light',
    light: 'dark',
    dark: 'classic',
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

    useEffect(() => {
        applyThemeToDocument(theme);
    }, [theme]);

    const setTheme = useCallback((nextTheme: ThemeMode) => {
        setThemeState(nextTheme);
        applyThemeToDocument(nextTheme);

        try {
            localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        } catch {
            // Игнорируем ошибки записи localStorage.
        }
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(NEXT_THEME_MAP[theme]);
    }, [setTheme, theme]);

    const contextValue = useMemo(
        () => ({ theme, setTheme, toggleTheme }),
        [theme, setTheme, toggleTheme]
    );

    return (
        <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
    );
};

export const useTheme = (): ThemeContextType => {
    return requireContext(useContext(ThemeContext), 'useTheme', 'ThemeProvider');
};
