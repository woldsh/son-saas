'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
    mode: ThemeMode;
    theme: ResolvedTheme; // The actual applied theme (light or dark)
    setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Detect the current OS / Windows theme */
function getSystemTheme(): ResolvedTheme {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [mode, setModeState] = useState<ThemeMode>('system');
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

    // Resolve the actual theme based on current mode
    const resolveTheme = useCallback((currentMode: ThemeMode): ResolvedTheme => {
        if (currentMode === 'system') {
            return getSystemTheme();
        }
        return currentMode;
    }, []);

    // Apply the theme class to <html> whenever resolved theme changes
    useEffect(() => {
        const root = document.documentElement;
        if (resolvedTheme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [resolvedTheme]);

    // On mount: load saved mode preference
    useEffect(() => {
        const savedMode = localStorage.getItem('themeMode') as ThemeMode | null;
        if (savedMode && ['light', 'dark', 'system'].includes(savedMode)) {
            setModeState(savedMode);
            setResolvedTheme(resolveTheme(savedMode));
        } else {
            // Default to system
            setModeState('system');
            setResolvedTheme(getSystemTheme());
        }
    }, [resolveTheme]);

    // Listen for real-time OS / Windows theme changes (only matters when mode is 'system')
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleSystemThemeChange = (e: MediaQueryListEvent) => {
            if (mode === 'system') {
                setResolvedTheme(e.matches ? 'dark' : 'light');
            }
        };

        mediaQuery.addEventListener('change', handleSystemThemeChange);
        return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }, [mode]);

    const setMode = useCallback((newMode: ThemeMode) => {
        setModeState(newMode);
        setResolvedTheme(resolveTheme(newMode));
        localStorage.setItem('themeMode', newMode);
    }, [resolveTheme]);

    return (
        <ThemeContext.Provider value={{ mode, theme: resolvedTheme, setMode }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
