'use client';
import { addDocWithAudit, updateDocWithAudit } from '@/utils/auditTrail';

import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
    collection,
    query,
    onSnapshot,
    orderBy,
    doc,
    
    
    serverTimestamp,
    where,
    getDocs,
    getDoc,
    writeBatch
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
    requesterRole?: string;
}

interface MaterialRequestViewProps {
    roleOverride?: 'department_head' | 'academic_coordinator' | 'managing_director' | 'stock_clerk' | 'team_leader' | 'store_keeper' | 'student_service_leader' | 'consumable_item_stock_clerk' | 'fixed_asset_stock_clerk' | 'consumable_item_store_keeper' | 'fixed_asset_store_keeper';
    materialTypeFilter?: 'fixed_asset' | 'consumable';
}

type RoleType = 'department_head' | 'academic_coordinator' | 'requester' | 'procurement_md' | 'chief_executive' | 'managing_director' | 'stock_clerk' | 'team_leader' | 'store_keeper' | 'dormitory_leader' | 'cafeteria_leader' | 'sports_leader' | 'student_service_leader' | 'hrm_leader' | 'finance_leader' | 'dynamic_leader' | 'consumable_item_stock_clerk' | 'fixed_asset_stock_clerk' | 'consumable_item_store_keeper' | 'fixed_asset_store_keeper';

export default function MaterialRequestView({ roleOverride, materialTypeFilter }: MaterialRequestViewProps) {
    if (!db) return <div className="p-8 text-center text-red-500">Database connection error. Please refresh.</div>;
    const { user, userRole: authUserRole } = useAuth();
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
                pathname?.includes('/workspace') ? (
                    (userData?.userRole === 'procurement_team_leader' || authUserRole?.toLowerCase().replace(/\s+/g, '_') === 'procurement_team_leader') ? 'team_leader' :
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
                            pathname?.includes('/procurement-management/stock-clerk') ? (
                                userData?.userRole || 'stock_clerk'
                            ) :
                                pathname?.includes('/procurement-management/store') ? (
                                    userData?.userRole || 'store_keeper'
                                ) :
                                    // Fallback to old path detection for compatibility
                                    pathname?.includes('/managing-director') ? 'managing_director' :
                                        pathname?.includes('/academic-coordinator') ? 'academic_coordinator' :
                                            pathname?.includes('/stock-clerk') ? 'stock_clerk' :
                                                (pathname?.includes('/team-leader') || authUserRole?.toLowerCase().replace(/\s+/g, '_') === 'procurement_team_leader' || userData?.userRole?.toLowerCase().replace(/\s+/g, '_') === 'procurement_team_leader') ? 'team_leader' :
                                                    (authUserRole?.includes('_head') || userData?.userRole?.includes('_head')) ? 'department_head' :
                                                        'academic_coordinator'
    );

    const effectiveRole = rawRole.toLowerCase().replace(/\s+/g, '_');

    const getRoleTitle = (role: string) => {
        const roles: Record<string, string> = {
            'managing_director': 'Managing Director',
            'academic_coordinator': 'Academic Coordinator',
            'department_head': 'Department Head',
            'stock_clerk': 'Stock Clerk',
            'store_keeper': 'Store Keeper',
            'team_leader': 'Team Leader',
            'procurement_team_leader': 'Procurement Team Leader',
            'student_service_leader': 'Student Service Team Leader',
            'dormitory_leader': 'Dormitory Team Leader',
            'cafeteria_leader': 'Cafeteria Team Leader',
            'sports_leader': 'Sports Team Leader',
            'hrm_leader': 'HRM Team Leader',
            'finance_leader': 'Finance Team Leader'
        };
        if (roles[role]) return roles[role];

        let baseName = role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        if (role.endsWith('_leader') && baseName.endsWith(' Leader')) {
            baseName = baseName.replace(' Leader', ' Team Leader');
        }
        return baseName;
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
        } else if (effectiveRole.includes('stock_clerk')) {
            const clerkRoles = effectiveRole === 'stock_clerk'
                ? ['stock_clerk', 'fixed_asset_stock_clerk', 'consumable_item_stock_clerk']
                : [effectiveRole];
            q = query(
                collection(db!, 'Request_materials'),
                where('status', 'in', ['approved_by_procurement_team_leader', 'approved_by_md'])
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

                await updateDocWithAudit(requestRef, {
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

                await updateDocWithAudit(requestRef, {
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

                await updateDocWithAudit(requestRef, updateData);
                setSuccessMessage({
                    text: `Request approved and forwarded to Academic Coordinator (${nextApproverName})`,
                    type: 'coordinator'
                });
            } else if (effectiveRole === 'managing_director') {
                const requesterIsPTL = request.requesterRole === 'procurement_team_leader' || request.history[0]?.userRole === 'procurement_team_leader';
                const requesterIsStoreStaff = request.requesterRole?.includes('stock_clerk') || request.requesterRole?.includes('store_keeper');

                let nextRole = 'procurement_team_leader';
                let nextStatus = 'pending_procurement';
                let nextApproverId = '';
                let nextApproverName = 'Procurement Team Leader';

                if (requesterIsPTL || requesterIsStoreStaff) {
                    // PTL or Store Staff requests: MD -> Clerk
                    // If requester IS a specific clerk type, route back to that same type
                    let clerkRole = '';
                    let clerkLabel = '';

                    if (request.requesterRole?.includes('fixed_asset_stock_clerk')) {
                        clerkRole = 'fixed_asset_stock_clerk';
                        clerkLabel = 'Fixed Asset Stock Clerk';
                    } else if (request.requesterRole?.includes('consumable_item_stock_clerk')) {
                        clerkRole = 'consumable_item_stock_clerk';
                        clerkLabel = 'Consumable Stock Clerk';
                    } else {
                        // For store keepers or PTL, determine by material type
                        const firstItem = request.items[0];
                        const type = firstItem?.materialType?.toLowerCase() || '';
                        const isConsumable = type.includes('consumable');
                        clerkRole = isConsumable ? 'consumable_item_stock_clerk' : 'fixed_asset_stock_clerk';
                        clerkLabel = isConsumable ? 'Consumable Stock Clerk' : 'Fixed Asset Stock Clerk';
                    }

                    nextRole = clerkRole;
                    nextStatus = 'approved_by_md';

                    const clerkQuery = query(collection(db!, 'users'), where('userRole', '==', clerkRole));
                    const clerkSnapshot = await getDocs(clerkQuery);
                    nextApproverId = clerkSnapshot.empty ? 'PENDING_CLERK_ASSIGNMENT' : clerkSnapshot.docs[0].id;
                    nextApproverName = clerkSnapshot.empty ? clerkLabel : clerkSnapshot.docs[0].data().displayName;
                } else {
                    const ptlQuery = query(collection(db!, 'users'), where('userRole', '==', 'procurement_team_leader'));
                    const ptlSnapshot = await getDocs(ptlQuery);
                    nextApproverId = ptlSnapshot.empty ? 'PENDING_PTL_ASSIGNMENT' : ptlSnapshot.docs[0].id;
                    nextApproverName = ptlSnapshot.empty ? 'Procurement Team Leader' : ptlSnapshot.docs[0].data().displayName;
                }

                const finalItems = updatedItems || modifiedRequests[request.id] || request.items;
                const finalAdjustmentNote = adjustmentNote || adjustmentReasons[request.id] || '';

                const changes = finalItems.map((item, i) => {
                    const original = request.items[i].quantity;
                    return original !== item.quantity ? `${item.materialName} (${original} -> ${item.quantity})` : null;
                }).filter(Boolean);
                const hasChanges = changes.length > 0;

                let noteToSave = `Approved by Managing Director. Forwarded to ${nextApproverName}.`;
                if (hasChanges || finalAdjustmentNote) {
                    const prefix = hasChanges ? `Quantity adjusted: ${changes.join(', ')}. Note: ` : `Quantity adjusted. Note: `;
                    noteToSave = `${prefix}${finalAdjustmentNote || 'No additional reasoning provided'}`;
                }

                await updateDocWithAudit(requestRef, {
                    status: nextStatus,
                    currentApproverId: nextApproverId,
                    currentApproverName: nextApproverName,
                    currentApproverRole: nextRole,
                    items: finalItems,
                    isAdjusted: hasChanges || !!finalAdjustmentNote,
                    isFeedbackSeen: (hasChanges || !!finalAdjustmentNote) ? false : true,
                    history: [
                        ...request.history,
                        {
                            status: nextStatus,
                            user: user.uid,
                            userName: userData.displayName || 'Anonymous',
                            userRole: getRoleTitle(effectiveRole),
                            timestamp: new Date().toISOString(),
                            note: noteToSave
                        }
                    ],
                    ...(signature && { managingDirectorSignature: signature }),
                    mdApproverName: userData.displayName || 'Managing Director'
                });
                setSuccessMessage({ text: `Request approved and forwarded to ${nextApproverName}`, type: 'md' });
            } else if (effectiveRole === 'team_leader') {
                const requesterIsStoreStaff = request.requesterRole?.includes('stock_clerk') || request.requesterRole?.includes('store_keeper');

                if (requesterIsStoreStaff) {
                    // Store staff flow: PTL -> MD
                    const mdQuery = query(collection(db!, 'users'), where('userRole', '==', 'managing_director'));
                    const mdSnapshot = await getDocs(mdQuery);
                    const nextApproverId = mdSnapshot.empty ? 'PENDING_MD_ASSIGNMENT' : mdSnapshot.docs[0].id;
                    const nextApproverName = mdSnapshot.empty ? 'Managing Director' : mdSnapshot.docs[0].data().displayName;

                    await updateDocWithAudit(requestRef, {
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
                                note: `Approved by Procurement Team Leader. Forwarded to ${nextApproverName} (Managing Director).`
                            }
                        ],
                        ...(signature && { ptlSignature: signature })
                    });
                    setSuccessMessage({ text: "Request approved and forwarded to Managing Director", type: 'general' });
                } else {
                    // Normal flow: PTL -> Stock Clerk
                    const firstItem = request.items[0];
                    const type = firstItem?.materialType?.toLowerCase() || '';
                    const isConsumable = type.includes('consumable');

                    const clerkRole = isConsumable ? 'consumable_item_stock_clerk' : 'fixed_asset_stock_clerk';

                    const clerkQuery = query(collection(db!, 'users'), where('userRole', '==', clerkRole));
                    const clerkSnapshot = await getDocs(clerkQuery);
                    const nextApproverId = clerkSnapshot.empty ? 'PENDING_CLERK_ASSIGNMENT' : clerkSnapshot.docs[0].id;
                    const nextApproverName = clerkSnapshot.empty ? (isConsumable ? 'Consumable Stock Clerk' : 'Fixed Stock Clerk') : clerkSnapshot.docs[0].data().displayName;

                    await updateDocWithAudit(requestRef, {
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
                        ],
                        ...(signature && { ptlSignature: signature })
                    });
                    setSuccessMessage({ text: "Request approved and forwarded to Stock Clerk", type: 'general' });
                }

            } else if (effectiveRole === 'stock_clerk' || effectiveRole.includes('stock_clerk')) {
                // Stock Clerk -> Forward to Store Keeper AND send verification to employee
                const firstItem = request.items[0];
                const type = firstItem?.materialType?.toLowerCase() || '';
                const isConsumable = type.includes('consumable');

                // *** STOCK VALIDATION: Check if store has enough quantity BEFORE approving ***
                const insufficientItems: { name: string; requested: number; available: number }[] = [];
                const materialDocsToUpdate: { ref: any; currentQty: number; deductQty: number; name: string; originalData?: any; matchedIdx?: number }[] = [];

                // Fetch all materials once for robust case-insensitive and array searching
                const allMaterialsSnap = await getDocs(collection(db!, 'materials'));
                const allMaterials = allMaterialsSnap.docs.map(d => ({ id: d.id, ref: d.ref, data: d.data() }));

                for (const item of request.items) {
                    const deductQty = Number(item.quantity) || 0;
                    let foundDoc = null;
                    let currentQty = 0;
                    let matchedArrayIndex: number | undefined = undefined;

                    for (const mat of allMaterials) {
                        const mData = mat.data;
                        // Check top-level
                        if (mData.materialName?.trim().toLowerCase() === item.materialName?.trim().toLowerCase() ||
                            (item.materialCode && mData.materialCode?.trim().toLowerCase() === item.materialCode?.trim().toLowerCase())) {
                            foundDoc = mat;
                            currentQty = Number(mData.quantity) || 0;
                            break;
                        }
                        // Check inside items array (Model 19)
                        if (mData.items && Array.isArray(mData.items)) {
                            const matchedIdx = mData.items.findIndex((i: any) => i.description?.trim().toLowerCase() === item.materialName?.trim().toLowerCase());
                            if (matchedIdx !== -1) {
                                foundDoc = mat;
                                currentQty = Number(mData.items[matchedIdx].quantity) || Number(mData.quantity) || 0;
                                matchedArrayIndex = matchedIdx;
                                break;
                            }
                        }
                    }

                    if (foundDoc) {
                        if (deductQty > currentQty) {
                            insufficientItems.push({
                                name: item.materialName,
                                requested: deductQty,
                                available: currentQty
                            });
                        } else {
                            materialDocsToUpdate.push({
                                ref: foundDoc.ref,
                                currentQty,
                                deductQty,
                                name: item.materialName,
                                originalData: foundDoc.data,
                                matchedIdx: matchedArrayIndex
                            });
                        }
                    } else {
                        insufficientItems.push({
                            name: item.materialName,
                            requested: deductQty,
                            available: 0
                        });
                    }
                }

                // Block approval if any item has insufficient stock
                if (insufficientItems.length > 0) {
                    const errorDetails = insufficientItems.map(
                        i => `• ${i.name}: requested ${i.requested}, but only ${i.available} available in store`
                    ).join('\n');
                    alert(`❌ Cannot approve — insufficient stock!\n\n${errorDetails}\n\nPlease adjust the quantity or restock before approving.`);
                    setProcessingId(null);
                    return;
                }

                // Determine keeper type: if requester IS a specific keeper, route back to that type
                let keeperRole = '';
                let keeperLabel = '';

                if (request.requesterRole?.includes('fixed_asset_store_keeper')) {
                    keeperRole = 'fixed_asset_store_keeper';
                    keeperLabel = 'Fixed Asset Store Keeper';
                } else if (request.requesterRole?.includes('consumable_item_store_keeper')) {
                    keeperRole = 'consumable_item_store_keeper';
                    keeperLabel = 'Consumable Store Keeper';
                } else {
                    keeperRole = isConsumable ? 'consumable_item_store_keeper' : 'fixed_asset_store_keeper';
                    keeperLabel = isConsumable ? 'Consumable Store Keeper' : 'Fixed Asset Store Keeper';
                }

                // Find Keeper
                const keeperQuery = query(collection(db!, 'users'), where('userRole', '==', keeperRole));
                const keeperSnapshot = await getDocs(keeperQuery);
                const nextApproverId = keeperSnapshot.empty ? 'PENDING_KEEPER_ASSIGNMENT' : keeperSnapshot.docs[0].id;
                const nextApproverName = keeperSnapshot.empty ? keeperLabel : keeperSnapshot.docs[0].data().displayName;

                await updateDocWithAudit(requestRef, {
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

                // *** INVENTORY DEDUCTION: Decrease material quantity (already validated above) ***
                for (const matUpdate of materialDocsToUpdate) {
                    const newQty = matUpdate.currentQty - matUpdate.deductQty;
                    const updatePayload: any = { quantity: newQty.toString() }; // Maintain string type for consistency with DB

                    // If it's a Model 19 item inside an array, update the array specifically
                    if (matUpdate.matchedIdx !== undefined && matUpdate.originalData?.items) {
                        const newItems = [...matUpdate.originalData.items];
                        newItems[matUpdate.matchedIdx] = {
                            ...newItems[matUpdate.matchedIdx],
                            quantity: newQty.toString()
                        };
                        updatePayload.items = newItems;
                    }

                    await updateDocWithAudit(matUpdate.ref, updatePayload);
                    console.log(`[Stock Out] ${matUpdate.name}: ${matUpdate.currentQty} → ${newQty} (-${matUpdate.deductQty})`);
                }

                // Create User-Report entries and send verification code to employee
                try {
                    const userReportPromises = request.items.map(async (item) => {
                        await addDocWithAudit(collection(db!, 'User-Report'), {
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
                    await addDocWithAudit(collection(db!, 'Send_to_Users'), {
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
                        department: request.department || '',
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

                const changes = finalItems.map((item, i) => {
                    const original = request.items[i].quantity;
                    return original !== item.quantity ? `${item.materialName} (${original} -> ${item.quantity})` : null;
                }).filter(Boolean);
                const hasChanges = changes.length > 0;

                let noteToSave = 'Request approved by Academic Coordinator';
                if (hasChanges || finalAdjustmentNote) {
                    const prefix = hasChanges ? `Quantity adjusted: ${changes.join(', ')}. Note: ` : `Quantity adjusted. Note: `;
                    noteToSave = `${prefix}${finalAdjustmentNote || 'No additional reasoning provided'}`;
                }

                const itemsWithACRule = finalItems.filter(item => item.AC_decition === 'need AC decision');

                if (itemsWithACRule.length > 0) {
                    await addDocWithAudit(collection(db!, 'Need_AC_decition'), {
                        ...request,
                        items: finalItems,
                        originalRequestId: request.id,
                        coordinatorId: user.uid,
                        coordinatorName: userData.displayName || 'Academic Coordinator',
                        approvedAt: serverTimestamp(),
                        status: 'pending_chief_decision'
                    });

                    await updateDocWithAudit(requestRef, {
                        status: 'forwarded_to_chief',
                        currentApproverRole: 'chief_executive',
                        items: finalItems,
                        isAdjusted: hasChanges || !!finalAdjustmentNote,
                        isFeedbackSeen: (hasChanges || !!finalAdjustmentNote) ? false : true,
                        history: [
                            ...request.history,
                            {
                                status: 'forwarded_to_chief',
                                user: user.uid,
                                userName: userData.displayName || 'Anonymous',
                                userRole: getRoleTitle(effectiveRole),
                                timestamp: new Date().toISOString(),
                                note: noteToSave
                            }
                        ],
                        ...(signature && { acSignature: signature }),
                        acApproverName: userData.displayName || 'Academic Coordinator'
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

                    await updateDocWithAudit(requestRef, {
                        status: 'pending_procurement',
                        currentApproverId: nextApproverId,
                        currentApproverName: nextApproverName,
                        currentApproverRole: 'procurement_team_leader',
                        items: finalItems,
                        isAdjusted: hasChanges || !!finalAdjustmentNote,
                        isFeedbackSeen: (hasChanges || !!finalAdjustmentNote) ? false : true,
                        history: [
                            ...request.history,
                            {
                                status: 'pending_procurement',
                                user: user.uid,
                                userName: userData.displayName || 'Anonymous',
                                userRole: getRoleTitle(effectiveRole),
                                timestamp: new Date().toISOString(),
                                note: noteToSave
                            }
                        ],
                        ...(signature && { acSignature: signature }),
                        acApproverName: userData.displayName || 'Academic Coordinator'
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
                            ],
                            acApproverName: userData.displayName || 'Academic Coordinator'
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
                            ],
                            acApproverName: userData.displayName || 'Academic Coordinator'
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
                        ],
                        mdApproverName: userData.displayName || 'Managing Director'
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

            await updateDocWithAudit(requestRef, {
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
            await updateDocWithAudit(requestRef, {
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

            // *** INVENTORY DEDUCTION: Decrease material quantity when clerk validates ***
            for (const item of request.items) {
                const searchField = item.materialCode ? 'materialCode' : 'materialName';
                const searchValue = item.materialCode || item.materialName;

                const materialQuery = query(
                    collection(db!, 'materials'),
                    where(searchField, '==', searchValue)
                );
                const materialSnap = await getDocs(materialQuery);

                if (!materialSnap.empty) {
                    const materialDoc = materialSnap.docs[0];
                    const currentQty = Number(materialDoc.data().quantity) || 0;
                    const deductQty = Number(item.quantity) || 0;
                    const newQty = Math.max(0, currentQty - deductQty);

                    await updateDocWithAudit(materialDoc.ref, { quantity: newQty });
                    console.log(`[Stock Out] ${searchValue}: ${currentQty} → ${newQty} (-${deductQty})`);
                } else {
                    console.warn(`[Stock Out] Material not found: ${searchValue}`);
                }
            }

            // Step 3: Generate Verification Code
            const code = generateVerificationCode();

            // Step 5: Save Data to Send_to_Users Collection
            await addDocWithAudit(collection(db!, 'Send_to_Users'), {
                request_id: request.id,
                requester_user_id: request.requesterId,
                requester_name: request.requesterName,
                department: request.department || '',
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
                        'border-lime-600'
                    }`}></div>
            </div>
        );
    }

    const themeColor = effectiveRole === 'academic_coordinator' ? 'amber' :
        effectiveRole === 'managing_director' ? 'indigo' :
            effectiveRole === 'dormitory_leader' ? 'blue' :
                effectiveRole === 'cafeteria_leader' ? 'orange' :
                    effectiveRole === 'sports_leader' ? 'rose' :
                        effectiveRole === 'student_service_leader' ? 'violet' :
                            'blue';

    return (
        <div className="w-full min-h-screen bg-[#f8fafc] pb-20">
            {model22Request && (
                <ClerkModel22Form
                    request={model22Request}
                    onClose={() => setModel22Request(null)}
                    onApprove={async (finalItems: RequestItem[]) => {
                        await handleApprove(model22Request, finalItems);
                        setModel22Request(null);
                    }}
                    readOnly={effectiveRole.toLowerCase().includes('store_keeper')}
                />
            )}

            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-10 space-y-6 animate-in fade-in duration-500">
                {selectedRequest && selectedRequest.formType === 'paper_form_20' && (
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
                        isProcurementTeamLeader={effectiveRole === 'team_leader'}
                        isStockClerk={effectiveRole === 'stock_clerk' || effectiveRole.includes('stock_clerk')}
                        onProcessModel22={() => {
                            setModel22Request(selectedRequest);
                            setSelectedRequest(null);
                        }}
                        currentUserDisplayName={userData?.displayName || ''}
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
                    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-8 duration-500">
                        <div className="flex items-center gap-3 px-6 py-3 rounded-xl shadow-lg bg-emerald-600 text-white">
                            <FiCheckCircle className="text-lg" />
                            <span className="font-bold text-sm">{successMessage.text}</span>
                        </div>
                    </div>
                )}

                {/* Header Section */}
                {effectiveRole.includes('store_keeper') ? (
                    <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group/header">
                        {/* Decorative glow */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-[100px] -mr-32 -mt-32 opacity-50 group-hover/header:opacity-100 transition-opacity duration-700" />

                        <div className="flex items-center gap-8 relative z-10">
                            <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-blue-500/40 relative">
                                <FiActivity className="text-4xl animate-pulse" />
                                <div className="absolute -inset-2 bg-blue-500/20 rounded-[2.2rem] animate-ping duration-[3000ms]" />
                            </div>
                            <div>
                                <h1 className="text-5xl font-black text-slate-900 tracking-tight">Store Verification</h1>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">AUTOMATED HANDOUT PIPELINE</p>
                            </div>
                        </div>
                        <div className="relative w-full max-w-md z-10">
                            <FiSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 text-2xl group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by requester name..."
                                className="w-full pl-16 pr-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-blue-500/5 focus:bg-white focus:border-blue-200 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 text-lg shadow-inner"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <h2 className="text-lg font-black text-slate-800">
                                {effectiveRole === 'academic_coordinator' ? 'Managerial Review' :
                                    effectiveRole === 'managing_director' ? 'Approval Queue' :
                                        'Material Requests'}
                                <span className="ml-2 text-sm font-bold text-slate-400">({filteredRequests.length})</span>
                            </h2>

                            <div className="flex items-center gap-2">
                                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <FiList />
                                </button>
                                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <FiGrid />
                                </button>
                                <button
                                    onClick={() => handleSelectAll(selectedRequests.length !== filteredRequests.length)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${selectedRequests.length === filteredRequests.length && filteredRequests.length > 0
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                                        }`}
                                >
                                    {selectedRequests.length === filteredRequests.length && filteredRequests.length > 0 ? 'Deselect' : 'Select All'}
                                </button>
                            </div>
                        </div>

                        <div className="mt-3 relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by requester or material name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-400 focus:bg-white outline-none text-sm text-slate-700 placeholder:text-slate-300"
                            />
                        </div>
                    </div>
                )}

                {/* Bulk Action Bar */}
                {selectedRequests.length > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                        <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-4 text-sm">
                            <span className="font-bold">{selectedRequests.length} selected</span>
                            <div className="h-5 w-px bg-slate-600"></div>
                            <button onClick={handleBulkApprove} disabled={isBulkProcessing} className="font-bold hover:text-emerald-400 transition-colors flex items-center gap-1">
                                <FiCheckCircle /> Approve
                            </button>
                            <button onClick={handleBulkReject} disabled={isBulkProcessing} className="font-bold hover:text-red-400 transition-colors flex items-center gap-1">
                                <FiXCircle /> Reject
                            </button>
                            <button onClick={() => setSelectedRequests([])} className="text-slate-400 hover:text-white">
                                <FiXCircle />
                            </button>
                        </div>
                    </div>
                )}

                {filteredRequests.length === 0 ? (
                    <div className="bg-white border border-dashed border-slate-200 rounded-xl p-12 text-center">
                        <FiClock className="text-2xl text-slate-300 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-slate-700">No Pending Requests</h3>
                        <p className="text-sm text-slate-400 mt-1">All caught up — nothing requires your attention.</p>
                    </div>
                ) : effectiveRole.includes('store_keeper') ? (
                    <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/20 overflow-hidden mt-8">
                        {/* Table Header */}
                        <div className="hidden md:grid grid-cols-[350px_1fr_250px_200px] gap-8 px-14 py-8 bg-slate-50/80 border-b border-slate-100 backdrop-blur-sm">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">REQUESTER</span>
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">ITEMS REQUESTED</span>
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">STATUS</span>
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">SERIAL CODES</span>
                        </div>
                        <div className="flex flex-col">
                            {filteredRequests.map(request => (
                                <div
                                    key={request.id}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setModel22Request(request);
                                    }}
                                    className={`flex flex-col md:grid md:grid-cols-[350px_1fr_250px_200px] gap-8 px-8 md:px-14 py-8 items-center border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition-all duration-300 group ${processingId === request.id ? 'opacity-50 pointer-events-none' : ''}`}
                                >
                                    {/* User Column */}
                                    <div className="flex items-center gap-6 w-full">
                                        <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center shadow-sm shrink-0 transition-transform group-hover:scale-110 ${request.id.charCodeAt(0) % 3 === 0 ? 'bg-indigo-50 border border-indigo-100 text-indigo-500' :
                                            request.id.charCodeAt(0) % 3 === 1 ? 'bg-emerald-50 border border-emerald-100 text-emerald-500' :
                                                'bg-amber-50 border border-amber-100 text-amber-500'
                                            }`}>
                                            <FiUser className="text-2xl" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-black text-slate-800 text-lg tracking-tight truncate">{request.requesterName}</h4>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-1">
                                                {request.createdAt?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) || 'N/A'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Items Column */}
                                    <div className="flex justify-center w-full">
                                        <div className="pl-4 pr-1 py-1.5 rounded-full border border-slate-200 bg-white shadow-sm flex items-center gap-4 group-hover:border-blue-300 transition-colors">
                                            <span className="text-sm font-bold text-slate-600 truncate max-w-[200px]">{request.items[0]?.materialName || 'Items'}</span>
                                            <span className="px-4 py-1.5 rounded-full bg-slate-100 text-[11px] font-black text-slate-500">
                                                {request.items.reduce((sum, item) => sum + item.quantity, 0)} pcs
                                            </span>
                                        </div>
                                    </div>

                                    {/* Status Column */}
                                    <div className="flex justify-center w-full">
                                        {request.status.includes('waiting') ? (
                                            <div className="px-6 py-2 rounded-full bg-[#fffcf0] border border-[#ffedcc] flex items-center gap-3 shadow-sm group-hover:bg-amber-50 transition-colors">
                                                <FiClock className="text-[#f59e0b] text-sm animate-spin-slow" />
                                                <span className="text-[11px] font-black text-[#ea580c] uppercase tracking-[0.15em]">WAITING ...</span>
                                            </div>
                                        ) : (
                                            <div className="px-6 py-2 rounded-full bg-[#f0fdf4] border border-[#bcf0da] flex items-center gap-3 shadow-sm group-hover:bg-emerald-50 transition-colors">
                                                <FiCheckCircle className="text-[#10b981] text-sm" />
                                                <span className="text-[11px] font-black text-[#059669] uppercase tracking-[0.15em]">VERIFIED</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Column */}
                                    <div className="text-right w-full hidden md:flex justify-end items-center gap-6">
                                        <div className="flex flex-col items-end gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setModel22Request(request);
                                                }}
                                                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-[0.15em] shadow-lg shadow-blue-600/20 hover:bg-blue-500 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2 group/btn"
                                            >
                                                View Model 22
                                                <FiArrowRight className="group-hover/btn:translate-x-1 transition-transform" />
                                            </button>
                                            <span className="text-[9px] italic font-bold text-slate-400 tracking-wide pr-1">
                                                {request.status.includes('waiting') ? 'Auto-verifying...' : 'Verified Record'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className={viewMode === 'grid' ? "grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4" : "flex flex-col gap-3 mt-4"}>
                        {filteredRequests.map(request => (
                            <div
                                key={request.id}
                                className={`bg-white border border-slate-200 rounded-xl overflow-hidden transition-all hover:shadow-md ${viewMode === 'grid' ? 'p-4' : ''
                                    } ${processingId === request.id ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                {viewMode === 'list' ? (
                                    <>
                                        {/* LIST VIEW */}
                                        <div className="flex-1 px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
                                            <div className="flex items-center gap-3 min-w-[250px]">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRequests.includes(request.id)}
                                                    onChange={() => toggleSelect(request.id)}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                                    <FiUser className="text-slate-500" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-slate-900 text-sm truncate">{request.requesterName}</h4>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold uppercase">
                                                            {request.department?.replace('_', ' ')}
                                                        </span>
                                                        {request.formType === 'paper_form_20' && (
                                                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-bold">
                                                                Form 20
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex-1 flex flex-wrap items-center gap-3">
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${request.status.includes('rejected') ? 'bg-red-500' :
                                                        request.status.includes('pending') ? 'bg-amber-500' : 'bg-emerald-500'
                                                        }`} />
                                                    <span className="text-[11px] font-bold text-slate-600 uppercase">
                                                        {request.status.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                                    <FiCalendar className="text-slate-300" />
                                                    {request.createdAt?.toDate().toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) || 'N/A'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {request.formType === 'paper_form_20' ? (
                                                    <button
                                                        onClick={() => setSelectedRequest(request)}
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-500 transition-all flex items-center gap-1.5"
                                                    >
                                                        Process Model 20 <FiArrowRight />
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                                        <FiBox size={14} />
                                                        {request.items.length} Items
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {request.formType !== 'paper_form_20' && (
                                            <div className="px-4 pb-3 border-t border-slate-100 pt-3">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {request.items.map((item, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                                                            <div className="flex items-center gap-2.5 truncate">
                                                                <div className="w-8 h-8 rounded-md bg-white border border-slate-100 flex items-center justify-center flex-shrink-0">
                                                                    {item.image || materialImages[item.materialId] ? (
                                                                        <Image src={item.image || materialImages[item.materialId]} alt={item.materialName} width={32} height={32} className="rounded-md object-cover" />
                                                                    ) : <FiBox className="text-slate-300 text-xs" />}
                                                                </div>
                                                                <div className="truncate">
                                                                    <p className="text-sm font-bold text-slate-800 truncate">{item.materialName}</p>
                                                                    <p className="text-[10px] text-slate-400">{item.materialCode || 'No Code'}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                                                {(effectiveRole === 'academic_coordinator' || effectiveRole === 'managing_director') ? (
                                                                    <input
                                                                        type="number"
                                                                        value={modifiedRequests[request.id]?.[idx]?.quantity ?? item.quantity}
                                                                        onChange={(e) => handleItemQuantityChange(request.id, idx, Number(e.target.value), request.items)}
                                                                        className={`w-14 px-2 py-1 border rounded text-right font-bold text-sm outline-none ${(modifiedRequests[request.id]?.[idx]?.quantity ?? item.quantity) !== item.quantity
                                                                            ? 'text-rose-600 border-rose-200 bg-rose-50'
                                                                            : 'text-slate-800 border-slate-200 bg-white'
                                                                            }`}
                                                                    />
                                                                ) : (
                                                                    <span className="text-sm font-bold text-slate-700">{item.quantity}</span>
                                                                )}
                                                                <span className="text-[10px] text-slate-400">{item.unit}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {(effectiveRole === 'academic_coordinator' || effectiveRole === 'managing_director') && isRequestAdjusted(request) && (
                                                    <div className="mt-2 p-3 bg-rose-50 border border-rose-100 rounded-lg">
                                                        <label className="text-[10px] font-bold text-rose-600 uppercase flex items-center gap-1 mb-1">
                                                            <FiAlertCircle /> Adjustment Reason
                                                        </label>
                                                        <textarea
                                                            value={adjustmentReasons[request.id] || ''}
                                                            onChange={(e) => setAdjustmentReasons({ ...adjustmentReasons, [request.id]: e.target.value })}
                                                            placeholder="Why were quantities changed?"
                                                            className="w-full bg-white border border-rose-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none h-14"
                                                        />
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-2 pt-3">
                                                    {effectiveRole.includes('stock_clerk') ? (
                                                        <button onClick={() => setModel22Request(request)} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all">
                                                            Proceed to Model 22 <FiArrowRight />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => setSelectedRequest(request)}
                                                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                                                        >
                                                            Process Request <FiArrowRight />
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleReject(request)} className="px-3 py-2 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-red-500 hover:border-red-300 transition-all">
                                                        <FiXCircle size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {/* GRID VIEW */}
                                        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRequests.includes(request.id)}
                                                    onChange={() => toggleSelect(request.id)}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                                    <FiUser />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-900 text-sm">{request.requesterName}</h4>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase">{request.department?.replace('_', ' ')}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-center gap-1.5 justify-end mb-1">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${request.status.includes('rejected') ? 'bg-red-500' :
                                                        request.status.includes('pending') ? 'bg-amber-500' : 'bg-emerald-500'
                                                        }`} />
                                                    <span className="text-[10px] font-bold text-slate-600 uppercase">{request.status.replace(/_/g, ' ')}</span>
                                                </div>
                                                <p className="text-[10px] text-slate-400">{request.createdAt?.toDate().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                            </div>
                                        </div>

                                        {request.formType === 'paper_form_20' ? (
                                            <div className="bg-slate-50 rounded-xl p-6 flex flex-col items-center justify-center border border-slate-200 border-dashed">
                                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-3">
                                                    <FiArrowRight className="text-xl text-blue-500" />
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-4">Model 20 Requisition</p>
                                                <button
                                                    onClick={() => setSelectedRequest(request)}
                                                    className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-500 transition-all"
                                                >
                                                    Process Request
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3 flex-1 flex flex-col">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Requested Items ({request.items.length})</p>
                                                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                                    {request.items.map((item, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-md bg-white border border-slate-100 flex items-center justify-center overflow-hidden">
                                                                    {item.image || materialImages[item.materialId] ? (
                                                                        <Image src={item.image || materialImages[item.materialId]} alt={item.materialName} width={32} height={32} className="object-cover" />
                                                                    ) : <FiBox className="text-slate-300" />}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-slate-700">{item.materialName}</p>
                                                                    <p className="text-[10px] text-slate-400">{item.materialCode || 'No Code'}</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                {(effectiveRole === 'academic_coordinator' || effectiveRole === 'managing_director') ? (
                                                                    <input
                                                                        type="number"
                                                                        value={modifiedRequests[request.id]?.[idx]?.quantity ?? item.quantity}
                                                                        onChange={(e) => handleItemQuantityChange(request.id, idx, Number(e.target.value), request.items)}
                                                                        className={`w-14 px-2 py-1 bg-white border rounded text-right font-bold text-sm outline-none ${(modifiedRequests[request.id]?.[idx]?.quantity ?? item.quantity) !== item.quantity
                                                                            ? 'text-rose-600 border-rose-200 bg-rose-50'
                                                                            : 'text-slate-800 border-slate-200'
                                                                            }`}
                                                                    />
                                                                ) : (
                                                                    <p className="text-sm font-bold text-slate-800">{item.quantity} <span className="text-[10px] text-slate-400 ml-1">{item.unit}</span></p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {(effectiveRole === 'academic_coordinator' || effectiveRole === 'managing_director') && isRequestAdjusted(request) && (
                                                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg space-y-1">
                                                        <label className="text-[10px] font-bold text-rose-600 uppercase flex items-center gap-1">
                                                            <FiAlertCircle /> Adjustment Reason
                                                        </label>
                                                        <textarea
                                                            value={adjustmentReasons[request.id] || ''}
                                                            onChange={(e) => setAdjustmentReasons({ ...adjustmentReasons, [request.id]: e.target.value })}
                                                            placeholder="Why were quantities changed?"
                                                            className="w-full bg-white border border-rose-200 rounded-lg px-2 py-1.5 text-sm outline-none resize-none h-12"
                                                        />
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-2 pt-3 mt-auto">
                                                    <button
                                                        onClick={() => effectiveRole.includes('stock_clerk') ? setModel22Request(request) : setSelectedRequest(request)}
                                                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                                                    >
                                                        {effectiveRole.includes('stock_clerk') ? 'Proceed to Model 22' : 'Process Request'} <FiArrowRight />
                                                    </button>
                                                    <button onClick={() => handleReject(request)} className="px-3 py-2 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-red-500 hover:border-red-300 transition-all">
                                                        <FiXCircle size={16} />
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





                {/* Rejection Modal */}
                {rejectModalOpen && requestToReject && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                                    <FiXCircle className="text-xl" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Reject Request</h3>
                                    <p className="text-xs text-slate-500">Provide a reason for rejection</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                                        <FiUser className="text-slate-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Requester</p>
                                        <p className="text-sm font-bold text-slate-700 truncate">{requestToReject.requesterName}</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Rejection Reason</label>
                                    <textarea
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        placeholder="Explain why this request is being rejected..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:border-rose-400 focus:bg-white resize-none h-28"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end mt-6">
                                <button
                                    onClick={() => {
                                        setRejectModalOpen(false);
                                        setRequestToReject(null);
                                        setRejectReason('');
                                    }}
                                    className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmReject}
                                    disabled={!rejectReason.trim()}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${!rejectReason.trim()
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-rose-500 text-white hover:bg-rose-600'
                                        }`}
                                >
                                    Confirm Reject
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* @ts-ignore */}
                <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
            </div>
        </div>
    );
}
