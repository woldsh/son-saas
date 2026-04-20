'use client';

import { useSidebar } from '../contexts/SidebarContext';

export default function SidebarCollapseButton() {
    const { isCollapsed, toggleCollapse, sidebarWidth, isOpen } = useSidebar();

    return (
        <button
            onClick={toggleCollapse}
            className="hidden lg:flex fixed top-1/2 -translate-y-1/2 z-[160] items-center justify-center 
                       w-5 h-10 bg-white/90 backdrop-blur-sm border border-slate-200/80 border-l-0 rounded-r-lg
                       shadow-[2px_0_8px_rgba(0,0,0,0.06)] hover:shadow-[2px_0_12px_rgba(59,130,246,0.15)] 
                       hover:bg-blue-50/80 hover:border-blue-200/60
                       transition-all duration-500 ease-out group cursor-pointer"
            style={{ 
                left: isCollapsed ? 0 : (isOpen ? sidebarWidth : 0),
            }}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
            <svg 
                className="w-3 h-3 text-slate-400 group-hover:text-blue-500 transition-all duration-300"
                style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
        </button>
    );
}
