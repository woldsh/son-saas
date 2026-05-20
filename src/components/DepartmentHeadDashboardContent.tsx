/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Clock, CheckCircle2, FileText, ClipboardList, ArrowRight, Box, Truck, RotateCcw, Users, Package, XCircle, Activity } from 'lucide-react';
import Link from 'next/link';

export default function DepartmentHeadDashboardContent({ userName }: { userName: string }) {
    const { user, userRole, department } = useAuth();
    const { t } = useLanguage();
    const [stats, setStats] = useState({
        pendingApproval: 0,
        myRequests: 0,
        completed: 0,
        totalRequests: 0,
        approved: 0,
        rejected: 0,
        staffCount: 0,
        materialsAssigned: 0
    });
    const [recentRequests, setRecentRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.uid || !db) return;

        const fetchData = async () => {
            if (!db) return;
            try {
                const dept = department || userRole?.replace('_head', '') || '';

                // 1. All Department Requests
                let deptDocs: any[] = [];
                if (dept) {
                    const deptReqQuery = query(collection(db as any, 'Request_materials'), where('department', '==', dept));
                    const deptReqSnap = await getDocs(deptReqQuery);
                    deptDocs = deptReqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                }

                // 2. My Requests
                const myRequestsQuery = query(
                    collection(db as any, 'Request_materials'),
                    where('requesterId', '==', user.uid)
                );
                const myRequestsSnap = await getDocs(myRequestsQuery);
                const myDocs = myRequestsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                // 3. Staff count
                let staffCount = 0;
                if (dept) {
                    const usersQuery = query(collection(db as any, 'users'), where('department', '==', dept));
                    const usersSnap = await getDocs(usersQuery);
                    staffCount = usersSnap.docs.length;
                }

                // 4. Materials assigned to department
                let materialsAssigned = 0;
                if (dept) {
                    const reportsQuery = query(collection(db as any, 'User-Report'), where('department', '==', dept));
                    const reportsSnap = await getDocs(reportsQuery);
                    reportsSnap.forEach(d => {
                        const data = d.data();
                        if (data.status !== 'pending') {
                            materialsAssigned += Number(data.quantity) || 1;
                        }
                    });
                }

                // Calculate stats
                let pendingApproval = 0;
                let approved = 0;
                let rejected = 0;
                let completed = 0;

                deptDocs.forEach(d => {
                    const status = String(d.status || '');
                    // Head needs to approve if status is pending_department_leader
                    if (['pending', 'pending_department_leader'].includes(status) && (d.currentApproverRole === 'department_head' || d.currentApproverRole === userRole)) {
                        pendingApproval++;
                    } else if (status.includes('rejected')) {
                        rejected++;
                    } else if (status === 'completed' || status === 'issued') {
                        completed++;
                        approved++;
                    } else if (status.includes('approved') || status.includes('pending_ac_decision') || status.includes('forwarded')) {
                        approved++;
                    }
                });

                setStats({
                    pendingApproval,
                    myRequests: myDocs.length,
                    completed,
                    totalRequests: deptDocs.length,
                    approved,
                    rejected,
                    staffCount,
                    materialsAssigned
                });

                // Recent Requests (Department Requests)
                const recent = deptDocs
                    .sort((a, b) => {
                        const tA = a.createdAt?.seconds || 0;
                        const tB = b.createdAt?.seconds || 0;
                        return tB - tA;
                    })
                    .slice(0, 5);

                setRecentRequests(recent);

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        const unsubscribe = onSnapshot(collection(db as any, 'Request_materials'), () => {
            fetchData();
        });

        return () => unsubscribe();

    }, [user?.uid, userRole, department]);

    if (loading) {
        return (
            <div className="p-8 flex justify-center min-h-[60vh] items-center bg-slate-50">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8 bg-slate-50 min-h-screen">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                    Welcome back, {userName.split(' ')[0]}
                </h1>
                <p className="text-slate-500 mt-2">
                    {department ? `${department.replace(/_/g, ' ')} Department Overview` : 'Department Management'}
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title={t('pending') || 'Pending Approvals'}
                    value={stats.pendingApproval}
                    icon={Clock}
                    color="text-amber-600"
                    bg="bg-amber-50"
                    href="/dashboard/view-requests"
                />
                <StatCard
                    title={'Approved'}
                    value={stats.approved}
                    icon={CheckCircle2}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                    href="/dashboard/view-requests"
                />
                <StatCard
                    title={'Rejected'}
                    value={stats.rejected}
                    icon={XCircle}
                    color="text-red-600"
                    bg="bg-red-50"
                    href="/dashboard/view-requests"
                />
                <StatCard
                    title={'Total Dept Requests'}
                    value={stats.totalRequests}
                    icon={Activity}
                    color="text-blue-600"
                    bg="bg-blue-50"
                    href="/dashboard/view-requests"
                />
                <StatCard
                    title={t('my_submissions') || 'My Submissions'}
                    value={stats.myRequests}
                    icon={FileText}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                    href="/dashboard/request-material"
                />
                <StatCard
                    title={'Completed Handouts'}
                    value={stats.completed}
                    icon={Box}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                    href="#"
                />
                <StatCard
                    title={'Department Staff'}
                    value={stats.staffCount}
                    icon={Users}
                    color="text-sky-600"
                    bg="bg-sky-50"
                    href="#"
                />
                <StatCard
                    title={'Materials Assigned'}
                    value={stats.materialsAssigned}
                    icon={Package}
                    color="text-rose-600"
                    bg="bg-rose-50"
                    href="#"
                />
            </div>

            {/* Recent Activity Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="font-semibold text-slate-800">{t('activity_label') || 'Recent Department Requests'}</h2>
                    <Link href="/dashboard/view-requests" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                        View All <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                <div className="divide-y divide-slate-100">
                    {recentRequests.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ClipboardList className="w-8 h-8 text-slate-300" />
                            </div>
                            <p className="text-slate-500 font-medium">No recent requests found.</p>
                        </div>
                    ) : (
                        recentRequests.map((req) => (
                            <div key={req.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-slate-900">
                                            {req.requesterName || req.displayName || 'Unknown Requester'}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            ID: {req.id?.slice(0, 8).toUpperCase()} • {req.createdAt?.toDate ? new Date(req.createdAt.toDate()).toLocaleDateString() : 'Recent'}
                                        </p>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold
                                    ${req.status?.includes('approved') || req.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                        req.status?.includes('rejected') ? 'bg-red-100 text-red-700' :
                                            'bg-amber-100 text-amber-700'}`}>
                                    {req.status?.replace(/_/g, ' ') || 'Pending'}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>

        </div>
    );
}

// Simple Stat Card Component
function StatCard({ title, value, icon: Icon, color, bg, href }: { title: string, value: number | string, icon: React.ComponentType<{ className?: string }>, color: string, bg: string, href?: string }) {
    return (
        <Link href={href || '#'} className="block">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow h-full">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-500">{title}</p>
                        <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${bg} ${color}`}>
                        <Icon className="w-6 h-6" />
                    </div>
                </div>
            </div>
        </Link>
    );
}
