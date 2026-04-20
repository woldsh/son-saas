'use client';

import { useState, useEffect } from 'react';

const LG_BREAKPOINT = 1024;

/**
 * Hook to detect if the current viewport is mobile (below lg breakpoint).
 * Uses a resize listener to stay in sync with window size changes.
 */
export function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < LG_BREAKPOINT);
        check(); // Check on mount
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    return isMobile;
}
