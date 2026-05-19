'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, orderBy, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import {
    FiClipboard,
    FiClock,
    FiCheckCircle,
    FiXCircle,
    FiActivity,
    FiPackage,
    FiFileText,
    FiBox,
    FiTrendingUp,
    FiTrendingDown,
    FiAlertCircle,
    FiUsers,
} from 'react-icons/fi';
import RequestDashboardCharts from '@/components/RequestDashboardCharts';
import {
    buildLastNMonthsStackedData,
    countDashboardBuckets,
    dashboardBucketsToPieData,
} from '@/lib/requestChartUtils';

export default function ProcurementTeamLeaderDashboardContent() {
    const { user } = useAuth();
    const [userName, setUserName] = useState('');
    const [stats, setStats] = useState({
        totalRequests: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        totalValue: 0,
        lowStock: 0,
        outOfStock: 0,
        totalInventory: 0,
        fixedAssets: 0,
        consumables: 0,
        totalPersonnel: 0,
        materialsOutFromStore: 0,
    });
    const [recentRequests, setRecentRequests] = useState<any[]>([]);
    const [allRequests, setAllRequests] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(true);

    const bucketCounts = useMemo(
        () => countDashboardBuckets(allRequests as { status?: unknown }[], 'team_leader'),
        [allRequests]
    );
    const pieData = useMemo(() => [
        { name: 'Pending Requests', value: bucketCounts.pending, fill: '#f59e0b' },
        { name: 'Approved', value: bucketCounts.approved, fill: '#10b981' },
        { name: 'Rejected', value: bucketCounts.rejected, fill: '#f43f5e' },
        { name: 'Total Requests', value: bucketCounts.total, fill: '#3b82f6' },
    ].filter(d => d.value > 0), [bucketCounts]);

    const stackedBarData = useMemo(
        () => buildLastNMonthsStackedData(allRequests, 'team_leader', 6),
        [allRequests]
    );

    useEffect(() => {
        const fetchData = async () => {
            if (!user || !db) return;
            try {
                // Fetch user doc for name
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    setUserName(userDoc.data().displayName || 'Team Leader');
                }

                // Fetch all requests
                const requestsRef = collection(db, 'Request_materials');
                const q = query(requestsRef, orderBy('createdAt', 'desc'));
                const snapshot = await getDocs(q);
                const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                const b = countDashboardBuckets(docs as { status?: unknown }[], 'team_leader');

                // Fetch materials in store for health and value metrics
                const materialsSnap = await getDocs(collection(db, 'materials'));
                let lowCount = 0;
                let outOfStockCount = 0;
                let totalVal = 0;
                let fixedAssetsCount = 0;
                let consumablesCount = 0;

                materialsSnap.forEach(d => {
                    const data = d.data();
                    const qty = Number(data.quantity) || 0;
                    const price = Number(data.unitPrice) || 0;
                    totalVal += qty * price;
                    
                    if (qty === 0) outOfStockCount++;
                    else if (qty <= 10) lowCount++;
                    
                    if (data.materialType === 'fixed_asset') fixedAssetsCount++;
                    else consumablesCount++;
                });

                // Count unique users + total materials out from store
                const userReportSnap = await getDocs(collection(db, 'User-Report'));
                const outDocs = userReportSnap.docs.filter(d => {
                    const s = d.data().status;
                    return s !== 'pending';
                });
                const uniqueHolders = new Set(outDocs.map(d => d.data().requesterId).filter(Boolean));
                const totalOut = outDocs.reduce((sum, d) => sum + (Number(d.data().quantity) || 1), 0);

                setStats({
                    totalRequests: b.total,
                    pending: b.pending,
                    approved: b.approved,
                    rejected: b.rejected,
                    totalValue: totalVal,
                    lowStock: lowCount,
                    outOfStock: outOfStockCount,
                    totalInventory: materialsSnap.size,
                    fixedAssets: fixedAssetsCount,
                    consumables: consumablesCount,
                    totalPersonnel: uniqueHolders.size,
                    materialsOutFromStore: totalOut,
                });

                setAllRequests(docs);
                setRecentRequests(docs.slice(0, 5));
            } catch (error) {
                console.error("Error fetching PTL dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-[3px] border-blue-100 animate-pulse"></div>
                    <div className="absolute inset-0 border-t-[3px] border-blue-600 rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-widest">
                                Property Management
                            </span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                            Good Morning, <span className="text-blue-600">{userName.split(' ')[0]}</span>
                        </h1>
                        <p className="mt-2 text-slate-500 font-medium">
                            Here's your operational overview for today.
                        </p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        label="Pending Approvals"
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
                        label="Users With Materials"
                        value={stats.totalPersonnel}
                        icon={FiUsers}
                        color="text-sky-600"
                        bg="bg-sky-50"
                        hint="Unique users holding accepted items"
                    />
                    <StatCard
                        label="Materials Out from Store"
                        value={stats.materialsOutFromStore}
                        icon={FiTrendingDown}
                        color="text-rose-600"
                        bg="bg-rose-50"
                        hint="Total quantity issued & out of store"
                    />
                    <StatCard
                        label="Total Value (ETB)"
                        value={stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        icon={FiTrendingUp}
                        color="text-emerald-600"
                        bg="bg-emerald-50"
                    />
                    <StatCard
                        label="Critical Stock"
                        value={stats.lowStock}
                        icon={FiAlertCircle}
                        color="text-red-600"
                        bg="bg-red-50"
                        hint="Items low on stock"
                    />
                </div>

                <RequestDashboardCharts
                    variant="light"
                    pieData={pieData}
                    stackedBarData={stackedBarData}
                    totalRequests={pieData.reduce((sum, d) => sum + d.value, 0)}
                    pieTitle="Request Overview"
                    barTitle="Last 6 months"
                />

                {/* Quick Actions */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-slate-800">Quick Actions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <ActionCard
                            href="/workspace/approve-requests"
                            title="Review Requests"
                            description="Approve or reject pending requisitions."
                            icon={FiClipboard}
                            color="text-blue-600"
                        />
                        <ActionCard
                            href="/workspace/analytics"
                            title="Analytics & Health"
                            description="View stock health and usage trends."
                            icon={FiActivity}
                            color="text-indigo-600"
                        />
                        <ActionCard
                            href="/workspace/report-data"
                            title="View Reports"
                            description="Access comprehensive operational reports."
                            icon={FiFileText}
                            color="text-emerald-600"
                        />
                    </div>
                </div>

                {/* Recent Requests */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-800">Recent Requests</h2>
                        <Link href="/workspace/approve-requests" className="text-sm text-blue-600 hover:underline">
                            View All
                        </Link>
                    </div>

                    <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                        {recentRequests.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">
                                No recent requests found.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-50 text-slate-500 border-b">
                                        <tr>
                                            <th className="px-6 py-3 font-medium">Date</th>
                                            <th className="px-6 py-3 font-medium">Requester</th>
                                            <th className="px-6 py-3 font-medium">Department</th>
                                            <th className="px-6 py-3 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {recentRequests.map(req => {
                                            let dateStr = 'Unknown';
                                            if (req.createdAt?.toDate) {
                                                dateStr = req.createdAt.toDate().toLocaleDateString();
                                            } else if (typeof req.createdAt === 'string') {
                                                dateStr = new Date(req.createdAt).toLocaleDateString();
                                            } else if (req.issued_date?.toDate) {
                                                dateStr = req.issued_date.toDate().toLocaleDateString();
                                            }

                                            return (
                                                <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap">{dateStr}</td>
                                                    <td className="px-6 py-4 font-medium text-slate-900">
                                                        {req.requester_name || req.displayName || 'Unknown'}
                                                    </td>
                                                    <td className="px-6 py-4">{req.department || req.requester_department || '-'}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(req.status)}`}>
                                                            {(req.status || 'pending').replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon: Icon, color, bg, href, hint }: any) {
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
    if (!status) return 'bg-amber-100 text-amber-600';
    const s = status.toLowerCase();
    if (['approved', 'completed', 'received', 'issued', 'approved_by_md'].includes(s) || s.includes('approved')) return 'bg-emerald-100 text-emerald-600';
    if (['rejected'].includes(s) || s.includes('rejected')) return 'bg-red-100 text-red-600';
    return 'bg-amber-100 text-amber-600';
}
