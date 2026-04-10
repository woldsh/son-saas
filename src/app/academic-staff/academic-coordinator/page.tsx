'use client';

import { useEffect, useState } from 'react';
import AcademicCoordinatorSidebar from '@/components/AcademicCoordinatorSidebar';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import {
    FiPackage,
    FiTrendingDown,
    FiClipboard,
    FiUsers,
    FiCalendar,
    FiActivity,
    FiArrowRight,
    FiCheckCircle,
    FiClock,
    FiFileText,
    FiAlertCircle,
    FiZap
} from 'react-icons/fi';

interface DashboardStats {
    totalOnStore: number;
    totalOutOfStore: number;
    totalRequests: number;
    totalUserPersonnel: number;
}

export default function AcademicCoordinatorPage() {
    const { user, loading: authLoading } = useAuth();
    const { t, language } = useLanguage();
    const [stats, setStats] = useState<DashboardStats>({
        totalOnStore: 0,
        totalOutOfStore: 0,
        totalRequests: 0,
        totalUserPersonnel: 0,
    });
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchStats = async () => {
            if (!db) return;
            try {
                // Total materials on store (quantity > 0)
                const materialsSnap = await getDocs(collection(db, 'materials'));
                let onStore = 0;
                let outOfStore = 0;
                materialsSnap.forEach((doc) => {
                    const data = doc.data();
                    const qty = Number(data.quantity) || 0;
                    if (qty > 0) {
                        onStore++;
                    } else {
                        outOfStore++;
                    }
                });

                // Total requests
                const requestsSnap = await getDocs(collection(db, 'Request_materials'));

                // Total user personnel
                const usersSnap = await getDocs(collection(db, 'users'));

                setStats({
                    totalOnStore: onStore,
                    totalOutOfStore: outOfStore,
                    totalRequests: requestsSnap.size,
                    totalUserPersonnel: usersSnap.size,
                });
            } catch (error) {
                console.error('Error fetching dashboard stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const greeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return t('good_morning');
        if (hour < 17) return t('good_afternoon');
        return t('good_evening');
    };

    if (authLoading || loading) {
        return (
            <SidebarProvider>
                <div className="min-h-screen bg-white flex">
                    <AcademicCoordinatorSidebar />
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                    </div>
                </div>
            </SidebarProvider>
        );
    }

    const statCards = [
        {
            label: 'Total Material on Store',
            value: stats.totalOnStore,
            icon: FiPackage,
            color: 'bg-blue-600',
            lightColor: 'bg-blue-50',
            textColor: 'text-blue-600',
            borderColor: 'border-blue-100',
            shadowColor: 'shadow-blue-500/30',
            badge: 'In Stock',
            badgeBg: 'bg-blue-100',
            badgeText: 'text-blue-700',
        },
        {
            label: 'Total Material Out of Store',
            value: stats.totalOutOfStore,
            icon: FiTrendingDown,
            color: 'bg-slate-600',
            lightColor: 'bg-slate-50',
            textColor: 'text-slate-600',
            borderColor: 'border-slate-100',
            shadowColor: 'shadow-slate-500/30',
            badge: 'Out of Stock',
            badgeBg: 'bg-slate-100',
            badgeText: 'text-slate-700',
        },
        {
            label: 'Total Requests',
            value: stats.totalRequests,
            icon: FiClipboard,
            color: 'bg-blue-500',
            lightColor: 'bg-blue-50',
            textColor: 'text-blue-500',
            borderColor: 'border-blue-100',
            shadowColor: 'shadow-blue-400/30',
            badge: 'All Time',
            badgeBg: 'bg-blue-100',
            badgeText: 'text-blue-700',
        },
        {
            label: 'Total Material User Personnel',
            value: stats.totalUserPersonnel,
            icon: FiUsers,
            color: 'bg-slate-700',
            lightColor: 'bg-slate-50',
            textColor: 'text-slate-700',
            borderColor: 'border-slate-100',
            shadowColor: 'shadow-slate-500/30',
            badge: 'Personnel',
            badgeBg: 'bg-slate-100',
            badgeText: 'text-slate-700',
        },
    ];

    return (
        <SidebarProvider>
            <div className="min-h-screen bg-white flex overflow-hidden">
                {/* Sidebar */}
                <AcademicCoordinatorSidebar />

                {/* Main Content */}
                <div className="flex-1 flex flex-col h-screen relative overflow-y-auto custom-scrollbar">
                    

                    <main className="flex-1 px-10 py-8 relative z-10">
                        {/* Welcome Section */}
                        <div className="relative mb-10">
                            <div className="relative bg-white border border-slate-100 rounded-3xl p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 overflow-hidden shadow-sm">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rotate-45 translate-x-32 -translate-y-32" />

                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-blue-600" />
                                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em]">Academic Coordinator Dashboard</span>
                                    </div>
                                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                                        {greeting()}, <span className="text-blue-600 italic">Coordinator</span>
                                    </h1>
                                    <p className="text-slate-500 font-medium text-lg">
                                        Overview of material management and store operations.
                                    </p>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="bg-white border border-slate-100 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
                                        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center">
                                            <FiCalendar size={24} className="text-white" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Today</p>
                                            <p className="text-xl font-black text-slate-900">
                                                {currentTime.toLocaleDateString(language === 'am' ? 'am-ET' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                            <p className="text-sm font-black text-blue-600">
                                                {currentTime.toLocaleTimeString(language === 'am' ? 'am-ET' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                            {statCards.map((stat, idx) => (
                                <div
                                    key={idx}
                                    className={`group relative bg-white rounded-3xl border ${stat.borderColor} p-6 shadow-sm hover:shadow-lg transition-all duration-500 hover:-translate-y-1 overflow-hidden`}
                                >
                                    <div className="relative">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className={`w-14 h-14 rounded-2xl ${stat.color} flex items-center justify-center shadow-lg ${stat.shadowColor} group-hover:scale-110 transition-transform duration-300`}>
                                                <stat.icon className="text-2xl text-white" />
                                            </div>
                                            <span className={`px-3 py-1 ${stat.badgeBg} ${stat.badgeText} text-xs font-black rounded-full uppercase tracking-wider`}>
                                                {stat.badge}
                                            </span>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-4xl font-black text-slate-900">{stat.value}</p>
                                            <p className="text-sm font-bold text-slate-500">{stat.label}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Quick Actions */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-10">
                            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900">Quick Actions</h2>
                                        <p className="text-slate-500 font-medium">Frequently used operations</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                                        <FiZap className="text-xl text-blue-600" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <a href="/dashboard/approve-requests" className="group flex items-center gap-4 p-5 bg-blue-50/50 rounded-2xl border-2 border-blue-100 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
                                        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                                            <FiClipboard className="text-xl text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">View Requests</h3>
                                            <p className="text-sm text-slate-500">Review pending approvals</p>
                                        </div>
                                        <FiArrowRight className="text-xl text-blue-500 group-hover:translate-x-2 transition-transform" />
                                    </a>

                                    <a href="/dashboard/full-inventory" className="group flex items-center gap-4 p-5 bg-slate-50/50 rounded-2xl border-2 border-slate-100 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-500/10 transition-all duration-300">
                                        <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center shadow-lg shadow-slate-500/30 group-hover:scale-110 transition-transform">
                                            <FiPackage className="text-xl text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-slate-900 group-hover:text-slate-700 transition-colors">Full Inventory</h3>
                                            <p className="text-sm text-slate-500">View all store materials</p>
                                        </div>
                                        <FiArrowRight className="text-xl text-slate-500 group-hover:translate-x-2 transition-transform" />
                                    </a>

                                    <a href="/dashboard/ac-report" className="group flex items-center gap-4 p-5 bg-blue-50/50 rounded-2xl border-2 border-blue-100 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
                                        <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-400/30 group-hover:scale-110 transition-transform">
                                            <FiFileText className="text-xl text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">View AC Report</h3>
                                            <p className="text-sm text-slate-500">Access coordinator reports</p>
                                        </div>
                                        <FiArrowRight className="text-xl text-blue-500 group-hover:translate-x-2 transition-transform" />
                                    </a>

                                    <a href="/dashboard/analytics" className="group flex items-center gap-4 p-5 bg-slate-50/50 rounded-2xl border-2 border-slate-100 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-500/10 transition-all duration-300">
                                        <div className="w-12 h-12 rounded-xl bg-slate-600 flex items-center justify-center shadow-lg shadow-slate-400/30 group-hover:scale-110 transition-transform">
                                            <FiActivity className="text-xl text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-slate-900 group-hover:text-slate-700 transition-colors">Analytics</h3>
                                            <p className="text-sm text-slate-500">View performance data</p>
                                        </div>
                                        <FiArrowRight className="text-xl text-slate-500 group-hover:translate-x-2 transition-transform" />
                                    </a>
                                </div>
                            </div>

                            {/* Summary Panel */}
                            <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900">Summary</h2>
                                        <p className="text-slate-500 font-medium text-sm">Current status</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                        <FiActivity className="text-lg text-blue-600" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-start gap-4 p-4 bg-blue-50/50 rounded-xl">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                            <FiPackage className="text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">Materials Available</p>
                                            <p className="text-xs text-slate-500">{stats.totalOnStore} items currently in store</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                            <FiAlertCircle className="text-slate-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">Out of Stock</p>
                                            <p className="text-xs text-slate-500">{stats.totalOutOfStore} items need restocking</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4 p-4 bg-blue-50/50 rounded-xl">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                            <FiCheckCircle className="text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">Total Requests</p>
                                            <p className="text-xs text-slate-500">{stats.totalRequests} requests processed</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                            <FiUsers className="text-slate-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">User Personnel</p>
                                            <p className="text-xs text-slate-500">{stats.totalUserPersonnel} active users in system</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </SidebarProvider>
    );
}
