'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import { useTheme } from '../contexts/ThemeContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '../contexts/LanguageContext';
import { useUserNotifications } from '../hooks/useUserNotifications';
import { FiUser, FiSettings, FiLogOut, FiBox, FiLock, FiChevronDown, FiGlobe, FiBell, FiMoon, FiSun, FiMonitor } from 'react-icons/fi';
import Image from 'next/image';

interface HeaderProps {
    title: string;
    subtitle?: string;
    isDark?: boolean;
}

export default function Header({ title, subtitle, isDark }: HeaderProps) {
    const { user, logout } = useAuth();
    const { isOpen, toggleSidebar } = useSidebar();
    const { mode, setMode } = useTheme();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const { language, setLanguage, t } = useLanguage();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const { totalCount, feedbackCount, transferCount, handoutCount } = useUserNotifications();

    // Dynamically determine the base path for settings links
    const getBasePath = () => {
        if (pathname.startsWith('/workspace')) return '/workspace';
        if (pathname.startsWith('/admin-panel')) return '/admin-panel';
        if (pathname.startsWith('/portal')) return '/portal';
        if (pathname.startsWith('/service')) return '/service';
        if (pathname.startsWith('/procurement-management')) {
            if (pathname.includes('/team-leader')) return '/procurement-management/team-leader';
            if (pathname.includes('/store')) return '/procurement-management/store';
            if (pathname.includes('/stock-clerk')) return '/procurement-management/stock-clerk';
            return '/procurement-management';
        }
        if (pathname.startsWith('/admin-staff/team-leader')) return '/admin-staff/team-leader';
        if (pathname.startsWith('/chief')) return '/chief';
        if (pathname.startsWith('/admin')) return '/admin';
        return '/dashboard'; // Default
    };

    const basePath = getBasePath();

    // Determine where the bell notification should take the user
    const getNotificationLink = () => {
        if (handoutCount > 0) return `${basePath}/clerk-report`; // Clerk report page for codes
        if (transferCount > 0 && feedbackCount === 0) return `${basePath}/receive-goods`;
        return `${basePath}/feedback`;
    };

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <>
            <header className={`${isDark ? 'bg-slate-950/40 backdrop-blur-xl border-b border-white/5' : 'bg-white shadow-sm border-b border-slate-100'} mb-2 sticky top-0 z-40`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {/* Animated Hamburger Button */}
                            <button
                                onClick={toggleSidebar}
                                className="group relative w-8 h-8 rounded-lg hover:bg-slate-100 transition-all duration-300 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-slate-400"
                                aria-label="Toggle sidebar"
                            >
                                <div className="flex flex-col gap-1 w-4">
                                    <span className={`h-0.5 w-full ${isDark ? 'bg-white' : 'bg-slate-700'} rounded-full transition-all duration-300 ${isOpen ? 'rotate-45 translate-y-1.5' : ''}`}></span>
                                    <span className={`h-0.5 w-full ${isDark ? 'bg-white' : 'bg-slate-700'} rounded-full transition-all duration-300 ${isOpen ? 'opacity-0' : 'opacity-100'}`}></span>
                                    <span className={`h-0.5 w-full ${isDark ? 'bg-white' : 'bg-slate-700'} rounded-full transition-all duration-300 ${isOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></span>
                                </div>
                            </button>

                            <div>
                                <h1 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'} leading-tight`}>{title}</h1>
                                {subtitle && <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'} leading-tight`}>{subtitle}</p>}
                            </div>
                        </div>

                        <div className="flex items-center gap-4 sm:gap-6" ref={dropdownRef}>
                            {/* Notification Bell */}
                            <Link
                                href={getNotificationLink()}
                                className={`relative p-2.5 rounded-xl transition-all duration-300 border-2 group
                                ${isDark
                                        ? 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-amber-500/30'
                                        : 'bg-slate-50 border-slate-100 hover:border-amber-200 hover:bg-white'}`}
                            >
                                <FiBell className={`${isDark ? 'text-amber-400' : 'text-amber-600'} text-xl group-hover:rotate-12 transition-transform`} />
                                {totalCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white ring-2 ring-white animate-bounce shadow-lg shadow-red-500/40">
                                        {totalCount}
                                    </span>
                                )}
                            </Link>

                            {/* Language Switcher */}

                            {/* Profile Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                                    className={`flex items-center gap-2 p-1 pr-2 rounded-2xl transition-all duration-500 border-2 group
                                    ${isProfileOpen ? 'bg-white border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'bg-slate-50 border-slate-100 hover:border-indigo-200 hover:shadow-lg'}`}
                                >
                                    <div className="relative w-8 h-8">
                                        <div className={`absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl blur opacity-30 group-hover:opacity-70 transition duration-500 ${isProfileOpen ? 'opacity-100 animate-pulse' : ''}`} />
                                        <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-white shadow-md flex items-center justify-center bg-white transform transition-transform group-hover:scale-105">
                                            {user?.photoURL ? (
                                                <Image src={user.photoURL} alt="Profile" fill className="object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center">
                                                    <span className="text-white font-black text-xs">{user?.email?.[0].toUpperCase() || 'U'}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="hidden sm:block text-left">
                                        <p className="text-[11px] font-black text-slate-800 tracking-tight leading-none truncate max-w-[120px] group-hover:text-indigo-600 transition-colors">
                                            {user?.displayName || 'User'}
                                        </p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 opacity-70 group-hover:opacity-100 transition-opacity">Account</p>
                                    </div>
                                    <FiChevronDown className={`text-slate-400 transition-all duration-500 ${isProfileOpen ? 'rotate-180 text-indigo-600' : 'group-hover:text-indigo-400'}`} />
                                </button>

                                {/* Dropdown Menu - Ultra Premium Glassmorphism */}
                                {isProfileOpen && (
                                    <div className="absolute right-0 mt-3 w-72 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300">
                                        <div className="relative">
                                            {/* Compact User Info */}
                                            <div className="p-5 bg-slate-50/50 border-b border-slate-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-11 h-11 flex-shrink-0">
                                                        <div className="relative w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm overflow-hidden">
                                                            {user?.photoURL ? (
                                                                <Image src={user.photoURL} alt="Profile" fill className="object-cover" />
                                                            ) : (
                                                                <span className="text-xl font-black">{user?.email?.[0].toUpperCase()}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 overflow-hidden">
                                                        <p className="font-bold text-slate-800 truncate text-[15px] tracking-tight">{user?.displayName || 'User'}</p>
                                                        <p className="text-[11px] text-slate-400 truncate font-medium">{user?.email}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Theme Selector */}
                                            <div className="px-3 pt-3 pb-1">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.15em] px-1 mb-2" style={{ color: '#94a3b8' }}>Theme</p>
                                                <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: 'rgba(100, 116, 139, 0.15)' }}>
                                                    {[
                                                        { key: 'light' as const, icon: <FiSun size={14} />, label: t('light_mode') || 'Light' },
                                                        { key: 'dark' as const, icon: <FiMoon size={14} />, label: t('dark_mode') || 'Dark' },
                                                        { key: 'system' as const, icon: <FiMonitor size={14} />, label: t('system_theme') || 'System' },
                                                    ].map((opt) => (
                                                        <button
                                                            key={opt.key}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setMode(opt.key);
                                                            }}
                                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold tracking-tight transition-all duration-200"
                                                            style={mode === opt.key
                                                                ? { backgroundColor: '#6366f1', color: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }
                                                                : { backgroundColor: 'transparent', color: '#94a3b8' }
                                                            }
                                                        >
                                                            {opt.icon}
                                                            <span className="hidden sm:inline">{opt.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Language Selector */}
                                            <div className="px-3 pt-3 pb-1">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.15em] px-1 mb-2" style={{ color: '#94a3b8' }}>Language</p>
                                                <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: 'rgba(100, 116, 139, 0.15)' }}>
                                                    {[
                                                        { key: 'en' as const, label: 'English' },
                                                        { key: 'am' as const, label: 'አማርኛ' },
                                                    ].map((opt) => (
                                                        <button
                                                            key={opt.key}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setLanguage(opt.key);
                                                            }}
                                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold tracking-tight transition-all duration-200"
                                                            style={language === opt.key
                                                                ? { backgroundColor: '#6366f1', color: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }
                                                                : { backgroundColor: 'transparent', color: '#94a3b8' }
                                                            }
                                                        >
                                                            <FiGlobe size={14} className="opacity-70" />
                                                            <span>{opt.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Navigation List */}
                                            <div className="p-2">
                                                <Link
                                                    href={`${basePath}/properties`}
                                                    onClick={() => setIsProfileOpen(false)}
                                                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all duration-200 group"
                                                >
                                                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center group-hover:border-indigo-100 transition-all shadow-sm">
                                                        <FiBox className="text-lg text-slate-400 group-hover:text-indigo-500" />
                                                    </div>
                                                    <span className="font-bold text-sm tracking-tight">{t('properties') || 'My Assets List'}</span>
                                                </Link>
                                                <Link
                                                    href={`${basePath}/manage-account`}
                                                    onClick={() => setIsProfileOpen(false)}
                                                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all duration-200 group"
                                                >
                                                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center group-hover:border-indigo-100 transition-all shadow-sm">
                                                        <FiSettings className="text-lg text-slate-400 group-hover:text-indigo-500" />
                                                    </div>
                                                    <span className="font-bold text-sm tracking-tight">{t('manage_account')}</span>
                                                </Link>
                                            </div>

                                            {/* Simple Logout Footer */}
                                            <div className="p-2 bg-slate-50 border-t border-slate-100">
                                                <button
                                                    onClick={handleLogout}
                                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-600 hover:bg-red-50 transition-all duration-200 group"
                                                >
                                                    <div className="w-9 h-9 rounded-xl bg-white border border-red-100 flex items-center justify-center group-hover:border-red-200 transition-all shadow-sm">
                                                        <FiLogOut className="text-lg text-red-400 group-hover:text-red-600" />
                                                    </div>
                                                    <span className="font-bold text-sm tracking-tight">{t('logout') || 'Logout Account'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

        </>
    );
}
