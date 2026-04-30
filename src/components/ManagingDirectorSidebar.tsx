'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebar } from '../contexts/SidebarContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useRequestNotification } from '../hooks/useRequestNotification'
import { useIsMobile } from '../hooks/useIsMobile';;
import {
    LayoutDashboard,
    BarChart3,
    Layers,
    ClipboardList,
    FileText,
    MessageSquare,
    Package,
    FilePlus,
    History,
    Route,
    User,
    AlertCircle,
    Wrench,
    Settings,
    ArrowRightLeft,
    Truck,
    RotateCcw,
    ShieldCheck,
    CheckSquare,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SidebarResizeHandle from './SidebarResizeHandle';
import SidebarCollapseButton from './SidebarCollapseButton';

export default function ManagingDirectorSidebar() {
    const pathname = usePathname();
    const basePath = '/portal';
    const { isOpen, closeSidebar, sidebarWidth, isCollapsed } = useSidebar();
    const isMobile = useIsMobile();
    const { t } = useLanguage();
    const { userRole, department } = useAuth();
    // Since this is the Managing Director's dedicated sidebar, we force the role for the notification hook
    // to 'managing_director' to ensure it bypasses any userRole naming inconsistencies.
    const requestCount = useRequestNotification('managing_director', department);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const handleLinkClick = () => {
        if (window.innerWidth < 768) closeSidebar();
    };

    const toggleDropdown = (label: string) => {
        setOpenDropdown(openDropdown === label ? null : label);
    };

    const menuItems = [
        { label: t('dashboard'), href: basePath, icon: LayoutDashboard },
        {
            label: t('approvals') || "Approval",
            icon: CheckSquare,
            badge: requestCount,
            subItems: [
                { label: t('view_requests'), href: `${basePath}/approve-requests`, icon: ClipboardList, badge: requestCount },
                { label: t('view_ac_report'), href: `${basePath}/reports`, icon: FileText },
            ],
            hasDivider: true
        },
        {
            label: "Stock Management",
            icon: Package,
            subItems: [
                { label: 'Material List', href: `${basePath}/full-inventory`, icon: Layers },
                { label: 'Analytics', href: `${basePath}/analytics`, icon: BarChart3 },
            ]
        },

        { isHeader: true, label: t('personal_account') || "Personal Account" },
        {
            label: t('requisitions'),
            icon: ClipboardList,
            subItems: [
                { label: t('new_requisition'), href: `${basePath}/request-material`, icon: FilePlus },
                { label: t('my_requisition_history'), href: `${basePath}/view-requests`, icon: History },
                { label: t('request_journey'), href: `${basePath}/request-journey`, icon: Route },
                { label: t('verification_code'), href: `${basePath}/clerk-report`, icon: FileText },
                { label: t('feedback'), href: `${basePath}/feedback`, icon: MessageSquare },
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
            icon: ArrowRightLeft,
            subItems: [
                { label: t('receive_goods'), href: `${basePath}/receive-goods`, icon: Truck },
                { label: t('return_goods'), href: `${basePath}/return-goods`, icon: RotateCcw },
            ],
            hasDivider: true
        },
        { label: t('manage_account'), href: `${basePath}/manage-account`, icon: Settings },

        { isHeader: true, label: t('operations_label') || "Operations" },
    ];

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[140] lg:hidden transition-opacity duration-300"
                    onClick={closeSidebar}
                />
            )}

            <div
                className={`fixed lg:sticky top-0 h-screen flex flex-col z-[150] transition-all duration-300 ease-in-out bg-white border-r border-slate-200/80 shadow-sm overflow-hidden
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
                style={{ width: isOpen ? ((isCollapsed && !isMobile) ? 0 : sidebarWidth) : 0 }}
            >
                <div className="relative flex flex-col h-full overflow-hidden" style={{ width: sidebarWidth }}>
                    <SidebarResizeHandle />

                    {/* Logo/Header Section */}
                    <div className="p-6">
                        <div className="flex items-center gap-3 px-2 py-1">
                            <div className="relative group shadow-2xl shadow-indigo-500/20">
                                <div className="absolute -inset-1.5 bg-gradient-to-tr from-indigo-600 to-blue-400 rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
                                <div className="relative w-11 h-11 bg-white rounded-xl flex items-center justify-center border border-slate-100/50 shadow-sm group-hover:scale-105 transition-transform duration-300">
                                    <ShieldCheck className="w-6 h-6 text-indigo-600" strokeWidth={2.5} />
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[17px] font-bold text-slate-800 tracking-tight leading-none">
                                    {t('managing_director')}
                                </span>
                                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.15em] mt-1.5 opacity-80">
                                    {t('executive_label')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Items */}
                    <nav className="flex-1 overflow-y-auto px-3.5 py-2 custom-scrollbar space-y-0.5">
                        {menuItems.map((item: any, index: number) => {
                            if (item.isHeader) {
                                return (
                                    <div key={index} className="px-4 py-4 md:py-5 first:pt-2">
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                            {item.label}
                                        </p>
                                    </div>
                                );
                            }

                            const isDropdown = !!item.subItems;
                            const isDropdownOpen = openDropdown === item.label;
                            const isActive = !isDropdown && (item.href === basePath ? pathname === basePath : pathname?.startsWith(item.href || ''));
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
                                                <Icon className={`w-[22px] h-[22px] flex-shrink-0 ${isDropdownOpen ? 'text-indigo-600' : 'text-slate-500'}`} strokeWidth={1.5} />
                                                <span className="text-[15px] whitespace-nowrap flex-1 text-left">
                                                    {item.label}
                                                </span>
                                                {item.badge > 0 && (
                                                    <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-full shadow-lg shadow-indigo-500/20 mr-2">
                                                        {item.badge}
                                                    </span>
                                                )}
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
                                                            {item.subItems?.map((subItem: any, subIndex: number) => {
                                                                const SubIcon = subItem.icon;
                                                                const isSubActive = pathname === subItem.href;

                                                                return (
                                                                    <Link
                                                                        key={subIndex}
                                                                        href={subItem.href}
                                                                        onClick={handleLinkClick}
                                                                        className={`flex items-center gap-3.5 px-6 py-3 rounded-[12px] transition-all duration-200 ${isSubActive
                                                                            ? 'bg-indigo-50/40 text-indigo-700 font-bold'
                                                                            : 'text-slate-500 hover:bg-gray-100/40 hover:text-slate-800 font-bold'
                                                                            }`}
                                                                    >
                                                                        <SubIcon size={18} strokeWidth={1.5} className={isSubActive ? 'text-indigo-600' : 'text-slate-400'} />
                                                                        <span className="text-[14px] flex-1">
                                                                            {subItem.label}
                                                                        </span>
                                                                        {subItem.badge > 0 && (
                                                                            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-full shadow-lg shadow-indigo-500/20">
                                                                                {subItem.badge}
                                                                            </span>
                                                                        )}
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
                                            className={`relative flex items-center gap-3.5 px-4 py-2.5 rounded-[12px] transition-all duration-200 ${isActive
                                                ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] text-slate-800 border border-gray-100/80 font-bold'
                                                : 'text-slate-600 hover:bg-gray-100/50 hover:text-slate-900 border border-transparent font-bold'
                                                }`}
                                        >
                                            <Icon className={`w-[22px] h-[22px] flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} strokeWidth={1.5} />
                                            <span className="text-[15px] whitespace-nowrap flex-1">
                                                {item.label}
                                            </span>
                                            {item.badge > 0 && (
                                                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-full shadow-lg shadow-indigo-500/20">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </Link>
                                    )}

                                    {item.hasDivider && (
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

