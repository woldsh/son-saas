'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebar } from '../contexts/SidebarContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useRequestNotification } from '../hooks/useRequestNotification'
import {
    useStockAlerts
} from '../hooks/useStockAlerts';
import { useIsMobile } from '../hooks/useIsMobile';
import { useUserNotifications } from '../hooks/useUserNotifications'
import SidebarResizeHandle from './SidebarResizeHandle';
import SidebarCollapseButton from './SidebarCollapseButton';
import {
    LayoutDashboard,
    Boxes,
    CheckSquare,
    ClipboardList,
    FileText,
    AlertTriangle,
    Grid,
    Clipboard,
    Users,
    BarChart,
    FilePlus,
    History,
    Route,
    FileBarChart,
    MessageSquare,
    Package,
    User,
    AlertCircle,
    Wrench,
    RefreshCw,
    ArrowUpRight,
    ArrowDownLeft,
    Settings,
    ChevronDown,
    ChevronUp,
    Store,
    PlusCircle,
    Layers,
    Search,
    RotateCcw,
    Truck,
    ClipboardCheck,
    Briefcase,
    Send,
    UserCog,
    Bell,
    TrendingDown,
    PackageX,
    Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StoreSidebarProps {
    storeType: 'fixed' | 'consumable';
}

export default function StoreSidebar({ storeType }: StoreSidebarProps) {
    const pathname = usePathname();
    const isFixed = storeType === 'fixed';
    const basePath = '/workspace';
    const { isOpen, closeSidebar, sidebarWidth, isCollapsed } = useSidebar();
    const isMobile = useIsMobile();
    const { t } = useLanguage();
    const { userRole, department } = useAuth();
    const requestCount = useRequestNotification(userRole, department);
    const { feedbackCount, transferCount } = useUserNotifications();
    const stockAlerts = useStockAlerts();
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [openNestedDropdown, setOpenNestedDropdown] = useState<string | null>(null);

    const handleLinkClick = () => {
        if (window.innerWidth < 768) {
            closeSidebar();
        }
    };

    const toggleDropdown = (label: string) => {
        setOpenDropdown(openDropdown === label ? null : label);
    };

    const toggleNestedDropdown = (label: string) => {
        setOpenNestedDropdown(openNestedDropdown === label ? null : label);
    };

    const sectionStyles = {
        fixed: {
            activeBg: 'bg-emerald-50',
            activeText: 'text-emerald-600',
            activeBorder: 'border-emerald-100',
            accent: 'emerald',
            gradient: 'from-emerald-600 to-teal-600'
        },
        consumable: {
            activeBg: 'bg-blue-50',
            activeText: 'text-blue-600',
            activeBorder: 'border-blue-100',
            accent: 'blue',
            gradient: 'from-blue-600 to-indigo-600'
        }
    };

    const styles = isFixed ? sectionStyles.fixed : sectionStyles.consumable;

    const menuItems = [
        { label: t('dashboard'), href: basePath, icon: LayoutDashboard },
        {
            label: t('approvals') || "Approval",
            icon: CheckSquare,
            badge: requestCount,
            subItems: [
                { label: t('view_requests'), href: `${basePath}/requests`, icon: ClipboardList, badge: requestCount },
            ],
            hasDivider: false
        },
        {
            label: "Stock Management",
            icon: Package,
            subItems: [
                { label: t('materials_list'), href: `${basePath}/materials-list`, icon: Layers },
                { label: t('report_data'), href: `${basePath}/report-data`, icon: BarChart },
                { label: t('employee_data'), href: `${basePath}/employee-data`, icon: Users },
                { label: 'Bin Card', href: `${basePath}/bin-card`, icon: Clipboard },
                { label: t('material_transfer_report') || "Material Transfer Report", href: `${basePath}/material-transfer-report`, icon: FileText },
                {
                    label: t('stock_alert') || "Stock Alert",
                    icon: Bell,
                    badge: stockAlerts.lowStock + stockAlerts.outOfStock,
                    subItems: [
                        { label: t('low_stock'), href: `${basePath}/low-stock`, icon: TrendingDown, badge: stockAlerts.lowStock },
                        { label: t('out_of_stock'), href: `${basePath}/out-of-stock`, icon: PackageX, badge: stockAlerts.outOfStock },
                    ]
                },
            ],
            hasDivider: false
        },
        { isHeader: true, label: t('personal_account') || "Personal Account" },
        {
            label: t('requisitions') || "Requisitions",
            icon: ClipboardList,
            subItems: [
                { label: t('request_materials'), href: `${basePath}/request-material`, icon: FilePlus },
                { label: t('my_requisition_history') || 'Requisitions', href: `${basePath}/view-requests`, icon: History },
                { label: t('request_journey'), href: `${basePath}/request-journey`, icon: Truck },
                { label: t('verification_code'), href: `${basePath}/clerk-report`, icon: FileBarChart },
                { label: t('feedback'), href: `${basePath}/feedback`, icon: MessageSquare, badge: feedbackCount },
            ]
        },
        {
            label: t('my_assets') || "My Assets",
            icon: Briefcase,
            subItems: [
                { label: t('my_custody_list') || 'My Custody List', href: `${basePath}/properties`, icon: User },
                { label: `${t('available_materials')} for me`, href: `${basePath}/available-materials`, icon: Boxes },
            ]
        },
        {
            label: t('material_transfer') || "Material Transfer",
            icon: Send,
            subItems: [
                { label: t('material_transfer'), href: `${basePath}/return-goods`, icon: RotateCcw },
            ],
            hasDivider: true
        },
        { label: t('manage_account') || "Manage Account", href: '/manage-account', icon: UserCog },
    ];

    const HeaderIcon = Store;

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
                                <div className={`absolute inset-0 bg-gradient-to-r ${styles.gradient} blur-xl rounded-full translate-y-1 opacity-20`}></div>
                                <div className="relative w-[52px] h-[52px] rounded-[14px] bg-white shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)] flex items-center justify-center border border-gray-50/50">
                                    <HeaderIcon size={24} className={isFixed ? 'text-emerald-600' : 'text-blue-600'} strokeWidth={2.5} />
                                </div>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <h2 className="text-[14px] font-black text-slate-700 leading-tight truncate -mb-0.5 uppercase">
                                    {isFixed ? t('fixed_assets') : t('consumable_items')}
                                </h2>
                                <h3 className="text-[18px] font-black text-slate-900 leading-tight truncate">
                                    {t('store_keeper')}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1.5">
                                    <div className={`w-2 h-2 ${isFixed ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]' : 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.4)]'} rounded-full animate-pulse`}></div>
                                    <p className={`text-[9px] font-black ${isFixed ? 'text-emerald-600' : 'text-blue-600'} uppercase tracking-[0.15em]`}>
                                        ONLINE
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Links */}
                    <nav className="flex-1 overflow-y-auto py-1 px-4 space-y-0.5 custom-scrollbar">
                        {menuItems.map((item, index) => {
                            if (item.isHeader) {
                                return (
                                    <div key={index} className="pt-4 pb-2 px-1">
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            {item.label}
                                        </p>
                                    </div>
                                );
                            }

                            const isDropdown = !!item.subItems;
                            const isDropdownOpen = openDropdown === item.label;
                            const isActive = item.href === basePath
                                ? pathname === basePath
                                : pathname?.startsWith(item.href || '#');

                            const Icon = item.icon as any;

                            return (
                                <div key={index}>
                                    {isDropdown ? (
                                        <div className="space-y-0.5">
                                            <button
                                                onClick={() => toggleDropdown(item.label as string)}
                                                className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-[12px] transition-all duration-200 group ${isDropdownOpen
                                                    ? 'bg-white shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08)] text-slate-800 border border-gray-100/80 font-bold'
                                                    : 'text-slate-600 hover:bg-gray-100/50 hover:text-slate-900 border border-transparent font-bold'
                                                    }`}
                                            >
                                                <Icon className={`w-[22px] h-[22px] flex-shrink-0 ${isDropdownOpen ? 'text-slate-700' : 'text-slate-500'}`} strokeWidth={1.5} />
                                                <span className="text-[15px] whitespace-nowrap flex-1 text-left flex items-center justify-between">
                                                    {item.label}
                                                    {(item as any).badge > 0 && !isDropdownOpen && (
                                                        <div className={`mr-2 flex items-center justify-center min-w-[20px] h-5 px-1.5 ${isFixed ? 'bg-emerald-600 shadow-emerald-600/30' : 'bg-blue-600 shadow-blue-600/30'} rounded-full shadow-[0_0_15px_rgba(0,0,0,0.3)]`}>
                                                            <span className="text-[10px] font-black text-white">{(item as any).badge}</span>
                                                        </div>
                                                    )}
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
                                                        <div className="mt-1 space-y-0.5 pl-4 border-l border-slate-100 ml-4">
                                                            {item.subItems?.map((subItem: any, subIndex: number) => {
                                                                const isNestedDropdown = !!subItem.subItems;
                                                                const isNestedOpen = openNestedDropdown === subItem.label;
                                                                const SubIcon = subItem.icon;

                                                                if (isNestedDropdown) {
                                                                    return (
                                                                        <div key={subIndex} className="space-y-0.5">
                                                                            <button
                                                                                onClick={() => toggleNestedDropdown(subItem.label)}
                                                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${isNestedOpen ? 'bg-slate-50 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                                                            >
                                                                                <SubIcon size={18} className={isNestedOpen ? (isFixed ? 'text-emerald-600' : 'text-blue-600') : 'text-slate-400'} />
                                                                                <span className="text-[13px] font-bold flex-1 text-left">{subItem.label}</span>
                                                                                {subItem.badge > 0 && !isNestedOpen && (
                                                                                    <span className={`flex items-center justify-center min-w-[18px] h-4.5 px-1.5 ${isFixed ? 'bg-emerald-600' : 'bg-blue-600'} text-white text-[9px] font-black rounded-full mr-2`}>
                                                                                        {subItem.badge}
                                                                                    </span>
                                                                                )}
                                                                                {isNestedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                            </button>
                                                                            <AnimatePresence>
                                                                                {isNestedOpen && (
                                                                                    <motion.div
                                                                                        initial={{ opacity: 0, height: 0 }}
                                                                                        animate={{ opacity: 1, height: 'auto' }}
                                                                                        exit={{ opacity: 0, height: 0 }}
                                                                                        className="overflow-hidden pl-4 space-y-0.5 mt-0.5 border-l border-slate-100 ml-3"
                                                                                    >
                                                                                        {subItem.subItems.map((nestedItem: any, nIdx: number) => (
                                                                                            <Link
                                                                                                key={nIdx}
                                                                                                href={nestedItem.href}
                                                                                                onClick={handleLinkClick}
                                                                                                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${pathname === nestedItem.href ? (isFixed ? 'text-emerald-600 bg-emerald-50' : 'text-blue-600 bg-blue-50') : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                                                                                            >
                                                                                                {nestedItem.icon && <nestedItem.icon size={14} className={pathname === nestedItem.href ? (isFixed ? 'text-emerald-600' : 'text-blue-600') : 'text-slate-400'} />}
                                                                                                <span className="flex-1">{nestedItem.label}</span>
                                                                                                {nestedItem.badge > 0 && (
                                                                                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${isFixed ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                                                        {nestedItem.badge}
                                                                                                    </span>
                                                                                                )}
                                                                                            </Link>
                                                                                        ))}
                                                                                    </motion.div>
                                                                                )}
                                                                            </AnimatePresence>
                                                                        </div>
                                                                    );
                                                                }

                                                                const isSubActive = subItem.href ? pathname === subItem.href : false;
                                                                return (
                                                                    <Link
                                                                        key={subIndex}
                                                                        href={subItem.href || '#'}
                                                                        onClick={handleLinkClick}
                                                                        className={`flex items-center gap-3 px-4 py-2.5 rounded-[10px] transition-all duration-200 group ${isSubActive
                                                                            ? `bg-gradient-to-r ${styles.activeBg} ${styles.activeText} shadow-sm font-bold border ${styles.activeBorder}`
                                                                            : 'text-slate-500 hover:bg-gray-50 hover:text-slate-800 font-bold border border-transparent'
                                                                            }`}
                                                                    >
                                                                        <SubIcon size={18} className={isSubActive ? (isFixed ? 'text-emerald-600' : 'text-blue-600') : 'text-slate-400 group-hover:text-slate-600'} />
                                                                        <span className="text-[14px] flex-1">{subItem.label}</span>
                                                                        {subItem.badge > 0 && (
                                                                            <div className={`flex items-center justify-center min-w-[18px] h-4.5 px-1.5 ${isFixed ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'} rounded-full text-[10px] font-black`}>
                                                                                {subItem.badge}
                                                                            </div>
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
                                            href={(item as any).href || '#'}
                                            onClick={handleLinkClick}
                                            className={`relative flex items-center gap-3.5 px-4 py-2.5 rounded-[12px] transition-all duration-200 ${isActive
                                                ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] text-slate-800 border border-gray-100/80 font-bold'
                                                : 'text-slate-600 hover:bg-gray-100/50 hover:text-slate-900 border border-transparent font-bold'
                                                }`}
                                        >
                                            <Icon className={`w-[22px] h-[22px] flex-shrink-0 ${isActive ? 'text-slate-700' : 'text-slate-500'}`} strokeWidth={1.5} />
                                            <span className="text-[15px] whitespace-nowrap flex-1">
                                                {item.label}
                                            </span>
                                            {(item as any).badge > 0 && (
                                                <div className={`flex items-center justify-center min-w-[20px] h-5 px-1.5 ${isFixed ? 'bg-emerald-600 shadow-emerald-600/30' : 'bg-blue-600 shadow-blue-600/30'} rounded-full shadow-[0_0_15px_rgba(0,0,0,0.3)]`}>
                                                    <span className="text-[10px] font-black text-white">{(item as any).badge}</span>
                                                </div>
                                            )}
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

