'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
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
    FiUsers,
    FiPackage,
    FiFileText,
    FiBox,
    FiTrendingDown,
} from 'react-icons/fi';
import RequestDashboardCharts from '@/components/RequestDashboardCharts';
import {
    buildLastNMonthsStackedData,
    countDashboardBuckets,
    dashboardBucketsToPieData,
} from '@/lib/requestChartUtils';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function PortalPage() {
    const { user } = useAuth();
    const [userName, setUserName] = useState('');
    const [stats, setStats] = useState({
        totalRequests: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        totalPersonnel: 0,
        totalInventory: 0,
        totalQuantity: 0,
        totalValue: 0,
        materialsOutFromStore: 0,
    });
    const [recentRequests, setRecentRequests] = useState<any[]>([]);
    const [allRequests, setAllRequests] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(true);

    const bucketCounts = useMemo(
        () => countDashboardBuckets(allRequests as { status?: unknown }[], 'md'),
        [allRequests]
    );
    const pieData = useMemo(() => [
        { name: 'Pending Requests', value: bucketCounts.pending, fill: '#f59e0b' },
        { name: 'Approved', value: bucketCounts.approved, fill: '#10b981' },
        { name: 'Rejected', value: bucketCounts.rejected, fill: '#f43f5e' },
        { name: 'Total Requests', value: bucketCounts.total, fill: '#3b82f6' },
    ].filter(d => d.value > 0), [bucketCounts]);

    const stackedBarData = useMemo(
        () => buildLastNMonthsStackedData(allRequests, 'md', 6),
        [allRequests]
    );

    useEffect(() => {
        const fetchData = async () => {
            if (!user || !db) return;
            try {
                // Fetch user doc for name
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    setUserName(userDoc.data().displayName || 'Director');
                }

                // Fetch all requests
                const requestsRef = collection(db, 'Request_materials');
                const q = query(requestsRef, orderBy('createdAt', 'desc'));
                const snapshot = await getDocs(q);
                const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                const b = countDashboardBuckets(docs as { status?: unknown }[], 'md');

                // Fetch materials in store
                const materialsSnap = await getDocs(collection(db, 'materials'));
                let totalInventoryCount = 0;
                let totalQty = 0;
                let totalVal = 0;
                materialsSnap.forEach(d => {
                    const data = d.data();
                    
                    if (data.items && Array.isArray(data.items)) {
                        data.items.forEach((item: any) => {
                            const qty = Number(item.quantity) || 0;
                            const birr = Number(item.unitPriceBirr) || 0;
                            const cents = Number(item.unitPriceCents) || 0;
                            const price = birr + (cents / 100);
                            
                            totalVal += qty * price;
                            totalQty += qty;
                            totalInventoryCount++;
                        });
                    } else {
                        const qty = Number(data.quantity) || 0;
                        const price = Number(data.unitPrice) || 0;
                        totalVal += qty * price;
                        totalQty += qty;
                        totalInventoryCount++;
                    }
                });

                // Count unique users + total materials out from store (accepted or issued in User-Report)
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
                    totalPersonnel: uniqueHolders.size,
                    totalInventory: totalInventoryCount,
                    totalQuantity: totalQty,
                    totalValue: totalVal,
                    materialsOutFromStore: totalOut,
                });

                setRecentRequests(docs.slice(0, 5));
                setAllRequests(docs);
            } catch (error) {
                console.error('Error fetching MD dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="p-8 min-h-[60vh]">
                    <div className="max-w-7xl mx-auto animate-pulse space-y-8">
                        <div className="h-8 bg-slate-200 rounded w-1/3"></div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-24 bg-slate-200 rounded-xl" />
                            ))}
                        </div>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-slate-50/50">
                <div className="p-6 max-w-7xl mx-auto space-y-8">
                    {/* Header */}
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">
                            Welcome back, {userName.split(' ')[0]}
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Managing Director Dashboard
                        </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <StatCard
                            label="Pending Approvals"
                            value={stats.pending}
                            icon={FiClock}
                            color="text-amber-600"
                            bg="bg-amber-50"
                        />
                        <StatCard
                            label="MD Approved"
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
                            label="Materials Registered"
                            value={stats.totalInventory}
                            icon={FiPackage}
                            color="text-indigo-600"
                            bg="bg-indigo-50"
                        />
                        <StatCard
                            label="Registered Quantity"
                            value={stats.totalQuantity}
                            icon={FiBox}
                            color="text-emerald-600"
                            bg="bg-emerald-50"
                        />
                        <StatCard
                            label="Total Value (ETB)"
                            value={stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) as any}
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
                                href="/portal/approve-requests"
                                title="Review Requests"
                                description="Approve or reject pending material requests."
                                icon={FiClipboard}
                                color="text-blue-600"
                            />
                            <ActionCard
                                href="/portal/full-inventory"
                                title="Material List"
                                description="View all store materials."
                                icon={FiBox}
                                color="text-indigo-600"
                            />
                            <ActionCard
                                href="/portal/analytics"
                                title="Analytics"
                                description="View performance & usage data."
                                icon={FiActivity}
                                color="text-blue-600"
                            />
                            <ActionCard
                                href="/portal/reports"
                                title="View Reports"
                                description="Access operational reports."
                                icon={FiFileText}
                                color="text-emerald-600"
                            />
                        </div>
                    </div>

                    {/* Recent Requests */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-800">Recent Requests</h2>
                            <Link href="/portal/approve-requests" className="text-sm text-blue-600 hover:underline">
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
                                                        {req.requesterName || req.displayName || 'Unknown'} • {req.createdAt?.seconds ? new Date(req.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getStatusBadge(req.status)}`}>
                                                {String(req.status || '').replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
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
    if (['approved', 'completed', 'received', 'issued', 'approved_by_md'].includes(status)) return 'bg-emerald-100 text-emerald-600';
    if (['rejected'].includes(status)) return 'bg-red-100 text-red-600';
    return 'bg-amber-100 text-amber-600';
}

function getStatusBadge(status: string) {
    if (['approved', 'completed', 'received', 'issued', 'approved_by_md'].includes(status)) return 'bg-emerald-100 text-emerald-700';
    if (['rejected'].includes(status)) return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
}
