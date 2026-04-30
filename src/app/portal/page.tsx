'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
    FiClipboard, FiUsers, FiCheckCircle,
    FiArrowRight, FiClock, FiPackage, FiUser,
    FiSettings, FiVideo, FiLayers, FiFileText
} from 'react-icons/fi';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion } from 'framer-motion';

interface RecentRequest {
    id: string;
    requesterName: string;
    materialName: string;
    status: string;
    createdAt: any;
}

export default function PortalPage() {
    const { user } = useAuth();
    const { language } = useLanguage();
    const [userName, setUserName] = useState('');
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    const [pendingCount, setPendingCount] = useState(0);
    const [approvedCount, setApprovedCount] = useState(0);
    const [totalMaterials, setTotalMaterials] = useState(0);
    const [totalUsers, setTotalUsers] = useState(0);
    const [recentPending, setRecentPending] = useState<RecentRequest[]>([]);
    const [recentApproved, setRecentApproved] = useState<RecentRequest[]>([]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchAll = async () => {
            if (!user || !db) { setLoading(false); return; }
            try {
                const userDoc = await getDoc(doc(db!, 'users', user.uid));
                if (userDoc.exists()) setUserName(userDoc.data().displayName || 'Director');

                const pendingSnap = await getDocs(query(collection(db!, 'Request_materials'), where('status', '==', 'approved_by_coordinator')));
                setPendingCount(pendingSnap.size);
                setRecentPending(pendingSnap.docs.slice(0, 5).map(d => {
                    const data = d.data();
                    return { id: d.id, requesterName: data.requesterName || data.displayName || 'Unknown', materialName: data.materialName || data.items?.[0]?.materialName || '', status: data.status, createdAt: data.createdAt };
                }));

                const approvedSnap = await getDocs(query(collection(db!, 'Request_materials'), where('status', '==', 'approved_by_md')));
                setApprovedCount(approvedSnap.size);
                setRecentApproved(approvedSnap.docs.slice(0, 5).map(d => {
                    const data = d.data();
                    return { id: d.id, requesterName: data.requesterName || data.displayName || 'Unknown', materialName: data.materialName || data.items?.[0]?.materialName || '', status: data.status, createdAt: data.createdAt };
                }));

                const matSnap = await getDocs(collection(db!, 'materials'));
                setTotalMaterials(matSnap.size);

                const usersSnap = await getDocs(collection(db!, 'users'));
                setTotalUsers(usersSnap.size);
            } catch (error) {
                console.error('Error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [user]);

    const greeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return language === 'am' ? 'እንደምን አደሩ' : 'Good Morning';
        if (hour < 17) return language === 'am' ? 'እንደምን ዋሉ' : 'Good Afternoon';
        return language === 'am' ? 'እንደምን አመሹ' : 'Good Evening';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-white">
                {/* Header */}
                <div className="px-6 lg:px-8 py-8 border-b border-slate-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">
                                {greeting()}, <span className="text-blue-600">{userName.split(' ')[0]}</span>
                            </h1>
                            <p className="text-sm text-slate-400 mt-1">
                                {currentTime.toLocaleDateString(language === 'am' ? 'am-ET' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                        {pendingCount > 0 && (
                            <a href="/portal/approve-requests" className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors group">
                                <FiClock className="text-amber-600" />
                                <span className="font-bold text-amber-900 text-sm">{pendingCount} Pending</span>
                                <FiArrowRight className="text-amber-500 group-hover:translate-x-1 transition-transform" />
                            </a>
                        )}
                    </div>
                </div>

                <div className="px-6 lg:px-8 py-6 space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Pending Approval', value: pendingCount, icon: FiClock, bg: 'bg-amber-50', text: 'text-amber-600' },
                            { label: 'MD Approved', value: approvedCount, icon: FiCheckCircle, bg: 'bg-emerald-50', text: 'text-emerald-600' },
                            { label: 'Total Materials', value: totalMaterials, icon: FiPackage, bg: 'bg-blue-50', text: 'text-blue-600' },
                            { label: 'System Users', value: totalUsers, icon: FiUsers, bg: 'bg-violet-50', text: 'text-violet-600' },
                        ].map((s, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                className="bg-white rounded-xl border border-slate-100 p-5">
                                <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                                    <s.icon className={`${s.text}`} />
                                </div>
                                <p className="text-2xl font-black text-slate-900">{s.value}</p>
                                <p className="text-xs text-slate-400 font-bold mt-1">{s.label}</p>
                            </motion.div>
                        ))}
                    </div>

                    {/* Quick Actions + Pending */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        {/* Quick Actions */}
                        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-100 p-5">
                            <h2 className="text-sm font-black text-slate-900 mb-4">Quick Actions</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {[
                                    { label: 'Review Requests', href: '/portal/approve-requests', icon: FiClipboard, badge: pendingCount },
                                    { label: 'View Reports', href: '/portal/reports', icon: FiFileText },
                                    { label: 'Material List', href: '/portal/full-inventory', icon: FiLayers },
                                    { label: 'Analytics', href: '/portal/analytics', icon: FiPackage },
                                    { label: 'Start Meeting', href: '/portal/start-meeting', icon: FiVideo },
                                    { label: 'Settings', href: '/portal/manage-account', icon: FiSettings },
                                ].map((a, i) => (
                                    <a key={i} href={a.href} className="group flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                                        <a.icon className="text-slate-500 group-hover:text-blue-600 transition-colors" />
                                        <span className="text-sm font-bold text-slate-700 group-hover:text-blue-700">{a.label}</span>
                                        {a.badge && a.badge > 0 && (
                                            <span className="ml-auto px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-full">{a.badge}</span>
                                        )}
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* Pending Queue */}
                        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-black text-slate-900">Pending Queue</h2>
                                <span className="text-xs text-slate-400">{pendingCount} items</span>
                            </div>
                            {recentPending.length > 0 ? (
                                <div className="space-y-2">
                                    {recentPending.map(req => (
                                        <div key={req.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                                            <div className="w-7 h-7 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0">
                                                <FiUser className="text-amber-600 text-xs" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-slate-800 truncate">{req.requesterName}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{req.materialName}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <a href="/portal/approve-requests" className="flex items-center justify-center gap-1 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                        Review All <FiArrowRight className="text-xs" />
                                    </a>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center py-8">
                                    <FiCheckCircle className="text-emerald-400 text-2xl mb-2" />
                                    <p className="text-sm font-bold text-slate-500">All clear</p>
                                    <p className="text-[10px] text-slate-400">No pending requests</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Approvals */}
                    <div className="bg-white rounded-xl border border-slate-100 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-black text-slate-900">Recent Approvals</h2>
                            <span className="text-xs text-slate-400">{approvedCount} total</span>
                        </div>
                        {recentApproved.length > 0 ? (
                            <div className="divide-y divide-slate-50">
                                {recentApproved.map(req => (
                                    <div key={req.id} className="flex items-center gap-3 py-3">
                                        <div className="w-7 h-7 rounded-md bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                            <FiCheckCircle className="text-emerald-600 text-xs" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">{req.requesterName}</p>
                                            <p className="text-[10px] text-slate-400 truncate">{req.materialName}</p>
                                        </div>
                                        <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">Approved</span>
                                        <span className="text-[10px] text-slate-400">{req.createdAt?.toDate?.()?.toLocaleDateString() || ''}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-sm text-slate-400">No approvals yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
