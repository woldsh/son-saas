'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserAssetsAndFeedback } from '@/hooks/useUserAssetsAndFeedback';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import {
    FiPlusCircle,
    FiClipboard,
    FiBox,
    FiClock,
    FiCheckCircle,
    FiXCircle,
    FiActivity,
    FiPackage,
    FiMessageSquare,
} from 'react-icons/fi';
import RequestDashboardCharts from '@/components/RequestDashboardCharts';
import {
    buildLastNMonthsStackedData,
    countDashboardBuckets,
    dashboardBucketsToPieData,
} from '@/lib/requestChartUtils';

export default function EmployeeDashboard({ userName }: { userName: string }) {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { assetCount, feedbackTotal } = useUserAssetsAndFeedback();
    const [stats, setStats] = useState({
        totalRequests: 0,
        pending: 0,
        approved: 0,
        rejected: 0
    });
    const [recentRequests, setRecentRequests] = useState<any[]>([]);
    const [allRequests, setAllRequests] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(true);

    const bucketCounts = useMemo(
        () => countDashboardBuckets(allRequests as { status?: unknown }[], 'employee'),
        [allRequests]
    );
    const pieData = useMemo(() => dashboardBucketsToPieData(bucketCounts, 'light'), [bucketCounts]);
    const stackedBarData = useMemo(
        () => buildLastNMonthsStackedData(allRequests, 'employee', 6),
        [allRequests]
    );

    useEffect(() => {
        const fetchEmployeeData = async () => {
            if (!user || !db) return;

            try {
                const requestsRef = collection(db, 'Request_materials');
                const q = query(
                    requestsRef,
                    where('requesterId', '==', user.uid),
                    orderBy('createdAt', 'desc')
                );

                const snapshot = await getDocs(q);
                const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const b = countDashboardBuckets(docs as { status?: unknown }[], 'employee');

                setStats({
                    totalRequests: b.total,
                    pending: b.pending,
                    approved: b.approved,
                    rejected: b.rejected,
                });
                setRecentRequests(docs.slice(0, 5)); // Get last 5 requests
                setAllRequests(docs);

            } catch (error) {
                console.error("Error fetching employee data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEmployeeData();
    }, [user]);

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-slate-200 rounded w-1/3"></div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-24 bg-slate-200 rounded" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">
                    Welcome back, {userName.split(' ')[0]}
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    Employee Dashboard
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                    label="Pending Requests"
                    value={stats.pending}
                    icon={FiClock}
                    color="text-amber-600"
                    bg="bg-amber-50"
                />
                <StatCard
                    label="Approved"
                    value={stats.approved}
                    icon={FiCheckCircle}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                />
                <StatCard
                    label="Rejected"
                    value={stats.rejected}
                    icon={FiXCircle}
                    color="text-red-600"
                    bg="bg-red-50"
                />
                <StatCard
                    label="Total Requests"
                    value={stats.totalRequests}
                    icon={FiActivity}
                    color="text-blue-600"
                    bg="bg-blue-50"
                />
                <StatCard
                    label={t('my_assets')}
                    value={assetCount}
                    icon={FiPackage}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                    href="/workspace/properties"
                    hint={t('my_assets_dashboard_sub')}
                />
                <StatCard
                    label={t('total_feedback')}
                    value={feedbackTotal}
                    icon={FiMessageSquare}
                    color="text-sky-600"
                    bg="bg-sky-50"
                    href="/admin-panel/feedback"
                    hint={t('total_feedback_sub')}
                />
            </div>

            <RequestDashboardCharts
                variant="light"
                pieData={pieData}
                stackedBarData={stackedBarData}
                totalRequests={bucketCounts.total}
                pieTitle="Request status"
                barTitle="Last 6 months"
            />

            {/* Quick Actions */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-800">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link
                        href="/admin-panel/request-material"
                        className="col-span-1 md:col-span-2 relative h-48 rounded-2xl overflow-hidden group shadow-md hover:shadow-xl transition-all cursor-pointer"
                    >
                        {/* Background Image / Gradient Placeholder */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700" />
                        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1586769852044-692d6e3703f0?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-40 group-hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />

                        <div className="absolute bottom-0 left-0 p-6 text-white">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-white/20 backdrop-blur-md rounded-lg">
                                    <FiBox className="text-xl" />
                                </div>
                                <span className="bg-blue-500/80 backdrop-blur-sm text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest">
                                    Featured Action
                                </span>
                            </div>
                            <h3 className="text-xl font-bold mb-1">Request Materials</h3>
                            <p className="text-blue-100 text-sm">Submit Form 20 for supplies & equipment.</p>
                        </div>

                        <div className="absolute top-4 right-4 w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <FiPlusCircle className="text-white" />
                        </div>
                    </Link>
                    <ActionCard
                        href="/admin-panel/view-requests"
                        title="View History"
                        description="Track status of your requests."
                        icon={FiClipboard}
                        color="text-blue-600"
                    />
                    <ActionCard
                        href="/admin-panel/clerk-report"
                        title="My Inventory"
                        description="View items currently in your possession."
                        icon={FiBox}
                        color="text-emerald-600"
                    />
                </div>
            </div>

            {/* Recent Activity */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-800">Recent Requests</h2>
                    <Link href="/admin-panel/view-requests" className="text-sm text-blue-600 hover:underline">
                        View All
                    </Link>
                </div>

                <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                    {recentRequests.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            No requests found.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {recentRequests.map((req) => (
                                <div key={req.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-full ${getStatusColor(req.status)}`}>
                                            <FiActivity />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-800">
                                                Request #{req.id.slice(-6).toUpperCase()}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {req.createdAt?.seconds ? new Date(req.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getStatusBadge(req.status)}`}>
                                        {req.status.replace(/_/g, ' ')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper Components
function StatCard({
    label,
    value,
    icon: Icon,
    color,
    bg,
    href,
    hint,
}: {
    label: string;
    value: number;
    icon: ComponentType<{ size?: number }>;
    color: string;
    bg: string;
    href?: string;
    hint?: string;
}) {
    const inner = (
        <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center justify-between h-full group-hover:border-slate-200 transition-colors">
            <div className="min-w-0 pr-2">
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
                {hint ? <p className="text-xs text-slate-400 mt-1 line-clamp-2">{hint}</p> : null}
            </div>
            <div className={`p-3 rounded-lg shrink-0 ${bg} ${color}`}>
                <Icon size={24} />
            </div>
        </div>
    );
    if (href) {
        return (
            <Link
                href={href}
                className="block rounded-xl group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
                {inner}
            </Link>
        );
    }
    return inner;
}

function ActionCard({ href, title, description, icon: Icon, color }: any) {
    return (
        <Link href={href} className="flex flex-col p-6 bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow group">
            <div className={`mb-4 ${color}`}>
                <Icon size={28} />
            </div>
            <h3 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                {title}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
                {description}
            </p>
        </Link>
    );
}

function getStatusColor(status: string) {
    if (['approved', 'completed', 'received'].includes(status)) return 'bg-emerald-100 text-emerald-600';
    if (['rejected'].includes(status)) return 'bg-red-100 text-red-600';
    return 'bg-amber-100 text-amber-600';
}

function getStatusBadge(status: string) {
    if (['approved', 'completed', 'received'].includes(status)) return 'bg-emerald-100 text-emerald-700';
    if (['rejected'].includes(status)) return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
}
