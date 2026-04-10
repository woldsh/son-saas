'use client';

import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
    collection,
    query,
    onSnapshot,
    orderBy,
    doc,
    addDoc,
    updateDoc,
    serverTimestamp,
    where,
    getDocs,
    getDoc,
    writeBatch,
    Firestore
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { usePathname } from 'next/navigation';
import {
    FiSearch,
    FiCheckCircle,
    FiXCircle,
    FiClock,
    FiUser,
    FiCalendar,
    FiBox,
    FiChevronRight,
    FiAlertCircle,
    FiInfo,
    FiArrowRight,
    FiActivity,
    FiGrid,
    FiList
} from 'react-icons/fi';
import Image from 'next/image';
import ReadOnlyPaperForm20 from './ReadOnlyPaperForm20';
import ClerkModel22Form from './ClerkModel22Form';
import MaterialRequestReviewModal from './MaterialRequestReviewModal';

interface RequestItem {
    materialId: string;
    materialName: string;
    materialCode: string;
    quantity: number;
    condition: string;
    unit: string;
    materialType: string;
    image?: string; // Add image field
    AC_decition?: string;
    model?: string;
    remarks?: string;
}

interface RequestHistory {
    status: string;
    user: string;
    userName?: string;
    userRole?: string;
    timestamp: string;
    note: string;
}

interface MaterialRequest {
    id: string;
    requesterId: string;
    requesterName: string;
    department: string;
    items: RequestItem[];
    currentApproverId: string;
    currentApproverName: string;
    currentApproverRole: string;
    status: string;
    createdAt: any;
    history: RequestHistory[];
    headApproverName?: string; // Track who approved as head
    headSignature?: string; // Department Head signature
    formType?: string; // 'paper_form_20' or undefined
    receiptNo?: string;
    signature?: string;
    isAdjusted?: boolean;
    isFeedbackSeen?: boolean;
}

interface MaterialRequestViewProps {
    roleOverride?: 'department_head' | 'academic_coordinator' | 'managing_director' | 'general_service' | 'stock_clerk' | 'team_leader' | 'store_keeper' | 'student_service_leader' | 'consumable_item_stock_clerk' | 'fixed_asset_stock_clerk' | 'consumable_item_store_keeper' | 'fixed_asset_store_keeper';
    materialTypeFilter?: 'fixed_asset' | 'consumable';
}

type RoleType = 'department_head' | 'academic_coordinator' | 'requester' | 'procurement_md' | 'chief_executive' | 'managing_director' | 'general_service' | 'stock_clerk' | 'team_leader' | 'store_keeper' | 'dormitory_leader' | 'cafeteria_leader' | 'sports_leader' | 'student_service_leader' | 'hrm_leader' | 'finance_leader' | 'dynamic_leader' | 'consumable_item_stock_clerk' | 'fixed_asset_stock_clerk' | 'consumable_item_store_keeper' | 'fixed_asset_store_keeper';

export default function MaterialRequestView({ roleOverride, materialTypeFilter }: MaterialRequestViewProps) {
    if (!db) return <div className="p-8 text-center text-red-500">Database connection error. Please refresh.</div>;
    const { user } = useAuth();
    const [requests, setRequests] = useState<MaterialRequest[]>([]);
    const [materialImages, setMaterialImages] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [userData, setUserData] = useState<any>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<{ text: string, type: 'coordinator' | 'chief' | 'md' | 'general' } | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
    const [model22Request, setModel22Request] = useState<MaterialRequest | null>(null);
    const pathname = usePathname();
    const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedRequests(filteredRequests.map(r => r.id));
        } else {
            setSelectedRequests([]);
        }
    };

    // Rejection Modal State
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [requestToReject, setRequestToReject] = useState<MaterialRequest | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    // AC Adjustment State
    const [modifiedRequests, setModifiedRequests] = useState<Record<string, RequestItem[]>>({});
    const [adjustmentReasons, setAdjustmentReasons] = useState<Record<string, string>>({});

    const handleItemQuantityChange = (requestId: string, itemIdx: number, newQty: number, originalItems: RequestItem[]) => {
        const sanitizedQty = Math.max(0, newQty);
        const currentModified = modifiedRequests[requestId] || JSON.parse(JSON.stringify(originalItems));
        currentModified[itemIdx].quantity = sanitizedQty;
        setModifiedRequests({
            ...modifiedRequests,
            [requestId]: currentModified
        });
    };

    const isRequestAdjusted = (request: MaterialRequest) => {
        const modified = modifiedRequests[request.id];
        if (!modified) return false;
        return modified.some((item, idx) => item.quantity !== request.items[idx].quantity);
    };


    const filteredRequests = requests.filter(r => {
        // Search term filter
        const matchesSearch = r.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.items.some(item => (item.materialName || '').toLowerCase().includes(searchTerm.toLowerCase()) || (item.materialCode || '').toLowerCase().includes(searchTerm.toLowerCase()));

        // Material type filter (only show requests where ALL items match the filter type)
        const normalizedFilter = (materialTypeFilter || '').toLowerCase().replace(/[^a-z]/g, '');
        const matchesMaterialType = !materialTypeFilter ||
            r.items.every(item => (item.materialType?.toLowerCase() || '') === materialTypeFilter.toLowerCase());

        return matchesSearch && matchesMaterialType;
    });

    const rawRole = roleOverride || (
        pathname?.includes('/portal') ? 'managing_director' :
            pathname?.includes('/dashboard') ? (
                userData?.userRole?.includes('_head') ? 'department_head' :
                    userData?.userRole === 'academic_coordinator' ? 'academic_coordinator' :
                        userData?.userRole || 'academic_coordinator'
            ) :
                pathname?.includes('/service') ? 'general_service' :
                    pathname?.includes('/workspace') ? (
                        userData?.userRole === 'procurement_team_leader' ? 'team_leader' :
                            userData?.userRole?.includes('stock_clerk') ? (userData?.userRole || 'stock_clerk') :
                                userData?.userRole?.includes('store_keeper') ? (userData?.userRole || 'store_keeper') :
                                    'team_leader'
                    ) :
                        pathname?.includes('/admin-staff/team-leader') ? (
                            userData?.userRole === 'student_service_leader' ? 'student_service_leader' :
                                userData?.userRole === 'student_service_dormitory_leader' ? 'dormitory_leader' :
                                    userData?.userRole === 'student_service_cafeteria_leader' ? 'cafeteria_leader' :
                                        userData?.userRole === 'student_service_sport_leader' ? 'sports_leader' :
                                            userData?.userRole === 'hrm_leader' ? 'hrm_leader' :
                                                userData?.userRole === 'finance_leader' ? 'finance_leader' :
                                                    userData?.userRole?.endsWith('_leader') ? 'dynamic_leader' :
                                                        'team_leader'
                        ) :
                            pathname?.includes('/admin-panel') ? (
                                userData?.userRole === 'student_service_leader' ? 'student_service_leader' :
                                    userData?.userRole === 'student_service_dormitory_leader' ? 'dormitory_leader' :
                                        userData?.userRole === 'student_service_cafeteria_leader' ? 'cafeteria_leader' :
                                            userData?.userRole === 'student_service_sport_leader' ? 'sports_leader' :
                                                userData?.userRole === 'hrm_leader' ? 'hrm_leader' :
                                                    userData?.userRole === 'finance_leader' ? 'finance_leader' :
                                                        userData?.userRole?.endsWith('_leader') ? 'dynamic_leader' :
                                                            userData?.userRole?.includes('_head') ? 'department_head' :
                                                                userData?.userRole || 'team_leader'
                            ) :
                                // Check for Stock Clerk and Store Keeper specific roles in the URL or User Role?
                                // This part ensures effectiveRole carries the full role name like 'consumable_item_stock_clerk'
                                pathname?.includes('/procurement-management/stock-clerk') ? (
                                    userData?.userRole || 'stock_clerk'
                                ) :
                                    pathname?.includes('/procurement-management/store') ? (
                                        userData?.userRole || 'store_keeper'
                                    ) :
                                        // Fallback to old path detection for compatibility
                                        pathname?.includes('/managing-director') ? 'managing_director' :
                                            pathname?.includes('/academic-coordinator') ? 'academic_coordinator' :
                                                pathname?.includes('/general-service') ? 'general_service' :
                                                    pathname?.includes('/stock-clerk') ? 'stock_clerk' :
                                                        pathname?.includes('/team-leader') ? 'team_leader' :
                                                            userData?.userRole?.includes('_head') ? 'department_head' :
                                                                'academic_coordinator'
    );

    const effectiveRole = rawRole.toLowerCase().replace(/\s+/g, '_');

    const getRoleTitle = (role: string) => {
        const roles: Record<string, string> = {
            'managing_director': 'Managing Director',
            'academic_coordinator': 'Academic Coordinator',
            'department_head': 'Department Head',
            'general_service': 'General Service',
            'stock_clerk': 'Stock Clerk',
            'store_keeper': 'Store Keeper',
            'team_leader': 'Team Leader',
            'procurement_team_leader': 'Procurement Team Leader',
            'student_service_leader': 'Student Service Leader',
            'dormitory_leader': 'Dormitory Leader',
            'cafeteria_leader': 'Cafeteria Leader',
            'sports_leader': 'Sports Leader',
            'hrm_leader': 'HRM Leader',
            'finance_leader': 'Finance Leader'
        };
        return roles[role] || role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    useEffect(() => {
        // Fetch material images for fallback
        const fetchMaterialImages = async () => {
            if (!db) return;
            const materialsSnap = await getDocs(collection(db!, 'materials'));
            const imageMap: Record<string, string> = {};
            materialsSnap.docs.forEach(doc => {
                const data = doc.data();
                if (data.image) {
                    imageMap[doc.id] = data.image;
                }
            });
            setMaterialImages(imageMap);
        };
        fetchMaterialImages();
    }, []); // Run once on mount to fetch material images

    useEffect(() => {
        const fetchUserProfile = async () => {
            if (user && db) {
                const userDoc = await getDoc(doc(db!, 'users', user.uid));
                if (userDoc.exists()) {
                    setUserData(userDoc.data());
                }
            }
        };
        fetchUserProfile();
    }, [user]);

    useEffect(() => {
        if (!userData || !db) return;

        let q;
        const requestsRef = collection(db!, 'Request_materials');

        if (effectiveRole === 'department_head') {
            let dept = userData.department;
            if (!dept && userData.userRole) {
                dept = userData.userRole.replace('_head', '');
            }
            if (!dept) return;

            q = query(
                requestsRef,
                where('department', '==', dept),
                where('currentApproverRole', '==', 'department_head'),
                where('status', 'in', ['pending', 'pending_department_leader'])
            );
        } else if (effectiveRole === 'dormitory_leader') {
            q = query(requestsRef, where('currentApproverRole', '==', 'student_service_dormitory_leader'), where('status', '==', 'pending_department_leader'));
        } else if (effectiveRole === 'cafeteria_leader') {
            q = query(requestsRef, where('currentApproverRole', '==', 'student_service_cafeteria_leader'), where('status', '==', 'pending_department_leader'));
        } else if (effectiveRole === 'sports_leader') {
            q = query(requestsRef, where('currentApproverRole', '==', 'student_service_sport_leader'), where('status', '==', 'pending_department_leader'));
        } else if (effectiveRole === 'hrm_leader') {
            q = query(requestsRef, where('currentApproverRole', '==', 'hrm_leader'), where('status', '==', 'pending_department_leader'));
        } else if (effectiveRole === 'finance_leader') {
            q = query(requestsRef, where('currentApproverRole', '==', 'finance_leader'), where('status', '==', 'pending_department_leader'));
        } else if (effectiveRole === 'dynamic_leader') {
            q = query(requestsRef, where('currentApproverRole', '==', userData.userRole), where('status', '==', 'pending_department_leader'));
        } else if (effectiveRole === 'student_service_leader') {
            q = query(requestsRef, where('status', '==', 'pending_student_service_leader'));
        } else if (effectiveRole === 'managing_director') {
            q = query(
                requestsRef,
                where('status', 'in', ['approved_by_coordinator', 'pending_managing_director', 'approved_by_student_service_leader'])
            );
        } else if (effectiveRole === 'general_service') {
            q = query(
                requestsRef,
                where('status', 'in', ['approved_by_md', 'pending_general_service'])
            );
        } else if (effectiveRole.includes('stock_clerk')) {
            const clerkRoles = effectiveRole === 'stock_clerk' 
                ? ['stock_clerk', 'fixed_asset_stock_clerk', 'consumable_item_stock_clerk'] 
                : [effectiveRole];
            q = query(
                collection(db!, 'Request_materials'),
                where('currentApproverRole', 'in', clerkRoles),
                where('status', '==', 'approved_by_procurement_team_leader')
            );
        } else if (effectiveRole.includes('store_keeper')) {
            // Store Keepers do NOT see requests here.
            // Fulfillment happens only via the Store Verification page
            // after the employee verifies their verification code.
            q = query(
                collection(db!, 'Request_materials'),
                where('status', '==', '__none__')
            );
        } else if (effectiveRole === 'team_leader') {
            q = query(
                collection(db!, 'Request_materials'),
                where('status', 'in', ['forwarded_to_team_leader', 'pending_procurement'])
            );
        } else {
            // Academic Coordinator view
            q = query(
                collection(db!, 'Request_materials'),
                where('currentApproverRole', '==', 'academic_coordinator'),
                where('status', '==', 'approved_by_head')
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let requestList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as MaterialRequest[];

            // Filter by material type for stock clerks and store keepers
            if ((effectiveRole.includes('stock_clerk') || effectiveRole.includes('store_keeper')) && materialTypeFilter) {
                requestList = requestList.filter(request => {
                    const hasMatchingType = request.items?.some(item => {
                        const itemType = item.materialType?.toLowerCase() || '';
                        if (materialTypeFilter === 'fixed_asset') {
                            return itemType.includes('fixed') || itemType === 'fixed_asset';
                        } else if (materialTypeFilter === 'consumable') {
                            return itemType.includes('consumable') || itemType === 'consumable';
                        }
                        return true;
                    });
                    return hasMatchingType;
                });
            }

            // Also filter by user's stockType from userData if materialTypeFilter not explicitly set
            if ((effectiveRole.includes('stock_clerk') || effectiveRole.includes('store_keeper')) && !materialTypeFilter && userData?.stockType) {
                requestList = requestList.filter(request => {
                    const hasMatchingType = request.items?.some(item => {
                        const itemType = item.materialType?.toLowerCase() || '';
                        if (userData.stockType === 'fixed_assets' || userData.userRole?.includes('fixed_asset')) {
                            return itemType.includes('fixed') || itemType === 'fixed_asset';
                        } else if (userData.stockType === 'consumable_items' || userData.userRole?.includes('consumable')) {
                            return itemType.includes('consumable') || itemType === 'consumable';
                        }
                        return true;
                    });
                    return hasMatchingType;
                });
            }

            requestList.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateB.getTime() - dateA.getTime();
            });
            setRequests(requestList);
            setLoading(false);
        }, (error) => {
            console.error("Firestore Error in MaterialRequestView:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userData, effectiveRole]);

    const handleApprove = async (request: MaterialRequest, updatedItems?: RequestItem[], adjustmentNote?: string, signature?: string) => {
        if (!user || !userData || !db) return;
        setProcessingId(request.id);

        try {
            const requestRef = doc(db!, 'Request_materials', request.id);

            if (effectiveRole === 'dormitory_leader' || effectiveRole === 'cafeteria_leader' || effectiveRole === 'sports_leader' || effectiveRole === 'hrm_leader' || effectiveRole === 'finance_leader' || effectiveRole === 'dynamic_leader') {
                const isStudentServiceSubLeader = effectiveRole === 'dormitory_leader' || effectiveRole === 'cafeteria_leader' || effectiveRole === 'sports_leader';

                const nextRole = isStudentServiceSubLeader ? 'student_service_leader' : 'managing_director';
                const nextStatus = isStudentServiceSubLeader ? 'pending_student_service_leader' : 'pending_managing_director';

                const nextQuery = query(collection(db!, 'users'), where('userRole', '==', nextRole));
                const nextSnapshot = await getDocs(nextQuery);
                const nextApproverId = nextSnapshot.empty ? `PENDING_${nextRole.toUpperCase()}_ASSIGNMENT` : nextSnapshot.docs[0].id;
                const nextApproverName = nextSnapshot.empty ? nextRole.replace(/_/g, ' ') : nextSnapshot.docs[0].data().displayName;

                await updateDoc(requestRef, {
                    status: nextStatus,
                    currentApproverId: nextApproverId,
                    currentApproverName: nextApproverName,
                    currentApproverRole: nextRole,
                    history: [
                        ...request.history,
                        {
                            status: nextStatus,
                            user: user.uid,
                            userName: userData.displayName || 'Anonymous',
                            userRole: getRoleTitle(effectiveRole),
                            timestamp: new Date().toISOString(),
                            note: `Approved by ${effectiveRole.replace('_', ' ')}. Forwarded to ${nextApproverName}.`
                        }
                    ]
                });
                setSuccessMessage({ text: `Request approved and forwarded to ${nextApproverName}`, type: 'general' });
            } else if (effectiveRole === 'student_service_leader') {
                const mdQuery = query(collection(db!, 'users'), where('userRole', '==', 'managing_director'));
                const mdSnapshot = await getDocs(mdQuery);
                const nextApproverId = mdSnapshot.empty ? 'PENDING_MD_ASSIGNMENT' : mdSnapshot.docs[0].id;
                const nextApproverName = mdSnapshot.empty ? 'Managing Director' : mdSnapshot.docs[0].data().displayName;

                await updateDoc(requestRef, {
                    status: 'pending_managing_director',
                    currentApproverId: nextApproverId,
                    currentApproverName: nextApproverName,
                    currentApproverRole: 'managing_director',
                    history: [
                        ...request.history,
                        {
                            status: 'pending_managing_director',
                            user: user.uid,
                            userName: userData.displayName || 'Anonymous',
                            userRole: getRoleTitle(effectiveRole),
                            timestamp: new Date().toISOString(),
                            note: 'Approved by Student Service Leader. Forwarded to Managing Director.'
                        }
                    ]
                });
                setSuccessMessage({ text: "Request approved and forwarded to Managing Director", type: 'general' });
            } else if (effectiveRole === 'department_head') {
                // Find the Academic Coordinator
                const acQuery = query(
                    collection(db!, 'users'),
                    where('userRole', '==', 'academic_coordinator')
                );
                const acSnapshot = await getDocs(acQuery);

                const nextApproverId = acSnapshot.empty ? 'PENDING_AC_ASSIGNMENT' : acSnapshot.docs[0].id;
                const nextApproverName = acSnapshot.empty ? 'Academic Coordinator' : acSnapshot.docs[0].data().displayName;

                const updateData: any = {
                    status: 'approved_by_head',
                    currentApproverId: nextApproverId,
                    currentApproverName: nextApproverName,
                    currentApproverRole: 'academic_coordinator',
                    headApproverName: userData.displayName || 'Department Head',
                    history: [
                        ...request.history,
                        {
                            status: 'approved_by_head',
                            user: user.uid,
                            userName: userData.displayName || 'Anonymous',
                            userRole: getRoleTitle(effectiveRole),
                            timestamp: new Date().toISOString(),
                            note: 'Request approved by Department Head and forwarded to Academic Coordinator'
                        }
                    ]
                };

                if (signature) {
                    updateData.headSignature = signature;
                }

                await updateDoc(requestRef, updateData);
                setSuccessMessage({
                    text: `Request approved and forwarded to Academic Coordinator (${nextApproverName})`,
                    type: 'coordinator'
                });
            } else if (effectiveRole === 'managing_director') {
                const ptlQuery = query(collection(db!, 'users'), where('userRole', '==', 'procurement_team_leader'));
                const ptlSnapshot = await getDocs(ptlQuery);
                const nextApproverId = ptlSnapshot.empty ? 'PENDING_PTL_ASSIGNMENT' : ptlSnapshot.docs[0].id;
                const nextApproverName = ptlSnapshot.empty ? 'Procurement Team Leader' : ptlSnapshot.docs[0].data().displayName;

                const finalItems = updatedItems || modifiedRequests[request.id] || request.items;
                const finalAdjustmentNote = adjustmentNote || adjustmentReasons[request.id] || '';

                await updateDoc(requestRef, {
                    status: 'pending_procurement',
                    currentApproverId: nextApproverId,
                    currentApproverName: nextApproverName,
                    currentApproverRole: 'procurement_team_leader',
                    items: finalItems,
                    isAdjusted: !!finalAdjustmentNote,
                    isFeedbackSeen: finalAdjustmentNote ? false : true,
                    history: [
                        ...request.history,
                        {
                            status: 'pending_procurement',
                            user: user.uid,
                            userName: userData.displayName || 'Anonymous',
                            userRole: getRoleTitle(effectiveRole),
                            timestamp: new Date().toISOString(),
                            note: finalAdjustmentNote || 'Approved by Managing Director. Forwarded to Procurement Team Leader.'
                        }
                    ]
                });
                setSuccessMessage({ text: "Request approved and forwarded to Procurement Team Leader", type: 'md' });
            } else if (effectiveRole === 'general_service') {
                const ptlQuery = query(collection(db!, 'users'), where('userRole', '==', 'procurement_team_leader'));
                const ptlSnapshot = await getDocs(ptlQuery);
                const nextApproverId = ptlSnapshot.empty ? 'PENDING_PTL_ASSIGNMENT' : ptlSnapshot.docs[0].id;
                const nextApproverName = ptlSnapshot.empty ? 'Procurement Team Leader' : ptlSnapshot.docs[0].data().displayName;

                await updateDoc(requestRef, {
                    status: 'pending_procurement',
                    currentApproverId: nextApproverId,
                    currentApproverName: nextApproverName,
                    currentApproverRole: 'procurement_team_leader',
                    history: [
                        ...request.history,
                        {
                            status: 'pending_procurement',
                            user: user.uid,
                            userName: userData.displayName || 'Anonymous',
                            userRole: getRoleTitle(effectiveRole),
                            timestamp: new Date().toISOString(),
                            note: 'Approved by General Service. Forwarded to Procurement Team Leader.'
                        }
                    ]
                });
                setSuccessMessage({ text: "Request approved and forwarded to Procurement Team Leader", type: 'general' });
            } else if (effectiveRole === 'team_leader') {
                // Procurement Team Leader -> Forward to Stock Clerk
                // Determine material type from items (assuming all items in a request are of similar type or taking the first one)
                // If mixed, default to fixed for safety or check logic. For now, checking the first item.
                const firstItem = request.items[0];
                const type = firstItem?.materialType?.toLowerCase() || '';
                const isConsumable = type.includes('consumable');

                const clerkRole = isConsumable ? 'consumable_item_stock_clerk' : 'fixed_asset_stock_clerk';

                // Find Clerk
                const clerkQuery = query(collection(db!, 'users'), where('userRole', '==', clerkRole));
                const clerkSnapshot = await getDocs(clerkQuery);
                const nextApproverId = clerkSnapshot.empty ? 'PENDING_CLERK_ASSIGNMENT' : clerkSnapshot.docs[0].id;
                const nextApproverName = clerkSnapshot.empty ? (isConsumable ? 'Consumable Stock Clerk' : 'Fixed Stock Clerk') : clerkSnapshot.docs[0].data().displayName;

                await updateDoc(requestRef, {
                    status: 'approved_by_procurement_team_leader',
                    currentApproverId: nextApproverId,
                    currentApproverName: nextApproverName,
                    currentApproverRole: clerkRole,
                    history: [
                        ...request.history,
                        {
                            status: 'approved_by_procurement_team_leader',
                            user: user.uid,
                            userName: userData.displayName || 'Anonymous',
                            userRole: getRoleTitle(effectiveRole),
                            timestamp: new Date().toISOString(),
                            note: `Approved by Procurement Team Leader. Forwarded to ${nextApproverName}.`
                        }
                    ]
                });
                setSuccessMessage({ text: "Request approved and forwarded to Stock Clerk", type: 'general' });

            } else if (effectiveRole === 'stock_clerk' || effectiveRole.includes('stock_clerk')) {
                // Stock Clerk -> Forward to Store Keeper AND send verification to employee
                const firstItem = request.items[0];
                const type = firstItem?.materialType?.toLowerCase() || '';
                const isConsumable = type.includes('consumable');

                const keeperRole = isConsumable ? 'consumable_item_store_keeper' : 'fixed_asset_store_keeper';

                // Find Keeper
                const keeperQuery = query(collection(db!, 'users'), where('userRole', '==', keeperRole));
                const keeperSnapshot = await getDocs(keeperQuery);
                const nextApproverId = keeperSnapshot.empty ? 'PENDING_KEEPER_ASSIGNMENT' : keeperSnapshot.docs[0].id;
                const nextApproverName = keeperSnapshot.empty ? (isConsumable ? 'Consumable Store Keeper' : 'Fixed Store Keeper') : keeperSnapshot.docs[0].data().displayName;

                await updateDoc(requestRef, {
                    status: 'approved_by_clerk',
                    currentApproverId: nextApproverId,
                    currentApproverName: nextApproverName,
                    currentApproverRole: keeperRole,
                    history: [
                        ...request.history,
                        {
                            status: 'approved_by_clerk',
                            user: user.uid,
                            userName: userData.displayName || 'Anonymous',
                            userRole: getRoleTitle(effectiveRole),
                            timestamp: new Date().toISOString(),
                            note: `Approved by Stock Clerk. Forwarded to ${nextApproverName} and verification sent to employee.`
                        }
                    ]
                });

                // Create User-Report entries and send verification code to employee
                try {
                    const userReportPromises = request.items.map(async (item) => {
                        await addDoc(collection(db!, 'User-Report'), {
                            requestId: request.id,
                            requesterId: request.requesterId,
                            requesterName: request.requesterName,
                            department: request.department,
                            materialId: item.materialId || '',
                            materialName: item.materialName || '',
                            materialCode: item.materialCode || '',
                            quantity: item.quantity || 0,
                            unit: item.unit || 'pcs',
                            materialType: item.materialType || '',
                            condition: item.condition || 'New',
                            image: item.image || '',
                            withdrawalDate: serverTimestamp(),
                            status: 'approved_by_clerk',
                            approvedBy: user.uid,
                            approvedByName: userData.displayName || 'Stock Clerk',
                            approvedAt: serverTimestamp(),
                            createdAt: serverTimestamp(),
                            history: [
                                {
                                    status: 'approved_by_clerk',
                                    user: user.uid,
                                    userName: userData.displayName || 'Anonymous',
                                    userRole: getRoleTitle(effectiveRole),
                                    timestamp: new Date().toISOString(),
                                    note: 'Approved by Stock Clerk. Awaiting employee verification.'
                                }
                            ]
                        });
                    });

                    await Promise.all(userReportPromises);

                    // Generate verification code and Send_to_Users entry
                    const code = Math.floor(100000 + Math.random() * 900000).toString();
                    await addDoc(collection(db!, 'Send_to_Users'), {
                        request_id: request.id,
                        requester_user_id: request.requesterId,
                        requester_name: request.requesterName,
                        material_details: request.items.map(item => ({
                            materialName: item.materialName || '',
                            materialCode: item.materialCode || '',
                            materialType: item.materialType || '',
                            materialId: item.materialId || '',
                            quantity: item.quantity || 0,
                            unit: item.unit || 'pcs'
                        })),
                        verification_code: code,
                        created_at: serverTimestamp(),
                        status: 'ready_for_pickup',
                        isSeen: false
                    });

                    setSuccessMessage({
                        text: "Request approved. Forwarded to Store Keeper and verification sent to employee.",
                        type: 'general'
                    });
                } catch (error) {
                    console.error("Error creating User-Report entries:", error);
                    throw error;
                }
            } else {
                // Academic Coordinator Logic
                const finalItems = updatedItems || modifiedRequests[request.id] || request.items;
                const finalAdjustmentNote = adjustmentNote || adjustmentReasons[request.id] || '';
                const itemsWithACRule = finalItems.filter(item => item.AC_decition === 'need AC decision');

                if (itemsWithACRule.length > 0) {
                    await addDoc(collection(db!, 'Need_AC_decition'), {
                        ...request,
                        items: finalItems,
                        originalRequestId: request.id,
                        coordinatorId: user.uid,
                        coordinatorName: userData.displayName || 'Academic Coordinator',
                        approvedAt: serverTimestamp(),
                        status: 'pending_chief_decision'
                    });

                    await updateDoc(requestRef, {
                        status: 'forwarded_to_chief',
                        currentApproverRole: 'chief_executive',
                        items: finalItems,
                        isAdjusted: !!finalAdjustmentNote,
                        isFeedbackSeen: finalAdjustmentNote ? false : true,
                        history: [
                            ...request.history,
                            {
                                status: 'forwarded_to_chief',
                                user: user.uid,
                                userName: userData.displayName || 'Anonymous',
                                userRole: getRoleTitle(effectiveRole),
                                timestamp: new Date().toISOString(),
                                note: finalAdjustmentNote || 'Quantity adjusted by Academic Coordinator'
                            }
                        ]
                    });
                    setSuccessMessage({
                        text: "This request needs Academic Commission decision",
                        type: 'chief'
                    });
                } else {
                    const ptlQuery = query(collection(db!, 'users'), where('userRole', '==', 'procurement_team_leader'));
                    const ptlSnapshot = await getDocs(ptlQuery);
                    const nextApproverId = ptlSnapshot.empty ? 'PENDING_PTL_ASSIGNMENT' : ptlSnapshot.docs[0].id;
                    const nextApproverName = ptlSnapshot.empty ? 'Procurement Team Leader' : ptlSnapshot.docs[0].data().displayName;

                    await updateDoc(requestRef, {
                        status: 'pending_procurement',
                        currentApproverId: nextApproverId,
                        currentApproverName: nextApproverName,
                        currentApproverRole: 'procurement_team_leader',
                        items: finalItems,
                        isAdjusted: !!finalAdjustmentNote,
                        isFeedbackSeen: finalAdjustmentNote ? false : true,
                        history: [
                            ...request.history,
                            {
                                status: 'pending_procurement',
                                user: user.uid,
                                userName: userData.displayName || 'Anonymous',
                                userRole: getRoleTitle(effectiveRole),
                                timestamp: new Date().toISOString(),
                                note: finalAdjustmentNote || 'Quantity adjusted by Academic Coordinator'
                            }
                        ]
                    });
                    setSuccessMessage({
                        text: "Successfully sent message",
                        type: 'coordinator'
                    });
                }
            }

            // Clear message after 5 seconds
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (error) {
            console.error("Error approving request:", error);
            alert("Failed to approve request.");
        } finally {
            setProcessingId(null);
        }
    };

    const handleBulkApprove = async () => {
        if (!user || !userData || !db || selectedRequests.length === 0) return;
        setIsBulkProcessing(true);

        try {
            const batch = writeBatch(db!);

            // 1. Fetch all necessary approver IDs concurrently to minimize waits
            const [acSnap, mdSnap, chiefSnap, ptlSnap] = await Promise.all([
                getDocs(query(collection(db!, 'users'), where('userRole', '==', 'academic_coordinator'))),
                getDocs(query(collection(db!, 'users'), where('userRole', '==', 'managing_director'))),
                getDocs(query(collection(db!, 'users'), where('userRole', '==', 'chief_executive'))), // Assuming chief executive role name
                getDocs(query(collection(db!, 'users'), where('userRole', '==', 'procurement_team_leader')))
            ]);

            // Helper to get approver details
            const getApprover = (snap: any, defaultId: string, defaultName: string) => ({
                id: snap.empty ? defaultId : snap.docs[0].id,
                name: snap.empty ? defaultName : snap.docs[0].data().displayName
            });

            const ac = getApprover(acSnap, 'PENDING_AC_ASSIGNMENT', 'Academic Coordinator');
            const md = getApprover(mdSnap, 'PENDING_MD_ASSIGNMENT', 'Managing Director');
            const ptl = getApprover(ptlSnap, 'PENDING_PTL_ASSIGNMENT', 'Procurement Team Leader');
            // Chief logic might be different if it goes to a different collection, but keeping consistent for now

            let approvedCount = 0;

            for (const reqId of selectedRequests) {
                const req = requests.find(r => r.id === reqId);
                if (!req) continue;
                const ref = doc(db!, 'Request_materials', reqId);

                if (effectiveRole === 'department_head') {
                    // Dept Head -> Academic Coordinator
                    batch.update(ref, {
                        status: 'approved_by_head',
                        currentApproverId: ac.id,
                        currentApproverName: ac.name,
                        currentApproverRole: 'academic_coordinator',
                        headApproverName: userData.displayName || 'Department Head',
                        history: [
                            ...req.history,
                            {
                                status: 'approved_by_head',
                                user: user.uid,
                                userName: userData.displayName || 'Anonymous',
                                userRole: getRoleTitle(effectiveRole),
                                timestamp: new Date().toISOString(),
                                note: 'Bulk approved by Department Head'
                            }
                        ]
                    });
                    approvedCount++;

                } else if (effectiveRole === 'academic_coordinator') {
                    // AC -> Managing Director OR Chief Executive
                    const itemsWithACRule = req.items.filter(item => item.AC_decition === 'need AC decision');

                    if (itemsWithACRule.length > 0) {
                        // Forward to Chief Executive / Special Collection
                        // Note: Original logic created a new doc in 'Need_AC_decition' and updated the request
                        // For bulk, we can allow this but we must be careful with async inside loop if not careful. 
                        // writeBatch doesn't support 'addDoc' cleanly returned ref for further use easily in mixed ops without ref generation.
                        // However, we can generate a ref ID client side.

                        // BUT, for simplicity in bulk, we will focus on the main status update.
                        // If we strictly need to create the 'Need_AC_decition' doc, we should do it.

                        const specialDocRef = doc(collection(db!, 'Need_AC_decition'));
                        batch.set(specialDocRef, {
                            ...req,
                            originalRequestId: req.id,
                            coordinatorId: user.uid,
                            coordinatorName: userData.displayName || 'Academic Coordinator',
                            approvedAt: serverTimestamp(),
                            status: 'pending_chief_decision'
                        });

                        batch.update(ref, {
                            status: 'forwarded_to_chief',
                            currentApproverRole: 'chief_executive',
                            history: [
                                ...req.history,
                                {
                                    status: 'forwarded_to_chief',
                                    user: user.uid,
                                    userName: userData.displayName || 'Anonymous',
                                    userRole: getRoleTitle(effectiveRole),
                                    timestamp: new Date().toISOString(),
                                    note: 'Fixed assets requiring Chief decision forwarded to executive collection (Bulk).'
                                }
                            ]
                        });

                    } else {
                        // Standard -> PTL
                        batch.update(ref, {
                            status: 'pending_procurement',
                            currentApproverId: ptl.id,
                            currentApproverName: ptl.name,
                            currentApproverRole: 'procurement_team_leader',
                            history: [
                                ...req.history,
                                {
                                    status: 'pending_procurement',
                                    user: user.uid,
                                    userName: userData.displayName || 'Anonymous',
                                    userRole: getRoleTitle(effectiveRole),
                                    timestamp: new Date().toISOString(),
                                    note: 'Request approved by Academic Coordinator (Bulk). Forwarded to Procurement Team Leader.'
                                }
                            ]
                        });
                    }
                    approvedCount++;

                } else if (effectiveRole === 'managing_director') {
                    // MD -> Procurement Team Leader
                    batch.update(ref, {
                        status: 'pending_procurement',
                        currentApproverId: ptl.id,
                        currentApproverName: ptl.name,
                        currentApproverRole: 'procurement_team_leader',
                        history: [
                            ...req.history,
                            {
                                status: 'pending_procurement',
                                user: user.uid,
                                userName: userData.displayName || 'Anonymous',
                                userRole: getRoleTitle(effectiveRole),
                                timestamp: new Date().toISOString(),
                                note: 'Approved by Managing Director. Forwarded to Procurement Team Leader (Bulk).'
                            }
                        ]
                    });
                    approvedCount++;
                } else if (effectiveRole === 'general_service') {
                    // GS -> Procurement Team Leader
                    batch.update(ref, {
                        status: 'pending_procurement',
                        currentApproverId: ptl.id,
                        currentApproverName: ptl.name,
                        currentApproverRole: 'procurement_team_leader',
                        history: [
                            ...req.history,
                            {
                                status: 'pending_procurement',
                                user: user.uid,
                                userName: userData.displayName || 'Anonymous',
                                userRole: getRoleTitle(effectiveRole),
                                timestamp: new Date().toISOString(),
                                note: 'Approved by General Service. Forwarded to Procurement Team Leader (Bulk).'
                            }
                        ]
                    });
                    approvedCount++;
                } else if (effectiveRole === 'team_leader') {
                    // Procurement Team Leader -> Forward to Stock Clerk
                    const firstItem = req.items[0];
                    const type = firstItem?.materialType?.toLowerCase() || '';
                    const isConsumable = type.includes('consumable');
                    const clerkRole = isConsumable ? 'consumable_item_stock_clerk' : 'fixed_asset_stock_clerk';

                    batch.update(ref, {
                        status: 'approved_by_procurement_team_leader',
                        currentApproverRole: clerkRole,
                        history: [
                            ...req.history,
                            {
                                status: 'approved_by_procurement_team_leader',
                                user: user.uid,
                                userName: userData.displayName || 'Anonymous',
                                userRole: getRoleTitle(effectiveRole),
                                timestamp: new Date().toISOString(),
                                note: `Approved by Procurement Team Leader. Forwarded to ${isConsumable ? 'Consumable' : 'Fixed Asset'} Stock Clerk (Bulk).`
                            }
                        ]
                    });
                    approvedCount++;
                }
            }

            if (approvedCount > 0) {
                await batch.commit();
                setSuccessMessage({ text: `Successfully processed ${approvedCount} requests`, type: 'general' });
                setSelectedRequests([]);
            } else {
                setSuccessMessage({ text: `No eligible requests were processed`, type: 'general' });
            }

        } catch (error) {
            console.error("Bulk approve error:", error);
            alert("Failed to bulk approve.");
        } finally {
            setIsBulkProcessing(false);
            setTimeout(() => setSuccessMessage(null), 5000);
        }
    };

    const handleBulkReject = async () => {
        if (!user || !userData || !db || selectedRequests.length === 0) return;

        const reason = prompt(`Enter rejection reason for ${selectedRequests.length} requests:`);
        if (!reason || !reason.trim()) return;

        setIsBulkProcessing(true);
        try {
            const batch = writeBatch(db!);
            for (const reqId of selectedRequests) {
                const req = requests.find(r => r.id === reqId);
                if (!req) continue;
                const ref = doc(db!, 'Request_materials', reqId);
                batch.update(ref, {
                    status: 'rejected',
                    isFeedbackSeen: false,
                    history: [
                        ...req.history,
                        {
                            status: 'rejected',
                            user: user.uid,
                            userName: userData.displayName || 'Anonymous',
                            userRole: getRoleTitle(effectiveRole),
                            timestamp: new Date().toISOString(),
                            note: reason.trim()
                        }
                    ]
                });
            }
            await batch.commit();
            setSuccessMessage({ text: `Successfully rejected ${selectedRequests.length} requests`, type: 'general' });
            setSelectedRequests([]);
        } catch (error) {
            console.error("Bulk reject error:", error);
            alert("Failed to bulk reject requests.");
        } finally {
            setIsBulkProcessing(false);
            setTimeout(() => setSuccessMessage(null), 5000);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedRequests(prev =>
            prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedRequests.length === filteredRequests.length) {
            setSelectedRequests([]);
        } else {
            setSelectedRequests(filteredRequests.map(r => r.id));
        }
    };

    const handleReject = (request: MaterialRequest) => {
        if (!user || !db) return;
        setRequestToReject(request);
        setRejectReason('');
        setRejectModalOpen(true);
    };

    const confirmReject = async () => {
        if (!user || !db || !requestToReject) return;
        if (!rejectReason.trim()) {
            alert("Please enter a valid reason for rejection.");
            return;
        }

        setProcessingId(requestToReject.id);
        const reason = rejectReason.trim();
        setRejectModalOpen(false);

        try {
            const requestRef = doc(db!, 'Request_materials', requestToReject.id);
            const statusLabel = 'rejected';

            await updateDoc(requestRef, {
                status: statusLabel,
                isFeedbackSeen: false,
                history: [
                    ...requestToReject.history,
                    {
                        status: statusLabel,
                        user: user.uid,
                        userName: userData?.displayName || user.email || 'Admin',
                        userRole: getRoleTitle(effectiveRole),
                        timestamp: new Date().toISOString(),
                        note: reason
                    }
                ]
            });
            setRequestToReject(null);
            setRejectReason('');
            setSuccessMessage({ text: "Request rejected successfully", type: 'general' });
        } catch (error) {
            console.error("Error rejecting request:", error);
            alert("Failed to reject request.");
        } finally {
            setProcessingId(null);
        }
    };

    const generateVerificationCode = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };

    const handleValidate = async (request: MaterialRequest) => {
        if (!user || !db) return;
        setProcessingId(request.id);

        try {
            // Step 1: Update Request_materials
            const requestRef = doc(db!, 'Request_materials', request.id);
            await updateDoc(requestRef, {
                status: 'approved_by_clerk',
                currentApproverRole: 'store_keeper',
                history: [
                    ...request.history,
                    {
                        status: 'approved_by_clerk',
                        user: user.uid,
                        timestamp: new Date().toISOString(),
                        note: 'Validated and Forwarded by Stock Clerk to Store Keeper. Verification code generated.'
                    }
                ]
            });

            // Step 2: Update User-Report
            const userReportQuery = query(collection(db!, 'User-Report'), where('requestId', '==', request.id));
            const userReportSnap = await getDocs(userReportQuery);

            const batch = writeBatch(db!);
            userReportSnap.docs.forEach((doc) => {
                const docData = doc.data();
                batch.update(doc.ref, {
                    status: 'completed',
                    history: [
                        ...(docData.history || []),
                        {
                            status: 'completed',
                            user: user.uid,
                            userName: userData.displayName || 'Anonymous',
                            userRole: getRoleTitle(effectiveRole),
                            timestamp: new Date().toISOString(),
                            note: 'Material request validated and completed by Stock Clerk'
                        }
                    ]
                });
            });
            await batch.commit();

            // Step 3: Generate Verification Code
            const code = generateVerificationCode();

            // Step 5: Save Data to Send_to_Users Collection
            await addDoc(collection(db!, 'Send_to_Users'), {
                request_id: request.id,
                requester_user_id: request.requesterId,
                requester_name: request.requesterName,
                verification_code: code,
                material_details: request.items.map(item => ({
                    materialName: item.materialName,
                    materialCode: item.materialCode,
                    quantity: item.quantity,
                    unit: item.unit,
                    materialType: item.materialType
                })),
                status: 'code_sent',
                created_at: serverTimestamp(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
            });

            // Step 4: Success Message
            setSuccessMessage({
                text: "Request validated and forwarded to Store Keeper. Verification code sent to employee.",
                type: 'general'
            });

        } catch (error) {
            console.error("Error validating request:", error);
            alert("Failed to validate request.");
        } finally {
            setProcessingId(null);
            setTimeout(() => setSuccessMessage(null), 10000);
        }
    };



    if (loading) {
        return (
            <div className={`flex items-center justify-center p-12`}>
                <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${effectiveRole === 'department_head' ? 'border-orange-600' :
                    effectiveRole === 'managing_director' ? 'border-indigo-600' :
                        effectiveRole === 'general_service' ? 'border-violet-600' :
                            'border-lime-600'
                    }`}></div>
            </div>
        );
    }

    const themeColor = effectiveRole === 'academic_coordinator' ? 'amber' :
        effectiveRole === 'managing_director' ? 'indigo' :
            effectiveRole === 'general_service' ? 'emerald' :
                effectiveRole === 'dormitory_leader' ? 'blue' :
                    effectiveRole === 'cafeteria_leader' ? 'orange' :
                        effectiveRole === 'sports_leader' ? 'rose' :
                            effectiveRole === 'student_service_leader' ? 'violet' :
                                'blue';

    return (
        <div className="max-w-[1600px] mx-auto px-4 pb-4 space-y-6 animate-in fade-in duration-500">
            {selectedRequest && (
                <ReadOnlyPaperForm20
                    request={selectedRequest}
                    onClose={() => setSelectedRequest(null)}
                    onApprove={(updatedItems: any[], sig, note) => {
                        // Map updated quantities back to original items to preserve type safety and full metadata
                        const finalizedItems = selectedRequest.items.map((orig, i) => ({
                            ...orig,
                            quantity: updatedItems[i]?.quantity ?? orig.quantity
                        }));
                        handleApprove(selectedRequest, finalizedItems, note, sig);
                        setSelectedRequest(null);
                    }}
                    onReject={() => {
                        handleReject(selectedRequest);
                        setSelectedRequest(null);
                    }}
                    isProcessing={processingId === selectedRequest.id}
                    isDepartmentHead={effectiveRole === 'department_head'}
                    isAcademicCoordinator={effectiveRole === 'academic_coordinator'}
                    isManagingDirector={effectiveRole === 'managing_director'}
                    isStockClerk={effectiveRole === 'stock_clerk' || effectiveRole.includes('stock_clerk')}
                    onProcessModel22={() => {
                        setModel22Request(selectedRequest);
                        setSelectedRequest(null);
                    }}
                />
            )}
            {selectedRequest && selectedRequest.formType !== 'paper_form_20' && (
                <MaterialRequestReviewModal
                    request={selectedRequest}
                    onClose={() => setSelectedRequest(null)}
                    onApprove={() => {
                        handleApprove(selectedRequest);
                        setSelectedRequest(null);
                    }}
                    onReject={() => {
                        handleReject(selectedRequest);
                        setSelectedRequest(null);
                    }}
                    isProcessing={processingId === selectedRequest.id}
                />
            )}
            {/* Notification Bar */}
            {successMessage && (
                <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-8 duration-500`}>
                    <div className={`flex items-center gap-5 px-8 py-5 rounded-[2.5rem] shadow-2xl backdrop-blur-2xl border-2 ${successMessage.type === 'coordinator' ? 'bg-lime-600 border-lime-400 text-white shadow-lime-500/30' :
                        successMessage.type === 'md' ? 'bg-indigo-600 border-indigo-400 text-white shadow-indigo-500/30' :
                            'bg-orange-600 border-orange-400 text-white shadow-orange-500/30'
                        }`}>
                        <FiCheckCircle className="text-3xl animate-bounce" />
                        <div className="flex flex-col text-left">
                            <span className="font-black uppercase tracking-[0.2em] text-[10px] opacity-80">Security Protocol</span>
                            <span className="font-bold text-sm tracking-tight">{successMessage.text}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Section */}
            <div className="flex flex-col gap-3 bg-white p-3 md:p-4 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
                            {effectiveRole === 'academic_coordinator' ? (
                                <>Managerial <span className="text-blue-600">Review</span></>
                            ) : effectiveRole === 'managing_director' ? (
                                <>Executive <span className="text-blue-600">Approval</span></>
                            ) : (
                                <>Material <span className="text-blue-600">Requests</span></>
                            )}
                        </h2>
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-wider border border-blue-100">
                            <FiActivity size={10} /> System Management
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* View Mode Toggle */}
                        <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'list'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                <FiList className="text-base" /> List
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'grid'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                <FiGrid className="text-base" /> Grid
                            </button>
                        </div>

                        <button
                            onClick={() => handleSelectAll(selectedRequests.length !== filteredRequests.length)}
                            className={`px-6 py-2 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border-2 flex items-center gap-2 ${selectedRequests.length === filteredRequests.length && filteredRequests.length > 0
                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20'
                                : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200 hover:text-blue-600'
                                }`}
                        >
                            {selectedRequests.length === filteredRequests.length && filteredRequests.length > 0 ? (
                                <><FiCheckCircle className="text-base" /> Deselect All</>
                            ) : (
                                <><div className="w-4 h-4 rounded-md border-2 border-current"></div> Select All</>
                            )}
                        </button>
                    </div>
                </div>

                <div className="relative group w-full z-10 border-t border-slate-100 pt-3 flex flex-col md:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                        <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors text-xl" />
                        <input
                            type="text"
                            placeholder="Search by requester or material name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-2 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50/50 border border-slate-200 rounded-xl whitespace-nowrap">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Queue:</span>
                        <span className="text-[10px] font-black text-slate-700 uppercase">
                            {filteredRequests.length} {filteredRequests.length === 1 ? 'Task' : 'Tasks'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Bulk Action Bar */}
            {selectedRequests.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <div className="bg-slate-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-8 border border-slate-700">
                        <div className="flex items-center gap-3">
                            <span className="bg-blue-600 text-white text-xs font-black px-2 py-1 rounded-md">{selectedRequests.length}</span>
                            <span className="text-sm font-bold tracking-wide">Selected</span>
                        </div>
                        <div className="h-8 w-px bg-slate-700"></div>
                        <button
                            onClick={handleBulkApprove}
                            disabled={isBulkProcessing}
                            className="text-sm font-black uppercase tracking-widest hover:text-blue-400 transition-colors flex items-center gap-2"
                        >
                            {isBulkProcessing ? 'Processing...' : 'Approve All'}
                            {!isBulkProcessing && <FiCheckCircle className="text-lg" />}
                        </button>
                        <div className="h-8 w-px bg-slate-700"></div>
                        <button
                            onClick={handleBulkReject}
                            disabled={isBulkProcessing}
                            className="text-sm font-black uppercase tracking-widest hover:text-red-400 transition-colors flex items-center gap-2"
                        >
                            {isBulkProcessing ? 'Processing...' : 'Reject All'}
                            {!isBulkProcessing && <FiXCircle className="text-lg" />}
                        </button>
                        <button
                            onClick={() => setSelectedRequests([])}
                            className="text-slate-500 hover:text-white transition-colors"
                        >
                            <FiXCircle className="text-xl" />
                        </button>
                    </div>
                </div>
            )}

            {filteredRequests.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300 border border-slate-200">
                        <FiClock className="text-3xl" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Queue Clear</h3>
                        <p className="text-slate-400 font-semibold uppercase text-[9px] tracking-widest">No pending material requests require your attention.</p>
                    </div>
                </div>
            ) : (
                <div className={viewMode === 'grid' ? "grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6" : "flex flex-col gap-4 mt-6"}>
                    {filteredRequests.map(request => (
                        <div
                            key={request.id}
                            className={`group relative bg-white border border-slate-200 transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 flex flex-col overflow-hidden ${viewMode === 'grid' ? 'rounded-[2rem] p-4' : 'rounded-2xl md:flex-row md:items-center'
                                } ${processingId === request.id ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            {viewMode === 'list' ? (
                                <>
                                    {/* LIST VIEW LAYOUT */}
                                    <div className="flex-1 px-4 py-3 flex flex-col md:flex-row md:items-center gap-4">
                                        <div className="flex items-center gap-4 min-w-[280px]">
                                            <input
                                                type="checkbox"
                                                checked={selectedRequests.includes(request.id)}
                                                onChange={() => toggleSelect(request.id)}
                                                className="w-5 h-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            />
                                            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                                                <FiUser className="text-xl text-slate-400 group-hover:text-blue-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-slate-900 text-base truncate tracking-tight">{request.requesterName}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                                        {request.department?.replace('_', ' ')}
                                                    </span>
                                                    {request.formType === 'paper_form_20' && (
                                                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider">
                                                            Form 20
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 flex flex-wrap items-center gap-4">
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100">
                                                <div className={`w-2 h-2 rounded-full ${request.status.includes('rejected') ? 'bg-red-500' :
                                                    request.status.includes('pending') ? 'bg-amber-500' : 'bg-emerald-500'
                                                    }`} />
                                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                                    {request.status.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap">
                                                <FiCalendar className="text-slate-300" />
                                                {request.createdAt?.toDate().toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) || 'N/A'}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {request.formType === 'paper_form_20' ? (
                                                <button
                                                    onClick={() => setSelectedRequest(request)}
                                                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase text-[11px] tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all flex items-center gap-2 whitespace-nowrap"
                                                >
                                                    Process Model 20
                                                    <FiArrowRight />
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-widest opacity-60">
                                                    <FiBox size={14} />
                                                    {request.items.length} Items
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {request.formType !== 'paper_form_20' && (
                                        <div className="px-4 pb-4 pt-1 border-t border-slate-50 bg-slate-50/20">
                                            {/* Standard Item List - Nested */}
                                            <div className="flex flex-col gap-3">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {request.items.map((item, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 hover:border-blue-200 group/item transition-all">
                                                            <div className="flex items-center gap-3 truncate">
                                                                <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 border border-slate-100">
                                                                    {item.image || materialImages[item.materialId] ? (
                                                                        <Image src={item.image || materialImages[item.materialId]} alt={item.materialName} width={40} height={40} className="rounded-lg object-cover" />
                                                                    ) : <FiBox className="text-slate-200" />}
                                                                </div>
                                                                <div className="truncate">
                                                                    <p className="text-sm font-bold text-slate-800 truncate">{item.materialName}</p>
                                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{item.materialCode || 'No Code'}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                                                                {(effectiveRole === 'academic_coordinator' || effectiveRole === 'managing_director') ? (
                                                                    <input
                                                                        type="number"
                                                                        value={modifiedRequests[request.id]?.[idx]?.quantity ?? item.quantity}
                                                                        onChange={(e) => handleItemQuantityChange(request.id, idx, Number(e.target.value), request.items)}
                                                                        className={`w-16 px-2 py-1 bg-slate-50 border rounded-lg text-right font-bold text-sm focus:border-blue-500 outline-none ${(modifiedRequests[request.id]?.[idx]?.quantity ?? item.quantity) !== item.quantity
                                                                            ? 'text-rose-600 border-rose-200 bg-rose-50'
                                                                            : 'text-slate-800 border-slate-200'
                                                                            }`}
                                                                    />
                                                                ) : (
                                                                    <span className="text-sm font-black text-slate-700">{item.quantity}</span>
                                                                )}
                                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.unit}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {(effectiveRole === 'academic_coordinator' || effectiveRole === 'managing_director') && isRequestAdjusted(request) && (
                                                    <div className="mt-2 p-4 bg-rose-50 border border-rose-100 rounded-xl space-y-2">
                                                        <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                                                            <FiAlertCircle /> Reason for Adjustment Required
                                                        </label>
                                                        <textarea
                                                            value={adjustmentReasons[request.id] || ''}
                                                            onChange={(e) => setAdjustmentReasons({ ...adjustmentReasons, [request.id]: e.target.value })}
                                                            placeholder="Specify why quantities were changed..."
                                                            className="w-full bg-white border border-rose-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/10 resize-none h-16"
                                                        />
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-3 pt-3">
                                                    {effectiveRole.includes('stock_clerk') ? (
                                                        <button onClick={() => setModel22Request(request)} className={`flex-1 py-3 bg-${themeColor}-600 hover:bg-${themeColor}-500 text-white rounded-xl font-bold uppercase text-[11px] tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all`}>
                                                            Proceed to Model 22 <FiArrowRight />
                                                        </button>
                                                    ) : effectiveRole === 'general_service' ? (
                                                        <button onClick={() => setSelectedRequest(request)} className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold uppercase text-[11px] tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all">
                                                            Process Service <FiArrowRight />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => setSelectedRequest(request)}
                                                            className={`flex-1 py-3 rounded-xl font-bold uppercase text-[11px] tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all ${
                                                                effectiveRole === 'academic_coordinator' ? 'bg-lime-600 hover:bg-lime-500 text-white shadow-lime-600/20' :
                                                                effectiveRole === 'managing_director' ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20' :
                                                                'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                                                            }`}
                                                        >
                                                            Process Request <FiArrowRight />
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleReject(request)} className="px-4 py-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-red-500 hover:border-red-500 hover:bg-red-50 transition-all">
                                                        <FiXCircle size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* GRID VIEW LAYOUT */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedRequests.includes(request.id)}
                                                onChange={() => toggleSelect(request.id)}
                                                className="w-5 h-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            />
                                            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-blue-600">
                                                <FiUser className="text-xl" />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-800 text-lg tracking-tight">{request.requesterName}</h4>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{request.department?.replace('_', ' ')}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-2 mb-1 justify-end">
                                                <div className={`w-2 h-2 rounded-full ${request.status.includes('rejected') ? 'bg-red-500' :
                                                    request.status.includes('pending') ? 'bg-amber-500' : 'bg-emerald-500'
                                                    }`} />
                                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{request.status.replace(/_/g, ' ')}</span>
                                            </div>
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mt-1.5">{request.createdAt?.toDate().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                        </div>
                                    </div>

                                    {request.formType === 'paper_form_20' ? (
                                        <div className="bg-slate-50/50 rounded-3xl p-8 flex flex-col items-center justify-center border border-slate-100 border-dashed">
                                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-4">
                                                <FiArrowRight className="text-2xl text-blue-500" />
                                            </div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Model 20 Requisition</p>
                                            <button
                                                onClick={() => setSelectedRequest(request)}
                                                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-500 transition-all"
                                            >
                                                Process Request
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 flex-1">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Requested Items ({request.items.length})</p>
                                            </div>
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                                {request.items.map((item, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden">
                                                                {item.image || materialImages[item.materialId] ? (
                                                                    <Image src={item.image || materialImages[item.materialId]} alt={item.materialName} width={40} height={40} className="object-cover" />
                                                                ) : <FiBox className="text-slate-200" />}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-black text-slate-700">{item.materialName}</p>
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{item.materialCode || 'No Code'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            {(effectiveRole === 'academic_coordinator' || effectiveRole === 'managing_director') ? (
                                                                <input
                                                                    type="number"
                                                                    value={modifiedRequests[request.id]?.[idx]?.quantity ?? item.quantity}
                                                                    onChange={(e) => handleItemQuantityChange(request.id, idx, Number(e.target.value), request.items)}
                                                                    className={`w-16 px-2 py-1 bg-white border rounded-lg text-right font-black text-sm focus:ring-2 focus:ring-blue-500/10 outline-none ${(modifiedRequests[request.id]?.[idx]?.quantity ?? item.quantity) !== item.quantity
                                                                        ? 'text-rose-600 border-rose-200 bg-rose-50'
                                                                        : 'text-slate-800 border-slate-200'
                                                                        }`}
                                                                />
                                                            ) : (
                                                                <p className="text-sm font-black text-slate-800">{item.quantity} <span className="text-[10px] text-slate-400 uppercase tracking-widest ml-1">{item.unit}</span></p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {(effectiveRole === 'academic_coordinator' || effectiveRole === 'managing_director') && isRequestAdjusted(request) && (
                                                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-2">
                                                    <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                                                        <FiAlertCircle /> Reason for Adjustment Required
                                                    </label>
                                                    <textarea
                                                        value={adjustmentReasons[request.id] || ''}
                                                        onChange={(e) => setAdjustmentReasons({ ...adjustmentReasons, [request.id]: e.target.value })}
                                                        placeholder="Specify why quantities were changed..."
                                                        className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/10 resize-none h-16"
                                                    />
                                                </div>
                                            )}

                                            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 mt-auto">
                                                <button
                                                    onClick={() => effectiveRole.includes('stock_clerk') ? setModel22Request(request) : setSelectedRequest(request)}
                                                    className={`flex-1 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all ${
                                                        effectiveRole === 'academic_coordinator' ? 'bg-lime-600 hover:bg-lime-500 text-white shadow-lime-600/20' :
                                                        effectiveRole === 'managing_director' ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20' :
                                                        'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                                                    }`}
                                                >
                                                    {effectiveRole.includes('stock_clerk') ? 'Proceed to Model 22' : 'Process Request'} <FiArrowRight />
                                                </button>
                                                <button onClick={() => handleReject(request)} className="px-5 py-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-red-500 hover:border-red-500 hover:bg-red-50 transition-all group/reject">
                                                    <FiXCircle size={20} className="group-hover/reject:rotate-90 transition-transform duration-300" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}



            {model22Request && (
                <ClerkModel22Form
                    request={model22Request}
                    onClose={() => setModel22Request(null)}
                    onApprove={async (finalItems: RequestItem[]) => {
                        await handleApprove(model22Request, finalItems);
                    }}
                />
            )}

            {/* Rejection Modal */}
            {rejectModalOpen && requestToReject && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] w-full max-w-lg p-8 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* decorative background element */}
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-rose-500/10 rounded-full blur-[40px] pointer-events-none" />

                        <div className="flex items-center gap-4 mb-6 relative">
                            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center border border-rose-100 flex-shrink-0">
                                <FiXCircle className="text-rose-600 text-xl" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">Reject Request</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Provide Reason for Rejection</p>
                            </div>
                        </div>

                        <div className="space-y-4 relative">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                                    <FiUser size={14} className="text-slate-500" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Requester</p>
                                    <p className="text-sm font-black text-slate-700 truncate">{requestToReject.requesterName}</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Rejection Reason</label>
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Please provide a clear reason for the requester..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-medium placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-400 focus:bg-white transition-all resize-none h-32"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end mt-8 relative">
                            <button
                                onClick={() => {
                                    setRejectModalOpen(false);
                                    setRequestToReject(null);
                                    setRejectReason('');
                                }}
                                className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 border-2 border-transparent transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmReject}
                                disabled={!rejectReason.trim()}
                                className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${!rejectReason.trim()
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 hover:bg-rose-600 hover:shadow-rose-600/40 hover:-translate-y-0.5'
                                    }`}
                            >
                                Confirm Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                @keyframes float {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-10px); }
                    100% { transform: translateY(0px); }
                }
                .animate-float {
                    animation: float 6s ease-in-out infinite;
                }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </div>
    );
}
