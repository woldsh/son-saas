'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Clock, CheckCircle2, FileText, ClipboardList, ArrowRight, Box, Package, XCircle, Activity, Users } from 'lucide-react';
import Link from 'next/link';

export default function AdminTeamLeaderPage() {
    const { user, userRole, department } = useAuth();
    const { t } = useLanguage();
    const [userName, setUserName] = useState('');
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
        if (!user?.uid || !userRole || !db) return;

        const fetchData = async () => {
            try {
                // Fetch user doc for name
                const userDoc = await getDoc(doc(db as any, 'users', user.uid));
                if (userDoc.exists()) {
                    setUserName(userDoc.data().displayName || 'Team Leader');
                }

                const dept = department || userRole?.replace('_leader', '') || '';

                // 1. All Team Requests
                let teamDocs: any[] = [];
                if (dept) {
                    const teamReqQuery = query(collection(db as any, 'Request_materials'), where('department', '==', dept));
                    const teamReqSnap = await getDocs(teamReqQuery);
                    teamDocs = teamReqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                } else {
                    // Fallback to fetch all if no specific department bound
                    const allReqSnap = await getDocs(collection(db as any, 'Request_materials'));
                    teamDocs = allReqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
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

                // 4. Materials available for team
                let materialsAssigned = 0;
                if (dept) {
                    const materialsSnap = await getDocs(collection(db as any, 'materials'));
                    const normalizedUserDept = dept.toLowerCase().trim().replace(/_/g, ' ');
                    
                    materialsSnap.forEach(d => {
                        const data = d.data();
                        const tDept = (data.targetDepartment || '').toLowerCase().trim().replace(/_/g, ' ');
                        const tUser = data.targetUser || '';

                        // Check if it belongs to this department and is NOT targeted to a specific individual
                        if ((tDept === normalizedUserDept || (tDept.includes('computer') && normalizedUserDept.includes('cs')) || (tDept.includes('cs') && normalizedUserDept.includes('computer'))) && !tUser) {
                            if (data.items && Array.isArray(data.items)) {
                                materialsAssigned += data.items.length;
                            } else if (data.materialName || data.description) {
                                materialsAssigned += 1;
                            }
                        }
                    });
                }

                // Calculate stats
                let pendingApproval = 0;
                let approved = 0;
                let rejected = 0;
                let completed = 0;

                teamDocs.forEach(d => {
                    const status = String(d.status || '');
                    
                    if (['pending', 'pending_team_leader', 'pending_department_leader'].includes(status) && d.currentApproverRole === userRole) {
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
                    totalRequests: teamDocs.length,
                    approved,
                    rejected,
                    staffCount,
                    materialsAssigned
                });

                // Recent Requests (Team Requests)
                const recent = teamDocs
                    .sort((a, b) => {
                        const tA = a.createdAt?.seconds || a.created_at?.seconds || 0;
                        const tB = b.createdAt?.seconds || b.created_at?.seconds || 0;
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
                    Welcome back, {userName.split(' ')[0] || 'Team Leader'}
                </h1>
                <p className="text-slate-500 mt-2">
                    {department ? `${department.replace(/_/g, ' ')} Team Overview` : 'Team Management Dashboard'}
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
                    href={userRole === 'admin_leader' ? "/admin-staff/team-leader/approve-decisions" : "#"}
                />
                <StatCard
                    title={'Approved'}
                    value={stats.approved}
                    icon={CheckCircle2}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                    href={userRole === 'admin_leader' ? "/admin-staff/team-leader/approve-decisions" : "#"}
                />
                <StatCard
                    title={'Rejected'}
                    value={stats.rejected}
                    icon={XCircle}
                    color="text-red-600"
                    bg="bg-red-50"
                    href={userRole === 'admin_leader' ? "/admin-staff/team-leader/approve-decisions" : "#"}
                />
                <StatCard
                    title={'Total Team Requests'}
                    value={stats.totalRequests}
                    icon={Activity}
                    color="text-blue-600"
                    bg="bg-blue-50"
                    href={userRole === 'admin_leader' ? "/admin-staff/team-leader/approve-decisions" : "#"}
                />
                <StatCard
                    title={t('my_submissions') || 'My Submissions'}
                    value={stats.myRequests}
                    icon={FileText}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                    href="#"
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
                    title={'Team Staff'}
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
                    <h2 className="font-semibold text-slate-800">{t('recent_activity') || 'Recent Team Requests'}</h2>
                    <Link href={userRole === 'admin_leader' ? "/admin-staff/team-leader/approve-decisions" : "#"} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
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
                                            {req.requesterName || req.displayName || req.material_details?.[0]?.materialName || 'Unknown Requester'}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            ID: {req.id?.slice(0, 8).toUpperCase()} • {req.createdAt?.toDate ? new Date(req.createdAt.toDate()).toLocaleDateString() : req.created_at?.toDate ? new Date(req.created_at.toDate()).toLocaleDateString() : 'Recent'}
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
