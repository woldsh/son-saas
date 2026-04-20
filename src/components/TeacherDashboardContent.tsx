'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserAssetsAndFeedback } from '@/hooks/useUserAssetsAndFeedback';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import {
    FiClock,
    FiCheckCircle,
    FiXCircle,
    FiActivity,
    FiBox,
    FiPackage,
    FiMessageSquare,
} from 'react-icons/fi';
import RequestDashboardCharts from '@/components/RequestDashboardCharts';
import {
    buildLastNMonthsStackedData,
    countDashboardBuckets,
    dashboardBucketsToPieData,
} from '@/lib/requestChartUtils';

export default function TeacherDashboardContent({ userName }: { userName: string }) {
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
        () => countDashboardBuckets(allRequests as { status?: unknown }[], 'teacher'),
        [allRequests]
    );
    const pieData = useMemo(() => [
        { name: 'Pending Requests', value: bucketCounts.pending, fill: '#f59e0b' },
        { name: 'Approved', value: bucketCounts.approved, fill: '#10b981' },
        { name: 'Rejected', value: bucketCounts.rejected, fill: '#f43f5e' },
        { name: 'Total Requests', value: bucketCounts.total, fill: '#3b82f6' },
        { name: 'My Assets', value: assetCount, fill: '#6366f1' },
        { name: 'Total Feedback', value: feedbackTotal, fill: '#0ea5e9' },
    ].filter(d => d.value > 0), [bucketCounts, assetCount, feedbackTotal]);
    const stackedBarData = useMemo(
        () => buildLastNMonthsStackedData(allRequests, 'teacher', 6),
        [allRequests]
    );

    useEffect(() => {
        const fetchTeacherData = async () => {
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
                const b = countDashboardBuckets(docs as { status?: unknown }[], 'teacher');

                setStats({
                    totalRequests: b.total,
                    pending: b.pending,
                    approved: b.approved,
                    rejected: b.rejected,
                });
                setRecentRequests(docs.slice(0, 5)); // Get last 5 requests
                setAllRequests(docs);

            } catch (error) {
                console.error("Error fetching teacher data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTeacherData();
    }, [user]);

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-slate-200 rounded w-1/3"></div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
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
                <p className="text-slate-500 text-sm mt-1 uppercase font-black">
                    TEACHER DASHBOARD
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
                    href="/dashboard/properties"
                    hint={t('my_assets_dashboard_sub')}
                />
                <StatCard
                    label={t('total_feedback')}
                    value={feedbackTotal}
                    icon={FiMessageSquare}
                    color="text-sky-600"
                    bg="bg-sky-50"
                    href="/dashboard/feedback"
                    hint={t('total_feedback_sub')}
                />
            </div>

            <RequestDashboardCharts
                variant="light"
                pieData={pieData}
                stackedBarData={stackedBarData}
                totalRequests={pieData.reduce((sum, d) => sum + d.value, 0)}
                pieTitle="Dashboard Overview"
                barTitle="Last 6 months"
            />

            {/* Quick Actions - Visual Banner */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                    href="/dashboard/request-material"
                    className="relative h-40 rounded-2xl overflow-hidden group shadow-sm hover:shadow-lg transition-all cursor-pointer border border-slate-100"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600" />
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1586769852044-692d6e3703f0?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-30 group-hover:opacity-40 group-hover:scale-105 transition-all duration-700" />

                    <div className="absolute inset-0 p-6 flex flex-col justify-end">
                        <div className="flex items-center gap-3 text-white">
                            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                <FiBox className="text-xl text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg leading-tight">Request Material</h3>
                                <p className="text-blue-100 text-xs font-medium">Form 20 Requisition</p>
                            </div>
                        </div>
                    </div>
                </Link>

                <Link
                    href="/dashboard/ac-decision"
                    className="relative h-40 rounded-2xl overflow-hidden group shadow-sm hover:shadow-lg transition-all cursor-pointer border border-slate-100"
                >
                    <div className="absolute inset-0 bg-white" />
                    <div className="absolute inset-0 bg-slate-50 opacity-50" />

                    <div className="absolute inset-0 p-6 flex flex-col justify-end">
                        <div className="flex items-center gap-3 text-slate-800">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                                <FiClock className="text-xl text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg leading-tight">Waiting Decisions</h3>
                                <p className="text-slate-500 text-xs font-medium">Check AC status</p>
                            </div>
                        </div>
                    </div>
                </Link>
            </div>

            {/* Recent Activity */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-800">Recent Requests</h2>
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
    if (['approved', 'completed', 'received', 'approved_by_md'].includes(status)) return 'bg-emerald-100 text-emerald-600';
    if (['rejected'].includes(status)) return 'bg-red-100 text-red-600';
    return 'bg-amber-100 text-amber-600';
}

function getStatusBadge(status: string) {
    if (['approved', 'completed', 'received', 'approved_by_md'].includes(status)) return 'bg-emerald-100 text-emerald-700';
    if (['rejected'].includes(status)) return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
}
