'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import {
    FiClipboard,
    FiBox,
    FiCheckCircle,
    FiActivity,
    FiTrendingUp,
    FiTrendingDown,
    FiAlertCircle,
    FiUsers,
} from 'react-icons/fi';

export default function StoreKeeperDashboardContent() {
    const { user } = useAuth();
    const [userName, setUserName] = useState('');
    const [stats, setStats] = useState({
        pendingPickups: 0,
        completedHandouts: 0,
        totalInventory: 0,
        totalQuantity: 0,
        totalValue: 0,
        lowStock: 0,
        totalPersonnel: 0,
        materialsOutFromStore: 0,
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
                    setUserName(uData.displayName || 'Store Keeper');
                    currentUserRole = uData.userRole || '';
                }

                // Fetch User-Report to get pending pickups and completed handouts
                const userReportRef = collection(db, 'User-Report');
                const userReportSnap = await getDocs(userReportRef);
                
                let pendingPickupsCount = 0;
                let completedHandoutsCount = 0;
                const uniqueHolders = new Set();
                let totalOut = 0;

                userReportSnap.docs.forEach(docSnap => {
                    const d = docSnap.data();
                    
                    // Domain filter
                    const itemType = d.materialType?.toLowerCase() || '';
                    if (currentUserRole.includes('fixed') && !itemType.includes('fixed') && itemType !== 'fixed_asset') return;
                    if (currentUserRole.includes('consumable') && !itemType.includes('consumable') && itemType !== 'consumable') return;

                    if (d.status === 'approved_by_clerk') {
                        pendingPickupsCount++;
                    } else if (d.status === 'completed' || d.status === 'received') {
                        completedHandoutsCount++;
                    }
                    
                    if (d.status !== 'pending') {
                        if (d.requesterId) uniqueHolders.add(d.requesterId);
                        totalOut += (Number(d.quantity) || 1);
                    }
                });

                // Fetch materials in store for health and value metrics
                const materialsSnap = await getDocs(collection(db, 'materials'));
                let lowCount = 0;
                let totalVal = 0;
                let totalQty = 0;
                let totalInventoryCount = 0;

                materialsSnap.forEach(d => {
                    const data = d.data();
                    
                    // Filter by domain (fixed vs consumable)
                    if (currentUserRole.includes('fixed') && data.materialType !== 'fixed_asset') return;
                    if (currentUserRole.includes('consumable') && data.materialType !== 'consumable') return;
                    
                    if (data.items && Array.isArray(data.items)) {
                        data.items.forEach((item: any) => {
                            const qty = Number(item.quantity) || 0;
                            const birr = Number(item.unitPriceBirr) || 0;
                            const cents = Number(item.unitPriceCents) || 0;
                            const price = birr + (cents / 100);
                            
                            totalVal += qty * price;
                            totalQty += qty;
                            totalInventoryCount++;
                            
                            if (qty > 0 && qty <= 10) lowCount++;
                        });
                    } else {
                        const qty = Number(data.quantity) || 0;
                        const price = Number(data.unitPrice) || 0;
                        totalVal += qty * price;
                        totalQty += qty;
                        totalInventoryCount++;
                        
                        if (qty > 0 && qty <= 10) lowCount++;
                    }
                });

                setStats({
                    pendingPickups: pendingPickupsCount,
                    completedHandouts: completedHandoutsCount,
                    totalInventory: totalInventoryCount,
                    totalQuantity: totalQty,
                    totalValue: totalVal,
                    lowStock: lowCount,
                    totalPersonnel: uniqueHolders.size,
                    materialsOutFromStore: totalOut,
                });

            } catch (error) {
                console.error("Error fetching Store Keeper dashboard data:", error);
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
                            Here's your store overview for today.
                        </p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        label="Pending Pickups"
                        value={stats.pendingPickups}
                        icon={FiClipboard}
                        color="text-blue-600"
                        bg="bg-blue-50"
                        hint="Needs Employee Verification"
                    />
                    <StatCard
                        label="Completed Handouts"
                        value={stats.completedHandouts}
                        icon={FiCheckCircle}
                        color="text-blue-600"
                        bg="bg-blue-50"
                        hint="Successfully Issued"
                    />
                    <StatCard
                        label="Critical Stock"
                        value={stats.lowStock}
                        icon={FiAlertCircle}
                        color="text-amber-600"
                        bg="bg-amber-50"
                        hint="Items Low on Stock"
                    />
                    <StatCard
                        label="Materials in Store"
                        value={stats.totalInventory}
                        icon={FiActivity}
                        color="text-indigo-600"
                        bg="bg-indigo-50"
                    />
                    <StatCard
                        label="Total Quantity"
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ActionCard
                            href="/workspace/requests"
                            title="Verify Handouts"
                            description="Process material requests that have been approved by the clerk and finalize the issuance."
                            icon={FiClipboard}
                            color="text-blue-600"
                        />
                        <ActionCard
                            href="/workspace/materials-list"
                            title="Store Inventory"
                            description="View the full list of materials currently in your store and monitor stock levels."
                            icon={FiBox}
                            color="text-emerald-600"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon: Icon, color, bg, hint }: any) {
    return (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 group">
            <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors duration-300 ${bg} ${color.replace('text-', 'group-hover:bg-').replace('600', '500')}`}>
                    <Icon className={`w-6 h-6 transition-colors duration-300 ${color} group-hover:text-white`} />
                </div>
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">{label}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h3>
                </div>
                {hint && (
                    <p className="text-xs font-semibold text-slate-400 mt-2">{hint}</p>
                )}
            </div>
        </div>
    );
}

function ActionCard({ href, title, description, icon: Icon, color }: any) {
    return (
        <Link href={href} className="bg-white border border-slate-200 p-6 rounded-3xl hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all group flex items-start gap-5">
            <div className={`w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-all duration-300 ${color.replace('text-', 'group-hover:bg-')} group-hover:text-white`}>
                <Icon className={`w-7 h-7 ${color} group-hover:text-white transition-colors`} />
            </div>
            <div>
                <h3 className={`font-bold text-lg text-slate-900 mb-1 group-hover:${color} transition-colors`}>{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                    {description}
                </p>
            </div>
        </Link>
    );
}
