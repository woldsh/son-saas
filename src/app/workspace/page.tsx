'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import {
    LayoutDashboard,
    ClipboardList,
    Box,
    AlertCircle,
    CheckCircle2,
    ArrowRight,
    Search,
    Package,
    Truck,
    BarChart3,
    Clock,
    Database,
    Zap
} from 'lucide-react';
import { motion } from 'framer-motion';

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
    });
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

                const requestsRef = collection(db!, 'Request_materials');
                const pendingSnap = await getDocs(
                    query(requestsRef, where('status', 'in', [
                        'forwarded_to_team_leader',
                        'approved_by_procurement_team_leader',
                        'approved_by_clerk'
                    ]))
                );

                const materialsSnap = await getDocs(collection(db!, 'materials'));
                let lowCount = 0;
                materialsSnap.docs.forEach(doc => {
                    const qty = Number(doc.data().quantity) || 0;
                    if (qty <= 10) lowCount++;
                });

                setStats({
                    pendingRequests: pendingSnap.size,
                    totalInventory: materialsSnap.size,
                    lowStock: lowCount,
                    processedToday: 0,
                });
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

    const quickActions = [
        { label: 'View Requests', desc: 'Process material requests', href: '/workspace/approve-requests', icon: ClipboardList },
        { label: 'Material List', desc: 'Browse all items', href: '/workspace/full-inventory', icon: Box },
        { label: 'Low Stock', desc: 'Items needing restock', href: '/workspace/low-stock', icon: AlertCircle },
        { label: 'Analytics', desc: 'Charts & reports', href: '/workspace/analytics', icon: BarChart3 },
        { label: 'Search Material', desc: 'Find specific items', href: '/workspace/search-material', icon: Search },
        { label: 'Receive Goods', desc: 'Log incoming shipments', href: '/workspace/receive-goods', icon: Truck },
    ];

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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
                            icon={Database}
                            label="Catalogued"
                            value={stats.totalInventory}
                            subText="Total Materials"
                            accent="slate"
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

                    {/* Main Content Area */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Quick Actions Grid */}
                        {!userRole?.includes('store_keeper') && (
                            <div className="lg:col-span-2 space-y-6">
                                <motion.div variants={itemVariants} className="flex items-center justify-between">
                                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                        <LayoutDashboard className="w-5 h-5 text-blue-600" />
                                        Operational Shortcuts
                                    </h2>
                                </motion.div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {quickActions.map((action, idx) => (
                                        <motion.div key={action.href} variants={itemVariants}>
                                            <Link
                                                href={action.href}
                                                className="group flex items-center gap-4 p-5 bg-white border border-slate-200 rounded-2xl hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300"
                                            >
                                                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-colors duration-300">
                                                    <action.icon className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors duration-300" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-slate-800 text-[15px]">{action.label}</h3>
                                                    <p className="text-xs text-slate-400 mt-0.5">{action.desc}</p>
                                                </div>
                                                <div className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-blue-600 group-hover:border-blue-100 transition-all">
                                                    <ArrowRight className="w-4 h-4" />
                                                </div>
                                            </Link>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recent Alerts / Info Side Block (Hidden for Keeper) */}
                        {!userRole?.includes('store_keeper') && (
                            <motion.div variants={itemVariants} className="space-y-6">
                                <h2 className="text-xl font-black text-slate-900">System Notification</h2>
                                <div className="bg-blue-600 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-200">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-12 -mb-12 blur-xl"></div>

                                    <div className="relative z-10">
                                        <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
                                            <Zap className="w-6 h-6 text-white" />
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">Inventory Sync Active</h3>
                                        <p className="text-blue-100 text-sm leading-relaxed mb-6">
                                            All stock levels are currently being synchronized with the central repository. Zero latency detected.
                                        </p>
                                        <button className="w-full py-3 bg-white text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors">
                                            Refresh Data
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Store Keeper Specific View */}
                        {userRole?.includes('store_keeper') && (
                            <div className="lg:col-span-3 space-y-6">
                                <motion.div variants={itemVariants} className="flex items-center justify-between">
                                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                        <Package className="w-5 h-5 text-blue-600" />
                                        Keeper Daily Tasks
                                    </h2>
                                </motion.div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Link href="/workspace/requests" className="bg-white border-2 border-transparent hover:border-blue-100 p-8 rounded-[2rem] shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 transition-all group">
                                        <div className="flex items-start gap-6">
                                            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                                                <ClipboardList className="w-8 h-8" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-2xl text-slate-900 tracking-tight mb-2 group-hover:text-blue-600 transition-colors">Verify Handouts</h3>
                                                <p className="text-slate-500 text-sm leading-relaxed">
                                                    Process material requests that have been approved by the clerk. Finalize the issuance and generate the official Model 22.
                                                </p>
                                            </div>
                                        </div>
                                    </Link>

                                    <Link href="/workspace/materials-list" className="bg-white border-2 border-transparent hover:border-emerald-100 p-8 rounded-[2rem] shadow-sm hover:shadow-2xl hover:shadow-emerald-500/10 transition-all group">
                                        <div className="flex items-start gap-6">
                                            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                                                <Box className="w-8 h-8" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-2xl text-slate-900 tracking-tight mb-2 group-hover:text-emerald-600 transition-colors">Store Inventory</h3>
                                                <p className="text-slate-500 text-sm leading-relaxed">
                                                    View the full list of materials currently in your store. Check quantities, bin locations, and monitor low stock levels.
                                                </p>
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>

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
