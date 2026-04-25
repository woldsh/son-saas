'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { FaBoxOpen, FaTimes, FaBell } from 'react-icons/fa';

interface PendingRequest {
    id: string;
    requesterName: string;
    department: string;
    items: { materialName: string }[];
    createdAt: any;
}

export default function RequestNotificationBanner() {
    const { userRole, department } = useAuth();
    const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
    const [dismissed, setDismissed] = useState(false);
    const [lastSeenCount, setLastSeenCount] = useState(0);
    const [isNew, setIsNew] = useState(false);

    useEffect(() => {
        if (!db || !userRole) return;

        const role = userRole.toLowerCase().replace(/\s+/g, '_');
        const requestsRef = collection(db!, 'Request_materials');
        let q;

        // Determine query based on role
        if (role === 'student_service_dormitory_leader') {
            q = query(requestsRef, where('currentApproverRole', '==', 'student_service_dormitory_leader'), where('status', '==', 'pending_department_leader'));
        } else if (role === 'student_service_cafeteria_leader') {
            q = query(requestsRef, where('currentApproverRole', '==', 'student_service_cafeteria_leader'), where('status', '==', 'pending_department_leader'));
        } else if (role === 'student_service_sport_leader') {
            q = query(requestsRef, where('currentApproverRole', '==', 'student_service_sport_leader'), where('status', '==', 'pending_department_leader'));
        } else if (role === 'hrm_leader') {
            q = query(requestsRef, where('currentApproverRole', '==', 'hrm_leader'), where('status', '==', 'pending_department_leader'));
        } else if (role === 'finance_leader') {
            q = query(requestsRef, where('currentApproverRole', '==', 'finance_leader'), where('status', '==', 'pending_department_leader'));
        } else if (role === 'student_service_leader') {
            q = query(requestsRef, where('status', '==', 'pending_student_service_leader'));
        } else if (role.endsWith('_leader')) {
            q = query(requestsRef, where('currentApproverRole', '==', userRole), where('status', '==', 'pending_department_leader'));
        } else if (role.endsWith('_head')) {
            let dept = department;
            if (!dept) dept = role.replace('_head', '');
            if (dept) {
                q = query(requestsRef, where('department', '==', dept), where('currentApproverRole', '==', 'department_head'), where('status', 'in', ['pending', 'pending_department_leader']));
            }
        } else if (role === 'academic_coordinator') {
            q = query(requestsRef, where('currentApproverRole', '==', 'academic_coordinator'), where('status', '==', 'approved_by_head'));
        } else if (role === 'managing_director' || role === 'managing_director_leader') {
            q = query(requestsRef, where('status', 'in', ['approved_by_coordinator', 'pending_managing_director', 'approved_by_student_service_leader']));
        } else if (role === 'general_service_leader') {
            q = query(requestsRef, where('status', 'in', ['approved_by_md', 'pending_general_service']));
        } else if (role === 'procurement_team_leader') {
            q = query(requestsRef, where('currentApproverRole', '==', 'procurement_team_leader'), where('status', 'in', ['forwarded_to_team_leader', 'pending_procurement']));
        } else if (role.includes('stock_clerk')) {
            q = query(requestsRef, where('currentApproverRole', '==', userRole), where('status', '==', 'approved_by_procurement_team_leader'));
        } else if (role.includes('store_keeper')) {
            // Store Keepers do not use this notification.
            // Fulfillment is handled via Store Verification when the employee verifies their code.
            return;
        }

        if (!q) return;

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as PendingRequest[];

            if (requests.length > lastSeenCount && lastSeenCount > 0) {
                setIsNew(true);
                setDismissed(false);
            }
            setLastSeenCount(requests.length);
            setPendingRequests(requests);
        });

        return () => unsubscribe();
    }, [userRole, department]);

    useEffect(() => {
        if (pendingRequests.length > 0 && isNew) {
            const timer = setTimeout(() => setIsNew(false), 15000);
            return () => clearTimeout(timer);
        }
    }, [isNew, pendingRequests.length]);

    if (pendingRequests.length === 0 || dismissed) return null;

    const latestRequest = pendingRequests[0];
    const totalItems = pendingRequests.reduce((sum, r) => sum + (r.items?.length || 0), 0);

    const normalizedRole = userRole?.toLowerCase().replace(/\s+/g, '_') || '';
    let basePath = '/admin-staff/team-leader';
    let approvalPath = '/view-requests';

    if (normalizedRole) {
        if (normalizedRole === 'academic_coordinator') {
            basePath = '/dashboard';
            approvalPath = '/approve-requests';
        }
        else if (normalizedRole.endsWith('_head') || normalizedRole.endsWith('_teacher')) {
            basePath = '/dashboard';
            approvalPath = '/approve-requests';
        }
        else if (normalizedRole.includes('_leader') && !['managing_director_leader', 'general_service_leader', 'procurement_team_leader'].includes(normalizedRole)) {
            basePath = '/admin-staff/team-leader';
            approvalPath = '/approve-requests';
        }
        else if (normalizedRole === 'managing_director' || normalizedRole === 'chief' || normalizedRole === 'managing_director_leader') {
            basePath = '/portal';
            approvalPath = '/view-requests';
        }
        else if (normalizedRole === 'general_service_leader') {
            basePath = '/service';
            approvalPath = '/view-requests';
        }
        else if (normalizedRole === 'procurement_team_leader') {
            basePath = '/workspace';
            approvalPath = '/approve-requests';
        }
        else if (normalizedRole.includes('stock_clerk')) {
            basePath = normalizedRole.includes('consumable') ? '/procurement-management/stock-clerk/consumable-material' : '/procurement-management/stock-clerk/fixed-material';
            approvalPath = '/view-requests-pmt';
        }
        else if (normalizedRole.includes('store_keeper')) {
            basePath = normalizedRole.includes('consumable') ? '/procurement-management/store/consumable-material' : '/procurement-management/store/fixed-material';
            approvalPath = '/requests';
        }
    }

    return (
        <div className={`w-full max-w-7xl mx-auto mb-6 px-4 md:px-8 transition-all duration-700 ease-out ${isNew ? 'animate-in slide-in-from-top-4' : ''}`}>
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200 overflow-hidden flex items-stretch hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-shadow">
                {/* Accent line */}
                <div className="w-1.5 bg-rose-500 flex-shrink-0" />

                <div className="flex-1 flex flex-col sm:flex-row items-center justify-between p-4 sm:p-5 gap-4">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0 border-2 border-rose-100 shadow-sm relative">
                            <FaBell className="text-rose-500 text-2xl sm:text-3xl" />
                            {/* Optional: subtle pulse ring around it */}
                            <div className="absolute inset-0 rounded-full border-2 border-rose-400 animate-ping opacity-20"></div>
                        </div>

                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <h3 className="text-slate-800 font-bold text-sm sm:text-base">
                                    {pendingRequests.length === 1
                                        ? `Material Request from ${latestRequest?.requesterName || 'Employee'}`
                                        : `${pendingRequests.length} Pending Material Requests`
                                    }
                                </h3>
                                {isNew && (
                                    <span className="bg-rose-500 text-white text-[9px] uppercase font-black px-2 py-0.5 rounded-full tracking-wider animate-pulse">
                                        New
                                    </span>
                                )}
                            </div>
                            <p className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5 flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                </span>
                                {pendingRequests.length === 1
                                    ? `${totalItems} item${totalItems !== 1 ? 's' : ''} awaiting your review and approval`
                                    : `${totalItems} total items across ${pendingRequests.length} requests need your attention`
                                }
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0 pl-14 sm:pl-0">
                        <Link
                            href={`${basePath}${approvalPath}`}
                            className="flex-1 sm:flex-none px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 group"
                        >
                            Review Now
                            <FaBoxOpen className="opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                        </Link>
                        <button
                            onClick={() => setDismissed(true)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Dismiss"
                        >
                            <FaTimes size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
