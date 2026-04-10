'use client';

import { useEffect, useMemo, useState } from 'react';
import EmployeeSidebar from '@/components/EmployeeSidebar';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserAssetsAndFeedback } from '@/hooks/useUserAssetsAndFeedback';
import { getDisplayNameForRole } from '@/utils/routeConfig';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import RequestDashboardCharts from '@/components/RequestDashboardCharts';
import {
    buildLastNMonthsStackedData,
    countDashboardBuckets,
    dashboardBucketsToPieData,
} from '@/lib/requestChartUtils';
import { FiActivity } from 'react-icons/fi';
import Link from 'next/link';
import Header from '@/components/Header';

export default function AdminEmployeePage() {
    const { user, userRole, department } = useAuth();
    const { t } = useLanguage();
    const { assetCount, feedbackTotal } = useUserAssetsAndFeedback();
    const displayName = department ? `${department} Employee` : getDisplayNameForRole(userRole || '');
    const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
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
        const load = async () => {
            if (!user?.uid || !db) {
                setLoading(false);
                return;
            }
            try {
                const requestsRef = collection(db, 'Request_materials');
                const q = query(
                    requestsRef,
                    where('requesterId', '==', user.uid),
                    orderBy('createdAt', 'desc')
                );
                const snapshot = await getDocs(q);
                const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

                const b = countDashboardBuckets(docs as { status?: unknown }[], 'employee');
                setStats({ pending: b.pending, approved: b.approved, rejected: b.rejected, total: b.total });
                setRecentRequests(docs.slice(0, 5));
                setAllRequests(docs);
            } catch (e) {
                console.error('Employee dashboard load failed', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user?.uid]);

    return (
        <SidebarProvider>
            <div className="min-h-screen bg-gray-50 flex">
                <EmployeeSidebar />

                <div className="flex-1 flex flex-col min-w-0">
                            <div className="sticky top-0 z-40">
                                <Header title="Dashboard" />
                            </div>
                    

                    <main className="flex-1 px-4 sm:px-8 py-6 max-w-7xl w-full mx-auto">
                        {loading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="h-28 bg-white rounded-xl border border-gray-100" />
                                ))}
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                    <StatCard title="Pending" value={stats.pending} hint="Awaiting approval" />
                                    <StatCard title="Approved / done" value={stats.approved} hint="Fulfilled or approved" />
                                    <StatCard title="Rejected" value={stats.rejected} hint="Declined requests" />
                                    <StatCard title="Total requests" value={stats.total} hint="All time" />
                                    <StatCard
                                        title={t('my_assets')}
                                        value={assetCount}
                                        hint={t('my_assets_dashboard_sub')}
                                        href="/workspace/properties"
                                    />
                                    <StatCard
                                        title={t('total_feedback')}
                                        value={feedbackTotal}
                                        hint={t('total_feedback_sub')}
                                        href="/admin-panel/feedback"
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

                                <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-xl font-bold text-gray-900">Recent activity</h2>
                                        <Link
                                            href="/admin-panel/view-requests"
                                            className="text-sm text-blue-600 hover:underline"
                                        >
                                            View all
                                        </Link>
                                    </div>
                                    {recentRequests.length === 0 ? (
                                        <p className="text-gray-600">No material requests yet.</p>
                                    ) : (
                                        <ul className="divide-y divide-gray-100">
                                            {recentRequests.map((req) => (
                                                <li
                                                    key={req.id}
                                                    className="py-3 flex items-center justify-between gap-4"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <span className="p-2 rounded-full bg-slate-100 text-slate-600 shrink-0">
                                                            <FiActivity size={18} />
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-gray-900 truncate">
                                                                Request #{String(req.id).slice(-6).toUpperCase()}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                {req.createdAt?.seconds
                                                                    ? new Date(
                                                                          req.createdAt.seconds * 1000
                                                                      ).toLocaleDateString()
                                                                    : '—'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-semibold uppercase text-gray-600 shrink-0">
                                                        {String(req.status ?? '').replace(/_/g, ' ')}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </>
                        )}
                    </main>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            `}</style>
        </SidebarProvider>
    );
}

function StatCard({
    title,
    value,
    hint,
    href,
}: {
    title: string;
    value: number;
    hint: string;
    href?: string;
}) {
    const body = (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full transition-shadow group-hover:shadow-md group-hover:border-slate-200">
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">{value}</p>
            <p className="text-sm text-gray-500 mt-1">{hint}</p>
        </div>
    );
    if (href) {
        return (
            <Link href={href} className="block rounded-xl group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                {body}
            </Link>
        );
    }
    return body;
}
