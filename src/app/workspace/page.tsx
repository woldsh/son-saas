'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import {
    ClipboardList,
    Box,
    AlertCircle,
    CheckCircle2,
    Package,
    Clock,
    Database,
    Zap,
    TrendingUp,
    XCircle,
    FileText,
    Activity,
    ArrowRight,
    CheckSquare,
    FilePlus,
    Bell
} from 'lucide-react';
import { motion } from 'framer-motion';
import ProcurementTeamLeaderDashboardContent from '@/components/ProcurementTeamLeaderDashboardContent';
import StockClerkDashboardContent from '@/components/StockClerkDashboardContent';
import StoreKeeperDashboardContent from '@/components/StoreKeeperDashboardContent';

interface RecentRequest {
    id: string;
    requester: string;
    department: string;
    material: string;
    status: string;
    date: string;
}

export default function WorkspacePage() {
    const { user } = useAuth();
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        pendingRequests: 0,
        totalInventory: 0,
        lowStock: 0,
        processedToday: 0,
        approvedRequests: 0,
        rejectedRequests: 0,
        totalRequests: 0,
        outOfStock: 0,
        totalValue: 0,
        totalQuantity: 0,
        fixedAssets: 0,
        consumables: 0,
    });
    const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!user || !db) { setLoading(false); return; }

            try {
                const userDoc = await getDoc(doc(db!, 'users', user.uid));
                if (userDoc.exists()) {
                    const d = userDoc.data();
                    setUserRole(d.userRole);
                    setUserName(d.displayName || 'User');
                }

                // Fetch all requests
                const allRequestsSnap = await getDocs(collection(db!, 'Request_materials'));
                const sendToUsersSnap = await getDocs(collection(db!, 'Send_to_Users'));
                let pending = 0, approved = 0, rejected = 0;
                const recentList: RecentRequest[] = [];

                allRequestsSnap.docs.forEach(d => {
                    const data = d.data();
                    const s = (data.status || '').toLowerCase();
                    if (s.includes('forwarded_to_team_leader') || s === 'pending_procurement') pending++;
                    else if (s.includes('approved')) approved++;
                    else if (s.includes('rejected')) rejected++;
                    const ts = data.createdAt || data.issued_date;
                    let dateStr = '';
                    if (ts) {
                        const dObj = typeof ts === 'string' ? new Date(ts) : ts.toDate?.() || ts;
                        if (dObj && !isNaN(dObj.getTime())) dateStr = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }
                    recentList.push({ id: d.id, requester: data.requester_name || data.displayName || 'Unknown', department: data.department || data.requester_department || '-', material: data.materialName || data.items?.[0]?.materialName || 'Multiple Items', status: data.status || 'pending', date: dateStr || '-' });
                });
                recentList.sort((a, b) => (a.date === '-' ? 1 : b.date === '-' ? -1 : new Date(b.date).getTime() - new Date(a.date).getTime()));
                setRecentRequests(recentList.slice(0, 5));

                // Materials analysis
                const materialsSnap = await getDocs(collection(db!, 'materials'));
                let lowCount = 0, outOfStock = 0, totalValue = 0, totalQuantity = 0, fixedAssets = 0, consumables = 0;
                materialsSnap.docs.forEach(d => {
                    const data = d.data();
                    const qty = Number(data.quantity) || 0;
                    const price = Number(data.unitPrice) || 0;
                    totalValue += qty * price;
                    totalQuantity += qty;
                    if (qty === 0) outOfStock++;
                    else if (qty <= 10) lowCount++;
                    if (data.materialType === 'fixed_asset') fixedAssets++;
                    else consumables++;
                });

                // Today's completed
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

                setStats({ pendingRequests: pending, totalInventory: materialsSnap.size, lowStock: lowCount, processedToday: todayCount, approvedRequests: approved, rejectedRequests: rejected, totalRequests: allRequestsSnap.size + sendToUsersSnap.size, outOfStock, totalValue, totalQuantity, fixedAssets, consumables });
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    const getRoleTitle = () => {
        if (!userRole) return 'Procurement';
        if (userRole === 'procurement_team_leader') return 'Team Leader';
        if (userRole.includes('stock_clerk')) return 'Stock Clerk';
        if (userRole.includes('store_keeper')) return 'Store Keeper';
        return 'Procurement';
    };

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

    if (userRole === 'procurement_team_leader') {
        return (
            <ProtectedRoute>
                <ProcurementTeamLeaderDashboardContent />
            </ProtectedRoute>
        );
    }

    if (userRole?.includes('stock_clerk')) {
        return (
            <ProtectedRoute>
                <StockClerkDashboardContent />
            </ProtectedRoute>
        );
    }

    if (userRole?.includes('store_keeper')) {
        return (
            <ProtectedRoute>
                <StoreKeeperDashboardContent />
            </ProtectedRoute>
        );
    }

    const containerVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    };



    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-[#F8FAFC]">
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                    className="max-w-7xl mx-auto px-6 md:px-10 py-10 space-y-10"
                >

                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <motion.div variants={itemVariants}>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                                    {getRoleTitle()}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">
                                    {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                                Good {currentTime.getHours() < 12 ? 'Morning' : currentTime.getHours() < 17 ? 'Afternoon' : 'Evening'}, <span className="text-blue-600">{userName.split(' ')[0]}</span>
                            </h1>
                            <p className="mt-2 text-slate-500 font-medium">Here's an overview of your inventory operations today.</p>
                        </motion.div>

                        <motion.div variants={itemVariants} className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="pr-4">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">System Time</p>
                                <p className="text-lg font-black text-slate-900 leading-tight">
                                    {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </p>
                            </div>
                        </motion.div>
                    </div>

                    {/* Operational Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <StatCard
                            icon={Zap}
                            label="Pending Action"
                            value={stats.pendingRequests}
                            subText="Needs Review"
                            accent="blue"
                            pulse={stats.pendingRequests > 0}
                            variants={itemVariants}
                        />
                        <StatCard
                            icon={AlertCircle}
                            label="Critical Stock"
                            value={stats.lowStock}
                            subText="Below Threshold"
                            accent="amber"
                            variants={itemVariants}
                        />
                        <StatCard
                            icon={CheckCircle2}
                            label="Completed"
                            value={stats.processedToday}
                            subText="Daily Throughput"
                            accent="blue"
                            variants={itemVariants}
                        />
                    </div>

                    {/* Team Leader Specific View removed to use ProcurementTeamLeaderDashboardContent */}

                    {/* Stock Clerk Specific View */}
                    {userRole?.includes('stock_clerk') && (
                        <div className="space-y-6">
                            {/* Clerk Quick Stats */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <motion.div variants={itemVariants} className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                            <Database className="w-6 h-6 text-indigo-600" />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">Materials Registered</p>
                                        <h3 className="text-3xl font-black text-slate-900">{stats.totalInventory}</h3>
                                    </div>
                                </motion.div>
                                <motion.div variants={itemVariants} className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                                            <Package className="w-6 h-6 text-emerald-600" />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">Registered Quantity</p>
                                        <h3 className="text-3xl font-black text-slate-900">{stats.totalQuantity.toLocaleString()}</h3>
                                    </div>
                                </motion.div>
                                <motion.div variants={itemVariants} className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                                            <TrendingUp className="w-6 h-6 text-blue-600" />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">Total Value (ETB)</p>
                                        <h3 className="text-3xl font-black text-slate-900">{stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                                    </div>
                                </motion.div>
                            </div>
                            
                            {/* Clerk Quick Actions */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Link href="/workspace/approve-requests" className="bg-white border-2 border-transparent hover:border-indigo-100 p-8 rounded-[2rem] shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 transition-all group">
                                    <div className="flex flex-col items-center text-center gap-4">
                                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                            <CheckSquare className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-xl text-slate-900 tracking-tight mb-2 group-hover:text-indigo-600 transition-colors">Approve Requests</h3>
                                            <p className="text-slate-500 text-sm leading-relaxed">
                                                Review and approve material requisitions from departments.
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                                <Link href="/workspace/register-material" className="bg-white border-2 border-transparent hover:border-emerald-100 p-8 rounded-[2rem] shadow-sm hover:shadow-2xl hover:shadow-emerald-500/10 transition-all group">
                                    <div className="flex flex-col items-center text-center gap-4">
                                        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                                            <FilePlus className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-xl text-slate-900 tracking-tight mb-2 group-hover:text-emerald-600 transition-colors">Register Material</h3>
                                            <p className="text-slate-500 text-sm leading-relaxed">
                                                Add new materials or batches to the system inventory.
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                                <Link href="/workspace/low-stock" className="bg-white border-2 border-transparent hover:border-amber-100 p-8 rounded-[2rem] shadow-sm hover:shadow-2xl hover:shadow-amber-500/10 transition-all group">
                                    <div className="flex flex-col items-center text-center gap-4">
                                        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
                                            <Bell className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-xl text-slate-900 tracking-tight mb-2 group-hover:text-amber-600 transition-colors">Stock Alerts</h3>
                                            <p className="text-slate-500 text-sm leading-relaxed">
                                                Monitor low stock, out of stock, and expiry notifications.
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    )}

                </motion.div>
            </div>
        </ProtectedRoute>
    );
}

function StatCard({ icon: Icon, label, value, subText, accent, pulse, variants }: any) {
    const isBlue = accent === 'blue';
    const isAmber = accent === 'amber';

    return (
        <motion.div
            variants={variants}
            className="bg-white border border-slate-200 rounded-3xl p-6 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 group"
        >
            <div className="flex items-center justify-between mb-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors duration-300 ${isBlue ? 'bg-blue-50 group-hover:bg-blue-600' :
                    isAmber ? 'bg-amber-50 group-hover:bg-amber-500' :
                        'bg-slate-50 group-hover:bg-slate-800'
                    }`}>
                    <Icon className={`w-6 h-6 transition-colors duration-300 ${isBlue ? 'text-blue-600 group-hover:text-white' :
                        isAmber ? 'text-amber-600 group-hover:text-white' :
                            'text-slate-600 group-hover:text-white'
                        }`} />
                </div>
                {pulse && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 rounded-full">
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-[9px] font-black text-red-600 uppercase tracking-wider">Live</span>
                    </div>
                )}
            </div>

            <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">{label}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h3>
                    <span className="text-xs font-bold text-slate-400">{subText}</span>
                </div>
            </div>
        </motion.div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const s = status.toLowerCase();
    let label = status.replace(/_/g, ' ');
    let cls = 'bg-slate-100 text-slate-600';
    if (s.includes('forwarded') || s.includes('pending')) { cls = 'bg-amber-50 text-amber-700'; label = 'Pending'; }
    else if (s.includes('approved')) { cls = 'bg-emerald-50 text-emerald-700'; label = 'Approved'; }
    else if (s.includes('rejected')) { cls = 'bg-red-50 text-red-600'; label = 'Rejected'; }
    else if (s.includes('completed') || s.includes('handout') || s.includes('delivered')) { cls = 'bg-blue-50 text-blue-700'; label = 'Completed'; }
    return <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${cls}`}>{label}</span>;
}

function StockBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-600 font-medium">{label}</span>
                <span className="font-bold text-slate-800">{value} <span className="text-slate-400">({pct}%)</span></span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all duration-1000 ${color}`} style={{ width: `${pct}%` }}></div>
            </div>
        </div>
    );
}
