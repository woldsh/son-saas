'use client';

import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import {
    FiCheckCircle,
    FiClock,
    FiAlertCircle,
    FiBox,
    FiActivity,
    FiChevronDown,
    FiChevronUp,
    FiUserCheck,
    FiFileText,
    FiTruck,
    FiShield,
    FiBriefcase
} from 'react-icons/fi';
import Image from 'next/image';

interface RequestItem {
    materialName: string;
    quantity: number;
    unit: string;
    image?: string;
    materialCode: string;
}

interface RequestJourney {
    id: string;
    requesterId: string;
    items: RequestItem[];
    status: string;
    createdAt: any;
    currentApproverRole: string;
}

const JOURNEY_STEPS = [
    { id: 'submission', label: 'Submission', status: 'pending', icon: FiFileText, description: 'Request submitted to Dept Head' },
    { id: 'student_service_leader', label: 'Student Service Dean', status: 'pending_student_service_leader', icon: FiUserCheck, description: 'Student Service Dean Approval' },
    { id: 'dept_head', label: 'Dept Head', status: 'approved_by_head', icon: FiUserCheck, description: 'Department Head Approval' },
    { id: 'coordinator', label: 'Coordinator', status: 'approved_by_coordinator', icon: FiShield, description: 'Academic Coordinator Review' },
    { id: 'md', label: 'Director', status: 'approved_by_md', icon: FiBriefcase, description: 'Managing Director Authorization' },
    { id: 'team_leader', label: 'Team Leader', status: 'approved_by_procurement_team_leader', icon: FiActivity, description: 'Procurement Team Oversight' },
    { id: 'clerk', label: 'Store Clerk', status: 'approved_by_clerk', icon: FiBox, description: 'Clerk Verification' },
    { id: 'store', label: 'Store', status: 'completed', icon: FiCheckCircle, description: 'Final Store Fulfillment' }
];

export default function RequestJourneyView() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<RequestJourney[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [userData, setUserData] = useState<any>(null);

    useEffect(() => {
        if (!user) return;

        if (!user || !db) return;

        const q = query(
            collection(db!, 'Request_materials'),
            where('requesterId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedRequests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as RequestJourney[];

            // Sort client-side to avoid Firestore index requirement
            fetchedRequests.sort((a, b) => {
                const dateA = a.createdAt?.seconds || 0;
                const dateB = b.createdAt?.seconds || 0;
                return dateB - dateA;
            });

            setRequests(fetchedRequests);
            setLoading(false);

            // Auto-expand the most recent request
            if (fetchedRequests.length > 0 && expandedIds.size === 0) {
                setExpandedIds(new Set([fetchedRequests[0].id]));
            }
        });

        // Fetch user role for conditional step rendering
        async function fetchUserData() {
            if (user && db) {
                const userDoc = await getDoc(doc(db!, 'users', user!.uid));
                if (userDoc.exists()) {
                    setUserData(userDoc.data());
                }
            }
        }
        fetchUserData();

        return () => unsubscribe();
    }, [user]);

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedIds(newExpanded);
    };

    const getStepStatus = (requestStatus: string, stepIndex: number) => {
        // Map current request status to an index in our JOURNEY_STEPS array
        const statusMap: Record<string, number> = {
            'pending': 0,
            'pending_student_service_leader': 1,
            'approved_by_student_service_leader': 1,
            'pending_managing_director': 4,
            'approved_by_head': 2,
            'approved_by_coordinator': 3,
            'approved_by_md': 4,
            'forwarded_to_team_leader': 4,
            'pending_procurement': 4,
            'approved_by_procurement_team_leader': 5,
            'approved_by_clerk': 6,
            'completed': 7
        };

        const currentStepIndex = statusMap[requestStatus] ?? -1;

        if (stepIndex < currentStepIndex) return 'completed';
        if (stepIndex === currentStepIndex) return 'current';
        return 'pending';
    };

    // --- Filter steps based on user role (all original logic preserved) ---
    const getFilteredSteps = (request: RequestJourney) => {
        return JOURNEY_STEPS.filter(step => {
            const userRole = userData?.userRole;
            const isSpecializedTeamLeader = userRole?.endsWith('_leader') && userRole !== 'procurement_team_leader' && userRole !== 'managing_director_leader';

            if (isSpecializedTeamLeader) {
                return ['md', 'team_leader', 'clerk', 'store'].includes(step.id);
            }

            const isStoreStaff = userRole?.includes('stock_clerk') || userRole?.includes('store_keeper');
            if (isStoreStaff) {
                return ['submission', 'md', 'clerk', 'store'].includes(step.id);
            }

            const isTopLeader = userRole?.endsWith('_leader') && !['student_service_dormitory_leader', 'student_service_sport_leader', 'student_service_cafeteria_leader', 'procurement_team_leader', 'managing_director_leader'].includes(userRole);

            if (isTopLeader && (step.id === 'submission' || step.id === 'student_service_leader' || step.id === 'dept_head' || step.id === 'coordinator')) return false;

            const isServiceLeader = userRole === 'student_service_dormitory_leader' ||
                userRole === 'student_service_sport_leader' ||
                userRole === 'student_service_cafeteria_leader';

            const isAdminFlow = (userRole?.endsWith('_employee') || userRole?.endsWith('_leader')) && !userRole?.includes('student_service_') && !userRole?.includes('procurement_') && !userRole?.includes('managing_director_');

            if (isAdminFlow) {
                if (step.id === 'student_service_leader' || step.id === 'coordinator') return false;
            }

            if (isServiceLeader && (step.id === 'submission' || step.id === 'dept_head' || step.id === 'coordinator')) return false;

            const isTeacher = userRole?.includes('teacher');
            const isStudentServiceEmployee = userRole === 'student_service_dormitory_employee' || userRole === 'student_service_cafeteria_employee' || userRole === 'student_service_sport_employee';
            const isRegularEmployee = !isServiceLeader && !isTopLeader && (isTeacher || userRole?.includes('employee') || userRole === 'standard_user');
            if (isRegularEmployee && !isStudentServiceEmployee && step.id === 'student_service_leader') return false;
            if (isStudentServiceEmployee && step.id === 'coordinator') return false;
            if (isTeacher && step.id === 'md') return false;

            if (userRole?.includes('_head') && (step.id === 'submission' || step.id === 'student_service_leader')) return false;
            if (userData?.subRole === 'department_head' && step.id === 'md') return false;

            if (userRole === 'academic_coordinator' && (step.id === 'submission' || step.id === 'dept_head' || step.id === 'student_service_leader')) return false;

            const isMD = userRole === 'managing_director' || userRole === 'managing_director_leader';
            if (isMD && (step.id === 'submission' || step.id === 'dept_head' || step.id === 'coordinator' || step.id === 'student_service_leader')) return false;

            if (userRole === 'procurement_team_leader' && (step.id === 'submission' || step.id === 'dept_head' || step.id === 'coordinator' || step.id === 'md' || step.id === 'student_service_leader')) return false;

            return true;
        });
    };

    const getStepLabel = (step: typeof JOURNEY_STEPS[0], request: RequestJourney) => {
        let label = step.label;
        let description = step.description;
        const userRole = userData?.userRole;
        const isSpecializedTeamLeader = userRole?.endsWith('_leader') && userRole !== 'procurement_team_leader' && userRole !== 'managing_director_leader';

        if (isSpecializedTeamLeader && step.id === 'md') {
            label = 'Submission (MD)';
            description = 'Request submitted to Managing Director';
        }

        const isStoreStaffFlow = userRole?.includes('stock_clerk') || userRole?.includes('store_keeper');
        if (isStoreStaffFlow) {
            if (step.id === 'submission') description = 'Request submitted to property management team leader';
            else if (step.id === 'md') { label = 'Director'; description = 'Managing Director Authorization'; }
        }

        if (userRole?.includes('_head') && step.id === 'dept_head') {
            label = 'Submission';
            description = 'Request submitted to academic coordinator';
        }

        const isHRMOrFinance = userRole?.includes('hrm') || userRole === 'finance_leader' || userRole === 'finance_employee';
        if (isHRMOrFinance && !isSpecializedTeamLeader) {
            if (step.id === 'submission') description = userRole?.includes('hrm') ? 'Submitted to HRM Team Leader' : 'Submitted to Finance Team Leader';
            else if (step.id === 'dept_head') {
                label = isHRMOrFinance && userRole?.includes('leader') ? 'Submission' : 'Leader Approval';
                description = userRole?.includes('hrm') ? 'HRM Team Leader Review' : 'Finance Team Leader Review';
            }
        }

        const isSSEmployee = userRole === 'student_service_dormitory_employee' || userRole === 'student_service_cafeteria_employee' || userRole === 'student_service_sport_employee';
        if (isSSEmployee) {
            if (step.id === 'submission') description = userRole === 'student_service_dormitory_employee' ? 'Submitted to Dormitory Leader' : userRole === 'student_service_cafeteria_employee' ? 'Submitted to Cafeteria Leader' : 'Submitted to Sport Leader';
            else if (step.id === 'student_service_leader') {
                label = userRole === 'student_service_dormitory_employee' ? 'Dormitory Leader' : userRole === 'student_service_cafeteria_employee' ? 'Cafeteria Leader' : 'Sport Leader';
                description = 'Sub-Leader Approval';
            } else if (step.id === 'dept_head') { label = 'Student Service Dean'; description = 'Dean Approval'; }
        }

        if (userRole === 'academic_coordinator' && step.id === 'coordinator') { label = 'Submission'; description = 'Submitted to managing director'; }
        const isMD = userRole === 'managing_director' || userRole === 'managing_director_leader';
        if (isMD && step.id === 'md') { label = 'Submission'; description = 'Forwarded to Procurement'; }
        if (userRole === 'procurement_team_leader' && step.id === 'team_leader') { label = 'Submission'; description = 'Submitted to store clerk'; }

        return { label, description };
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
            {/* Header */}
            <div className="flex items-baseline gap-3">
                <h1 className="text-lg font-bold text-gray-900">Request Journey</h1>
                <span className="text-sm text-gray-500">— Real-time material request tracking</span>
            </div>

            {/* Requests List */}
            <div className="space-y-4">
                {requests.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
                        <FiBox className="mx-auto text-3xl text-gray-300 mb-3" />
                        <p className="text-sm font-medium text-gray-500">No requests found.</p>
                        <p className="text-xs text-gray-400 mt-1">You haven't submitted any material requests yet.</p>
                    </div>
                ) : (
                    requests.map((request) => {
                        const filteredSteps = getFilteredSteps(request);
                        return (
                            <div key={request.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                {/* Collapsed Header */}
                                <div
                                    onClick={() => toggleExpand(request.id)}
                                    className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg
                                            ${request.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                            {request.status === 'completed' ? <FiCheckCircle /> : <FiClock />}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-800 text-sm">
                                                {request.items[0]?.materialName}
                                                {request.items.length > 1 && <span className="text-gray-400 font-normal ml-1">+{request.items.length - 1}</span>}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-gray-400 font-medium">#{request.id.slice(0, 8)}</span>
                                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                <span className="text-xs text-gray-400 font-medium">
                                                    {request.createdAt?.toDate().toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize
                                            ${request.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                                            {request.status.replace(/_/g, ' ')}
                                        </span>
                                        {expandedIds.has(request.id) ? <FiChevronUp className="text-gray-400 w-5 h-5" /> : <FiChevronDown className="text-gray-400 w-5 h-5" />}
                                    </div>
                                </div>

                                {/* Expanded Timeline */}
                                {expandedIds.has(request.id) && (
                                    <div className="px-6 py-5 border-t border-gray-100 bg-gray-50/50">
                                        {/* Items */}
                                        <div className="mb-6 flex flex-wrap gap-3">
                                            {request.items.map((item, idx) => (
                                                <div key={idx} className="bg-white px-4 py-2 rounded-lg border border-gray-200 flex items-center gap-3 text-sm shadow-sm">
                                                    <FiBox className="text-indigo-400 w-4 h-4" />
                                                    <span className="font-medium text-gray-800">{item.materialName}</span>
                                                    <span className="text-gray-500 font-medium">×{item.quantity}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Timeline Steps - Horizontal */}
                                        <div className="flex items-start gap-0 overflow-x-auto pb-4">
                                            {filteredSteps.map((step, index) => {
                                                const currentStatusIndex = JOURNEY_STEPS.findIndex(s => s.status === request.status);
                                                const thisStepIndex = JOURNEY_STEPS.findIndex(s => s.id === step.id);

                                                let stepStatus = 'pending';
                                                if (currentStatusIndex >= thisStepIndex) stepStatus = 'completed';
                                                else if (currentStatusIndex === thisStepIndex - 1 || (request.status === 'pending_managing_director' && step.id === 'md')) stepStatus = 'current';

                                                if (request.status === 'pending_department_leader') {
                                                    const isSSEmp = userData?.userRole?.startsWith('student_service_') && userData?.userRole?.includes('employee');
                                                    if (isSSEmp) {
                                                        if (step.id === 'submission') stepStatus = 'completed';
                                                        else if (step.id === 'student_service_leader') stepStatus = 'current';
                                                    } else {
                                                        if (step.id === 'submission') stepStatus = 'completed';
                                                        else if (step.id === 'dept_head') stepStatus = 'current';
                                                    }
                                                }

                                                const { label, description } = getStepLabel(step, request);
                                                const Icon = step.icon;

                                                return (
                                                    <div key={step.id} className="flex items-center">
                                                        <div className="flex flex-col items-center min-w-[100px] px-2">
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm border-2 transition-all
                                                                ${stepStatus === 'completed'
                                                                    ? 'bg-emerald-500 border-emerald-400 text-white shadow-md shadow-emerald-500/20'
                                                                    : stepStatus === 'current'
                                                                        ? 'bg-indigo-600 border-indigo-500 text-white ring-4 ring-indigo-100 shadow-md shadow-indigo-600/30'
                                                                        : 'bg-white border-gray-200 text-gray-400'
                                                                }`}>
                                                                <Icon className="w-4 h-4" />
                                                            </div>
                                                            <p className={`text-[11px] font-bold mt-2 text-center leading-tight uppercase tracking-wide
                                                                ${stepStatus === 'completed' ? 'text-emerald-600' : stepStatus === 'current' ? 'text-indigo-600' : 'text-gray-500'}`}>
                                                                {label}
                                                            </p>
                                                            <p className="text-[10px] text-gray-400 text-center leading-tight mt-1 max-w-[110px]">
                                                                {description}
                                                            </p>
                                                        </div>
                                                        {index < filteredSteps.length - 1 && (
                                                            <div className={`w-8 h-0.5 mt-[-36px] ${stepStatus === 'completed' ? 'bg-emerald-400' : 'bg-gray-200'}`}></div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
