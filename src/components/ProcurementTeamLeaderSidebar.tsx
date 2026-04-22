'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import {
    LayoutDashboard,
    ClipboardList,
    CheckSquare,
    FileBarChart,
    Store,
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
    BarChart2,
    Repeat,
    Layers,
    Bell,
    ChevronDown,
    ChevronUp,
    ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRequestNotification } from '../hooks/useRequestNotification'
import { useIsMobile } from '../hooks/useIsMobile';;
import SidebarResizeHandle from './SidebarResizeHandle';
import SidebarCollapseButton from './SidebarCollapseButton';

export default function ProcurementTeamLeaderSidebar() {
    const pathname = usePathname();
    const basePath = '/workspace';
    const { isOpen, closeSidebar, sidebarWidth, isCollapsed } = useSidebar();
    const isMobile = useIsMobile();
    const { userRole, department } = useAuth();
    const { t } = useLanguage();
    const requestCount = useRequestNotification(userRole, department);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [meetingInvite, setMeetingInvite] = useState(false);

    useEffect(() => {
        if (!db || !userRole) return;
        const unsubscribe = onSnapshot(doc(db!, "meeting_sessions", "current_executive_meeting"), (docSnap: any) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const role = userRole.toLowerCase();
                const isInvited = data.invitedRoles.includes(role) || data.isPublic;
                setMeetingInvite(isInvited);
            } else {
                setMeetingInvite(false);
            }
        });
        return () => unsubscribe();
    }, [userRole]);

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
                { label: t('store_report'), href: `${basePath}/store-report`, icon: Store },
                { label: t('view_material_transfer_request'), href: `${basePath}/view-material-transfer-request`, icon: History },
            ],
            hasDivider: true
        },

        { isHeader: true, label: t('personal_account') || "Personal Account" },
        {
            label: t('requisitions'),
            icon: ClipboardList,
            subItems: [
                { label: t('new_requisition'), href: `${basePath}/request-material`, icon: FilePlus },
                { label: t('my_requisition_history'), href: `${basePath}/view-requests`, icon: History },
                { label: t('request_journey'), href: `${basePath}/request-journey`, icon: Route },
                { label: t('verification_code'), href: `${basePath}/clerk-report`, icon: FileBarChart },
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
                { label: t('exchange_report'), href: `${basePath}/exchange-report`, icon: Repeat },
            ],
            hasDivider: true
        },
        { label: t('manage_account'), href: `${basePath}/manage-account`, icon: Settings },

        { isHeader: true, label: t('procurementLabel') || "Procurement Operations" },
        { label: 'Analytics', href: `${basePath}/analytics`, icon: BarChart2 },
        { label: 'Full Inventory', href: `${basePath}/full-inventory`, icon: Layers },
        { label: t('employee_data') || 'Employee Data', href: `${basePath}/employee-data`, icon: User },
        {
            label: t('stock_alert'),
            icon: Bell,
            subItems: [
                { label: t('low_stock'), href: `${basePath}/low-stock`, icon: AlertCircle },
                { label: t('expire_stock'), href: `${basePath}/expiry-alerts`, icon: AlertCircle },
                { label: t('out_of_stock'), href: `${basePath}/out-of-stock`, icon: AlertCircle },
                { label: t('maintenance'), href: `${basePath}/maintenance-alerts`, icon: Wrench },
            ]
        },
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
                            <div className="relative group shadow-2xl shadow-blue-500/20">
                                <div className="absolute -inset-1.5 bg-gradient-to-tr from-blue-600 to-sky-400 rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
                                <div className="relative w-11 h-11 bg-white rounded-xl flex items-center justify-center border border-slate-100/50 shadow-sm group-hover:scale-105 transition-transform duration-300">
                                    <ShieldCheck className="w-6 h-6 text-blue-600" strokeWidth={2.5} />
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[17px] font-bold text-slate-800 tracking-tight leading-none">
                                    {t('team_leader')}
                                </span>
                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.15em] mt-1.5 opacity-80">
                                    {t('procurementLabel')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Items */}
                    <nav className="flex-1 overflow-y-auto px-3.5 py-2 custom-scrollbar space-y-0.5">
                        {menuItems.map((item: any, index) => {
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
                                                    ? 'bg-white shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08)] text-slate-800 border border-gray-100/80 font-semibold'
                                                    : 'text-slate-600 hover:bg-gray-100/50 hover:text-slate-900 border border-transparent'
                                                    }`}
                                            >
                                                <Icon className={`w-[22px] h-[22px] flex-shrink-0 ${isDropdownOpen ? 'text-blue-600' : 'text-slate-500'}`} strokeWidth={1.5} />
                                                <span className="text-[15px] whitespace-nowrap flex-1 text-left">
                                                    {item.label}
                                                </span>
                                                {item.badge > 0 && !isDropdownOpen && (
                                                    <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-blue-600 text-white text-[10px] font-black rounded-full shadow-lg shadow-blue-500/20 mr-2">
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
                                                                            ? 'bg-blue-50/40 text-blue-700 font-medium'
                                                                            : 'text-slate-500 hover:bg-gray-100/40 hover:text-slate-800'
                                                                            }`}
                                                                    >
                                                                        <SubIcon size={18} strokeWidth={1.5} className={isSubActive ? 'text-blue-600' : 'text-slate-400'} />
                                                                        <span className="text-[14px]">
                                                                            {subItem.label}
                                                                        </span>
                                                                        {subItem.badge > 0 && (
                                                                            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-blue-600 text-white text-[10px] font-black rounded-full shadow-lg shadow-blue-500/20 ml-auto">
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
                                                ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] text-slate-800 border border-gray-100/80 font-medium'
                                                : 'text-slate-600 hover:bg-gray-100/50 hover:text-slate-900 border border-transparent'
                                                }`}
                                        >
                                            <Icon className={`w-[22px] h-[22px] flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} strokeWidth={1.5} />
                                            <span className="text-[15px] whitespace-nowrap flex-1">
                                                {item.label}
                                            </span>
                                            {item.badge > 0 && (
                                                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-blue-600 text-white text-[10px] font-black rounded-full shadow-lg shadow-blue-500/20">
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
                    

                    {/* Meeting Invite Notification */}
                    <div className="px-4 py-4 mt-auto">
                        <AnimatePresence mode="wait">
                            {meetingInvite && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    className="relative group overflow-hidden"
                                >
                                    <Link
                                        href="/dashboard/meeting"
                                        className="block p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-200"
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center animate-pulse">
                                                <Bell size={18} className="text-white" />
                                            </div>
                                            <span className="text-[11px] font-black uppercase tracking-wider opacity-80">Meeting Invite</span>
                                        </div>
                                        <p className="text-sm font-bold leading-snug">Chief has invited you to a meeting</p>
                                        <div className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/20 w-fit px-3 py-1.5 rounded-full">
                                            Join Now →
                                        </div>
                                    </Link>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

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

