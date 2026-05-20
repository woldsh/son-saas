'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import {
    FiClipboard,
    FiClock,
    FiCheckCircle,
    FiActivity,
    FiTrendingUp,
    FiTrendingDown,
    FiAlertCircle,
    FiUsers,
    FiFilePlus
} from 'react-icons/fi';


export default function StockClerkDashboardContent() {
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
        totalQuantity: 0,
        fixedAssets: 0,
        consumables: 0,
        totalPersonnel: 0,
        materialsOutFromStore: 0,
        processedToday: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!user || !db) return;
            try {
                let currentUserRole = '';
                // Fetch user doc for name
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const uData = userDoc.data();
                    setUserName(uData.displayName || 'Stock Clerk');
                    currentUserRole = uData.userRole || '';
                }

                // Fetch all requests to calculate pending for clerk
                const requestsRef = collection(db, 'Request_materials');
                const snapshot = await getDocs(requestsRef);
                let clerkPending = 0;
                
                snapshot.docs.forEach(docSnap => {
                    const d = docSnap.data();
                    
                    if (d.status !== 'approved_by_procurement_team_leader' && d.status !== 'approved_by_md') {
                        return;
                    }

                    const hasMatchingType = d.items?.some((item: any) => {
                        const itemType = item.materialType?.toLowerCase() || '';
                        if (currentUserRole.includes('fixed')) {
                            return itemType.includes('fixed') || itemType === 'fixed_asset';
                        } else if (currentUserRole.includes('consumable')) {
                            return itemType.includes('consumable') || itemType === 'consumable';
                        }
                        return true;
                    });
                    
                    if (hasMatchingType) {
                        clerkPending++;
                    }
                });

                // Fetch materials in store for health and value metrics
                const materialsSnap = await getDocs(collection(db, 'materials'));
                let lowCount = 0;
                let outOfStockCount = 0;
                let totalVal = 0;
                let totalQuantity = 0;
                let fixedAssetsCount = 0;
                let consumablesCount = 0;

                let totalInventoryCount = 0;

                materialsSnap.forEach(d => {
                    const data = d.data();
                    
                    // Filter by domain (fixed vs consumable)
                    if (currentUserRole.includes('fixed') && data.materialType !== 'fixed_asset') return;
                    if (currentUserRole.includes('consumable') && data.materialType !== 'consumable') return;
                    
                    // Filter by clerk who registered it
                    if (data.registeredBy !== user.uid) return;
                    
                    if (data.items && Array.isArray(data.items)) {
                        data.items.forEach((item: any) => {
                            const qty = Number(item.quantity) || 0;
                            const birr = Number(item.unitPriceBirr) || 0;
                            const cents = Number(item.unitPriceCents) || 0;
                            const price = birr + (cents / 100);
                            
                            totalVal += qty * price;
                            totalQuantity += qty;
                            totalInventoryCount++;
                            
                            if (qty === 0) outOfStockCount++;
                            else if (qty <= 10) lowCount++;
                        });
                    } else {
                        const qty = Number(data.quantity) || 0;
                        const price = Number(data.unitPrice) || 0;
                        totalVal += qty * price;
                        totalQuantity += qty;
                        totalInventoryCount++;
                        
                        if (qty === 0) outOfStockCount++;
                        else if (qty <= 10) lowCount++;
                    }
                    
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

                // Today's completed
                const sendToUsersSnap = await getDocs(collection(db, 'Send_to_Users'));
                const today = new Date(); today.setHours(0, 0, 0, 0);
                let todayCount = 0;
                sendToUsersSnap.docs.forEach(d => {
                    const data = d.data();
                    const ts = data.handout_date || data.createdAt;
                    if (ts) {
                        const dObj = typeof ts === 'string' ? new Date(ts) : ts.toDate?.() || ts;
                        if (dObj && dObj >= today) todayCount++;
                    }
                });

                setStats({
                    totalRequests: snapshot.size,
                    pending: clerkPending,
                    approved: 0,
                    rejected: 0,
                    totalValue: totalVal,
                    lowStock: lowCount,
                    outOfStock: outOfStockCount,
                    totalInventory: totalInventoryCount,
                    totalQuantity: totalQuantity,
                    fixedAssets: fixedAssetsCount,
                    consumables: consumablesCount,
                    totalPersonnel: uniqueHolders.size,
                    materialsOutFromStore: totalOut,
                    processedToday: todayCount,
                });


            } catch (error) {
                console.error("Error fetching Stock Clerk dashboard data:", error);
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
                        label="Pending Action"
                        value={stats.pending}
                        icon={FiClock}
                        color="text-blue-600"
                        bg="bg-blue-50"
                        hint="Needs Review"
                    />
                    <StatCard
                        label="Completed"
                        value={stats.processedToday}
                        icon={FiCheckCircle}
                        color="text-blue-600"
                        bg="bg-blue-50"
                        hint="Daily Throughput"
                    />
                    <StatCard
                        label="Critical Stock"
                        value={stats.lowStock}
                        icon={FiAlertCircle}
                        color="text-amber-600"
                        bg="bg-amber-50"
                        hint="Below Threshold"
                    />
                    <StatCard
                        label="Materials Registered"
                        value={stats.totalInventory}
                        icon={FiActivity}
                        color="text-indigo-600"
                        bg="bg-indigo-50"
                    />
                    <StatCard
                        label="Registered Quantity"
                        value={stats.totalQuantity.toLocaleString()}
                        icon={FiTrendingUp}
                        color="text-emerald-600"
                        bg="bg-emerald-50"
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
                        color="text-blue-600"
                        bg="bg-blue-50"
                    />
                </div>

                {/* Quick Actions */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-slate-800">Quick Actions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <ActionCard
                            href="/workspace/approve-requests"
                            title="Approve Requests"
                            description="Review and approve material requisitions from departments."
                            icon={FiClipboard}
                            color="text-indigo-600"
                        />
                        <ActionCard
                            href="/workspace/register-material"
                            title="Register Material"
                            description="Add new materials or batches to the system inventory."
                            icon={FiFilePlus}
                            color="text-emerald-600"
                        />
                        <ActionCard
                            href="/workspace/low-stock"
                            title="Stock Alerts"
                            description="Monitor low stock, out of stock, and expiry notifications."
                            icon={FiAlertCircle}
                            color="text-amber-600"
                        />
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
