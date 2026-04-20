'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebar } from '../contexts/SidebarContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useUserNotifications } from '../hooks/useUserNotifications'
import { useIsMobile } from '../hooks/useIsMobile';;
import SidebarResizeHandle from './SidebarResizeHandle';
import SidebarCollapseButton from './SidebarCollapseButton';
import {
    PieChart,
    Package,
    RefreshCw,
    RotateCcw,
    Repeat,
    Send,
    FileBarChart,
    ArrowRightLeft,
    Settings,
    Building2,
    ChevronDown,
    ChevronUp,
    ClipboardList,
    FilePlus,
    History,
    MessageSquare,
    User,
    AlertCircle,
    Wrench,
    ArrowUpRight,
    ArrowDownLeft,
    Route,
    LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TeacherSidebar() {
    const pathname = usePathname();
    const basePath = '/dashboard';
    const { isOpen, closeSidebar, sidebarWidth, isCollapsed } = useSidebar();
    const isMobile = useIsMobile();
    const { t } = useLanguage();
    const { department, userRole } = useAuth();
    const { feedbackCount, transferCount } = useUserNotifications();
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const handleLinkClick = () => {
        if (window.innerWidth < 768) {
            closeSidebar();
        }
    };

    const toggleDropdown = (label: string) => {
        setOpenDropdown(openDropdown === label ? null : label);
    };

    const menuItems = [
        { label: t('dashboard'), href: basePath, icon: LayoutDashboard },
        {
            label: t('requisitions'),
            icon: ClipboardList,
            subItems: [
                { label: t('new_requisition'), href: `${basePath}/request-material`, icon: FilePlus },
                { label: t('my_requisition_history'), href: `${basePath}/view-requests`, icon: History },
                { label: t('request_journey'), href: `${basePath}/request-journey`, icon: Route },
                { label: t('verification_code'), href: `${basePath}/clerk-report`, icon: FileBarChart },
                { label: t('feedback'), href: `${basePath}/feedback`, icon: MessageSquare, badge: feedbackCount },
            ]
        },
        {
            label: t('my_assets'),
            icon: Package,
            subItems: [
                { label: t('my_custody_list'), href: `${basePath}/properties`, icon: User },
                { label: t('report_issue'), href: `${basePath}/report-issue`, icon: AlertCircle },
                { label: t('maintenance_history'), href: `${basePath}/maintenance-history`, icon: Wrench },
            ]
        },
        {
            label: t('material_transfer'),
            icon: RefreshCw,
            subItems: [
                { label: t('return_goods'), href: `${basePath}/return-goods`, icon: ArrowUpRight },
                { label: t('receive_goods'), href: `${basePath}/receive-goods`, icon: ArrowDownLeft, badge: transferCount },
                { label: t('exchange_report'), href: `${basePath}/exchange-report`, icon: Repeat },
            ],
            hasDivider: true
        },
        { label: t('manage_account'), href: `${basePath}/manage-account`, icon: Settings },

    ];

    return (
        <>
            {/* Backdrop Overlay for Mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-[140] lg:hidden transition-opacity duration-300"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <div
                className={`
                fixed lg:sticky top-0
                h-screen flex flex-col z-[150] overflow-hidden bg-[#FAFAFA]
                transition-all duration-300
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:border-none'}
            `}
                style={{ width: isOpen ? ((isCollapsed && !isMobile) ? 0 : sidebarWidth) : 0 }}
            >
                <div
                    className="relative flex flex-col h-full flex-shrink-0 border-r border-gray-200"
                    style={{ width: sidebarWidth }}
                >
                    <SidebarResizeHandle />

                    {/* Header */}
                    <div className="px-6 pt-9 pb-7">
                        <div className="flex items-center gap-3.5">
                            <div className="relative">
                                <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full translate-y-1"></div>
                                <div className="relative w-[52px] h-[52px] rounded-[14px] bg-white shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)] flex items-center justify-center border border-gray-50/50">
                                    <Building2 size={22} className="text-blue-600" strokeWidth={2.5} />
                                </div>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <h3 className="text-[18px] font-black text-slate-900 leading-tight truncate capitalize">
                                    {department ? `${department.toLowerCase()} teacher` : 'Teacher'}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.4)]"></div>
                                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.15em]">
                                        ACADEMIC STAFF
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Links */}
                    <nav className="flex-1 overflow-y-auto py-1 px-4 space-y-0.5 custom-scrollbar">
                        {menuItems.map((item, index) => {
                            const isDropdown = !!item.subItems;
                            const isDropdownOpen = openDropdown === item.label;
                            const isActive = item.href === basePath
                                ? pathname === basePath
                                : pathname?.startsWith(item.href || '');

                            const Icon = item.icon;

                            return (
                                <div key={index}>
                                    {isDropdown ? (
                                        <div className="space-y-0.5">
                                            <button
                                                onClick={() => toggleDropdown(item.label)}
                                                className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-[12px] transition-all duration-200 group ${isDropdownOpen
                                                    ? 'bg-white shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08)] text-slate-800 border border-gray-100/80 font-bold'
                                                    : 'text-slate-600 hover:bg-gray-100/50 hover:text-slate-900 border border-transparent font-bold'
                                                    }`}
                                            >
                                                <Icon className={`w-[22px] h-[22px] flex-shrink-0 ${isDropdownOpen ? 'text-slate-700' : 'text-slate-500'}`} strokeWidth={1.5} />
                                                <span className="text-[15px] whitespace-nowrap flex-1 text-left">
                                                    {item.label}
                                                </span>
                                                {isDropdownOpen ? (
                                                    <ChevronUp size={16} className="text-slate-400" />
                                                ) : (
                                                    <ChevronDown size={16} className="text-slate-400 group-hover:text-slate-600" />
                                                )}
                                            </button>

                                            <AnimatePresence>
                                                {isDropdownOpen && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="mt-1 space-y-0.5 pl-4">
                                                            {item.subItems?.map((subItem, subIndex) => {
                                                                const SubIcon = subItem.icon;
                                                                const isSubActive = pathname === subItem.href;

                                                                return (
                                                                    <Link
                                                                        key={subIndex}
                                                                        href={subItem.href}
                                                                        onClick={handleLinkClick}
                                                                        className={`flex items-center gap-3.5 px-6 py-3 rounded-[12px] transition-all duration-200 ${isSubActive
                                                                            ? 'bg-blue-50/40 text-blue-700 font-bold'
                                                                            : 'text-slate-500 hover:bg-gray-100/40 hover:text-slate-800 font-bold'
                                                                            }`}
                                                                    >
                                                                        <SubIcon size={18} strokeWidth={1.5} className={isSubActive ? 'text-blue-600' : 'text-slate-400'} />
                                                                        <span className="text-[14px]">
                                                                            {subItem.label}
                                                                        </span>
                                                                    </Link>
                                                                );
                                                            })}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ) : (
                                        <Link
                                            href={item.href || '#'}
                                            onClick={handleLinkClick}
                                            className={`flex items-center gap-3.5 px-4 py-2.5 rounded-[12px] transition-all duration-200 ${isActive
                                                ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] text-slate-800 border border-gray-100/80 font-bold'
                                                : 'text-slate-600 hover:bg-gray-100/50 hover:text-slate-900 border border-transparent font-bold'
                                                }`}
                                        >
                                            <Icon className={`w-[22px] h-[22px] flex-shrink-0 ${isActive ? 'text-slate-700' : 'text-slate-500'}`} strokeWidth={1.5} />
                                            <span className="text-[15px] whitespace-nowrap">
                                                {item.label}
                                            </span>
                                        </Link>
                                    )}

                                    {(item as any).hasDivider && (
                                        <div className="h-px bg-gray-200/60 my-3 mx-2"></div>
                                    )}
                                </div>
                            );
                        })}
                    </nav>
                    
                </div>
            </div>
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
            `}</style>


            <SidebarCollapseButton />


        </>
    );
}

