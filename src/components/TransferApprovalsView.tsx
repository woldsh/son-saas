'use client';
import { addDocWithAudit, updateDocWithAudit } from '@/utils/auditTrail';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/lib/firebase';
import {
    collection, query, where, onSnapshot, doc,  serverTimestamp, getDocs, getDoc
} from 'firebase/firestore';
import { FiCheckCircle, FiClock, FiCheck, FiX, FiRefreshCcw, FiFileText } from 'react-icons/fi';
import { Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import HandoverReceiptForm from './HandoverReceiptForm';

export default function TransferApprovalsView() {
    const { user, userRole, department: authDepartment } = useAuth();
    const langCtx = useLanguage();
    const t: any = langCtx.t;
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState<any>(null);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [activeFormPage, setActiveFormPage] = useState(1);
    const ordersPerPage = 5;
    const pathname = usePathname();

    // Step 1: Fetch user profile from Firestore (same as MaterialRequestView)
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

    // Determine the user's effective role (matching MaterialRequestView pattern)
    const rawRole = userData?.userRole?.includes('_head') ? 'department_head' :
        userData?.userRole === 'academic_coordinator' ? 'academic_coordinator' :
            userData?.userRole === 'procurement_team_leader' ? 'procurement_team_leader' :
                (userData?.userRole === 'managing_director_leader' || userData?.userRole === 'managing_director') ? 'managing_director' :
                    userData?.userRole?.includes('stock_clerk') ? 'stock_clerk' :
                        userData?.userRole?.includes('_leader') ? 'team_leader' :
                            userRole || (
                                pathname?.includes('/managing-director') ? 'managing_director' :
                                    pathname?.includes('/department-head') ? 'department_head' :
                                        pathname?.includes('/academic-coordinator') ? 'academic_coordinator' :
                                            pathname?.includes('/stock-clerk') ? 'stock_clerk' :
                                                pathname?.includes('/team-leader') ? 'team_leader' :
                                                    ''
                            );
    const effectiveRole = (rawRole || '').toLowerCase().replace(/\s+/g, '_');

    // Step 2: Set up Firestore listener (only after userData is loaded)
    useEffect(() => {
        if (!user || !db || !userData) {
            if (!userData) return; // Wait for userData
            setLoading(false);
            return;
        }

        let q;
        const transfersRef = collection(db, 'Transfer_Orders');

        // To avoid composite index requirements, we'll query by the most restrictive single field 
        // and filter the rest in memory.
        if (effectiveRole === 'department_head') {
            q = query(transfersRef, where('currentApproverRole', '==', userData.userRole));
        } else if (effectiveRole === 'academic_coordinator') {
            q = query(transfersRef, where('currentApproverRole', '==', 'academic_coordinator'));
        } else if (effectiveRole === 'procurement_team_leader') {
            q = query(transfersRef, where('currentApproverRole', '==', 'procurement_team_leader'));
        } else if (effectiveRole === 'team_leader' || effectiveRole.includes('_leader')) {
            q = query(transfersRef, where('currentApproverRole', '==', userData.userRole));
        } else if (effectiveRole === 'managing_director') {
            q = query(transfersRef, where('currentApproverRole', '==', 'managing_director'));
        } else if (effectiveRole.includes('stock_clerk')) {
            q = query(transfersRef, where('status', '==', 'pending_clerk'));
        } else {
            setLoading(false);
            return;
        }

        const unsub = onSnapshot(q, (snap) => {
            let fetchedOrders = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

            console.log("DEBUG - effectiveRole:", effectiveRole);
            console.log("DEBUG - raw fetchedOrders:", fetchedOrders);

            // In-memory filtering to replace the secondary where() clauses
            if (effectiveRole === 'department_head') {
                fetchedOrders = fetchedOrders.filter(o => o.status === 'pending_department_leader');
            } else if (effectiveRole === 'academic_coordinator') {
                fetchedOrders = fetchedOrders.filter(o => o.status === 'approved_by_head');
            } else if (effectiveRole === 'procurement_team_leader') {
                fetchedOrders = fetchedOrders.filter(o => ['approved_by_coordinator', 'approved_by_md'].includes(o.status));
            } else if (effectiveRole === 'team_leader' || effectiveRole.includes('_leader')) {
                fetchedOrders = fetchedOrders.filter(o => o.status === 'pending_department_leader');
            } else if (effectiveRole === 'managing_director') {
                fetchedOrders = fetchedOrders.filter(o => o.status === 'pending_managing_director');
            }

            // Filter by material type for specific stock clerk roles
            if (effectiveRole.includes('stock_clerk') && userData?.userRole) {
                const clerkRole = userData.userRole.toLowerCase();
                if (clerkRole.includes('fixed_asset')) {
                    fetchedOrders = fetchedOrders.filter(o => {
                        if (!o.items || o.items.length === 0) return true;
                        return o.items.some((item: any) => {
                            const t = (item.materialType || '').toLowerCase();
                            return t.includes('fixed') || t === 'fixed_asset' || t === '';
                        });
                    });
                } else if (clerkRole.includes('consumable')) {
                    fetchedOrders = fetchedOrders.filter(o => {
                        if (!o.items || o.items.length === 0) return true;
                        return o.items.some((item: any) => {
                            const t = (item.materialType || '').toLowerCase();
                            return t.includes('consumable') || t === '';
                        });
                    });
                }
            }

            console.log("DEBUG - filteredOrders:", fetchedOrders);

            setOrders(fetchedOrders);
            setLoading(false);
        }, (error) => {
            console.error("Firestore error in TransferApprovalsView:", error);
            setLoading(false);
        });

        return () => unsub();
    }, [user, userData, effectiveRole]);

    const handleApprove = async (order: any) => {
        if (!db || processingIds.has(order.id)) return;

        // Strict signature validation
        if (!order.delivererSignatureData || !order.receiverSignatureData || !order.overseerSignatureData) {
            alert("Approval blocked! All three signatures (አስረካቢ, ተረካቢ, አረጋጋጭ) must be completed before you can approve this transfer.");
            return;
        }

        setProcessingIds(prev => new Set(prev).add(order.id));
        try {
            let nextStatus = '';
            let nextApproverRole = '';
            let nextApproverId = '';

            if (effectiveRole === 'department_head') {
                const acQuery = query(collection(db!, 'users'), where('userRole', '==', 'academic_coordinator'));
                const acSnap = await getDocs(acQuery);
                nextApproverRole = 'academic_coordinator';
                nextStatus = 'approved_by_head';
                nextApproverId = acSnap.empty ? 'PENDING_AC' : acSnap.docs[0].id;
            } else if (effectiveRole === 'academic_coordinator') {
                const ptlQuery = query(collection(db!, 'users'), where('userRole', '==', 'procurement_team_leader'));
                const ptlSnap = await getDocs(ptlQuery);
                nextApproverRole = 'procurement_team_leader';
                nextStatus = 'approved_by_coordinator';
                nextApproverId = ptlSnap.empty ? 'PENDING_PTL' : ptlSnap.docs[0].id;
            } else if (effectiveRole === 'procurement_team_leader') {
                nextApproverRole = 'stock_clerk';
                nextStatus = 'pending_clerk';
                nextApproverId = 'PENDING_CLERK'; // Any clerk can finalize
            } else if (effectiveRole === 'team_leader' || effectiveRole.includes('_leader')) {
                const mdQuery = query(collection(db!, 'users'), where('userRole', 'in', ['managing_director', 'managing_director_leader']));
                const mdSnap = await getDocs(mdQuery);
                nextApproverRole = 'managing_director';
                nextStatus = 'pending_managing_director';
                nextApproverId = mdSnap.empty ? 'PENDING_MD' : mdSnap.docs[0].id;
            } else if (effectiveRole === 'managing_director') {
                const ptlQuery = query(collection(db!, 'users'), where('userRole', '==', 'procurement_team_leader'));
                const ptlSnap = await getDocs(ptlQuery);
                nextApproverRole = 'procurement_team_leader';
                nextStatus = 'approved_by_md';
                nextApproverId = ptlSnap.empty ? 'PENDING_PTL' : ptlSnap.docs[0].id;
            } else if (effectiveRole.includes('stock_clerk')) {
                // Finalize! Update stock records to remove them.
                nextStatus = 'completed';

                // Update the User-Report inventory for each item
                for (const item of order.items || []) {
                    if (item.id) {
                        try {
                            const oldReportRef = doc(db, 'User-Report', item.id);
                            const oldReportSnap = await getDoc(oldReportRef);

                            // 1. Mark deliverer's record as returned
                            await updateDocWithAudit(oldReportRef, {
                                status: 'returned',
                                returnedAt: serverTimestamp(),
                                returnedToOrder: order.id
                            });

                            // 2. Create new record for the receiver
                            if (oldReportSnap.exists()) {
                                const oldData = oldReportSnap.data();

                                // Extract department from recipientRole if possible
                                let receiverDept = '';
                                if (order.recipientRole && order.recipientRole.includes('-')) {
                                    receiverDept = order.recipientRole.split('-')[1]?.trim() || '';
                                }

                                await addDocWithAudit(collection(db, 'User-Report'), {
                                    ...oldData,
                                    requestId: order.id,
                                    requesterId: order.itemReceiverId || order.recipientId || '',
                                    requesterName: order.itemReceiverName || order.recipientName || '',
                                    department: receiverDept,
                                    withdrawalDate: serverTimestamp(),
                                    status: 'accepted',
                                    issuedAt: serverTimestamp(),
                                    history: [
                                        ...(oldData.history || []),
                                        {
                                            status: 'transferred_via_model22',
                                            date: new Date().toISOString(),
                                            notes: `Transferred from ${order.createdByName || 'previous owner'} via Order ${order.id}`
                                        }
                                    ]
                                });
                            }
                        } catch (err) {
                            console.error("Failed to process User-Report item transfer", item.id, err);
                        }
                    }
                }
            }

            const updates: any = {
                status: nextStatus,
                currentApproverRole: nextApproverRole,
                currentApproverId: nextApproverId,
            };

            if (nextStatus === 'completed') {
                updates.completedAt = serverTimestamp();
            }

            await updateDocWithAudit(doc(db!, 'Transfer_Orders', order.id), updates);

        } catch (e) {
            console.error('Error approving transfer:', e);
            alert("Failed to approve. Check console.");
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(order.id);
                return newSet;
            });
        }
    };

    const handleReject = (orderId: string) => {
        setRejectingOrderId(orderId);
        setRejectReason('');
    };

    const confirmReject = async (orderId: string) => {
        if (!db || processingIds.has(orderId)) return;
        if (!rejectReason.trim()) {
            alert("Please provide a reason or feedback for rejection.");
            return;
        }
        
        setProcessingIds(prev => new Set(prev).add(orderId));
        try {
            await updateDocWithAudit(doc(db!, 'Transfer_Orders', orderId), {
                status: 'rejected',
                rejectedAt: serverTimestamp(),
                rejectedBy: effectiveRole,
                rejectReason: rejectReason.trim()
            });
            setRejectingOrderId(null);
            setRejectReason('');
        } catch (e) {
            console.error('Error rejecting transfer:', e);
            alert("Failed to reject. Check console.");
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(orderId);
                return newSet;
            });
        }
    };

    if (loading) return null;
    if (orders.length === 0) return null;

    const blankValue: React.CSSProperties = {
        borderBottom: '1.5px dashed #000', minHeight: '22px', padding: '0 4px',
        fontFamily: "'Times New Roman', serif", fontSize: '14px', fontWeight: 'bold',
        display: 'inline-block', minWidth: '80px',
    };

    const handlePrint = () => window.print();

    const indexOfLastOrder = currentPage * ordersPerPage;
    const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
    const currentOrders = orders.slice(indexOfFirstOrder, indexOfLastOrder);
    const totalPages = Math.ceil(orders.length / ordersPerPage);

    return (
        <div className="space-y-6 mt-8">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <FiRefreshCcw className="text-xl" />
                </div>
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-slate-900">{t('transfer_approvals') || 'Transfer & Return Approvals'}</h2>
                    <p className="text-sm text-slate-600">Review transfer requests waiting for your approval.</p>
                </div>
                <span className="px-4 py-2 bg-indigo-200 text-indigo-900 rounded-full text-sm font-bold">{orders.length}</span>
            </motion.div>

            <AnimatePresence>
                {currentOrders.map((order, idx) => {
                    const isExpanded = expandedOrderId === order.id;
                    return (
                        <motion.div key={order.id} id={`order-${order.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                            {/* Collapsed header */}
                            <button
                                onClick={() => {
                                    const newId = isExpanded ? null : order.id;
                                    setExpandedOrderId(newId);
                                    setActiveFormPage(1);
                                    if (newId) {
                                        setTimeout(() => {
                                            document.getElementById(`order-${order.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }, 100);
                                    }
                                }}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors print:hidden"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                                        {order.recipientName?.charAt(0)?.toUpperCase() || 'T'}
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold text-slate-900 text-sm">Transfer from {order.recipientName} to {order.itemReceiverName || 'Store'}</p>
                                        <p className="text-xs text-slate-500">Ref: {order.refNumber || order.id.slice(-6)} • {order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : '—'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs font-semibold flex items-center gap-1">
                                        <FiClock className="text-[10px]" /> Pending
                                    </span>
                                    <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                                </div>
                            </button>

                            {/* Expanded: Full paper form */}
                            {isExpanded && (
                                <div className="border-t border-slate-200">
                                    {/* Print button */}
                                    <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 border-b border-slate-200 print:hidden justify-end">
                                        <button onClick={handlePrint}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm">
                                            <Printer className="w-4 h-4" /> Print
                                        </button>
                                    </div>

                                    {/* FORM 1: Transfer Order Letter */}
                                    <div className={`w-full overflow-x-auto bg-slate-100 print:bg-white custom-scrollbar ${activeFormPage !== 1 ? 'hidden print:block' : ''}`}>
                                        <div className="flex justify-center py-8 px-4 min-w-[210mm] print:py-0 print:px-0">
                                            <div className="transfer-order-print-area print:shadow-none print:border-none"
                                                style={{
                                                    width: '210mm', minHeight: '297mm', padding: '25mm',
                                                    fontFamily: "'Times New Roman', serif", color: '#000', backgroundColor: '#fff',
                                                    display: 'flex', flexDirection: 'column',
                                                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
                                                }}>
                                                {/* HEADER */}
                                                <div style={{ borderTop: '1px solid #000', borderBottom: '3px double #000', padding: '10px 0', marginBottom: '20px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ width: '35%', fontSize: '12px', lineHeight: '1.6', fontWeight: 'bold', textAlign: 'center' }}>
                                                            <p style={{ margin: 0 }}>ኢትዮጵያ ፌዴራላዊ ዲሞክራሲያዊ ሪፐብሊክ</p>
                                                            <p style={{ margin: 0 }}>በትምህርት ሚኒስቴር</p>
                                                            <p style={{ margin: 0 }}>ደብረ ማርቆስ ዩኒቨርሲቲ</p>
                                                            <p style={{ margin: 0 }}>ቡሬ ካምፓስ</p>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30%' }}>
                                                            <Image src="/logo.png" alt="DMU Logo" width={85} height={85} style={{ objectFit: 'contain' }} priority />
                                                        </div>
                                                        <div style={{ width: '35%', fontSize: '12px', lineHeight: '1.6', fontWeight: 'bold', textAlign: 'center' }}>
                                                            <p style={{ margin: 0 }}>The Federal Democratic Republic of Ethiopia</p>
                                                            <p style={{ margin: 0 }}>Ministry of Education</p>
                                                            <p style={{ margin: 0 }}>Debremarkos University</p>
                                                            <p style={{ margin: 0 }}>Burie Campus</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* REF & DATE */}
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: '30px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: '12px' }}>
                                                        <span style={{ fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>ቁጥር: ደ/ማ/ዩ/ቡ/ካ</span>
                                                        <span style={{ ...blankValue, width: '160px' }}>{order.refNumber}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                                                        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>ቀን:</span>
                                                        <span style={{ ...blankValue, width: '160px' }}>{order.date}</span>
                                                    </div>
                                                </div>
                                                {/* RECIPIENT */}
                                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: '15px' }}>
                                                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>ለ</span>
                                                    <span style={{ ...blankValue, width: '300px' }}>{order.recipientName}</span>
                                                </div>
                                                <div style={{ marginBottom: '20px' }}><span style={{ fontSize: '14px', fontWeight: 'bold', textDecoration: 'underline' }}>ደ/ማ/ዩ፡</span></div>
                                                {/* SUBJECT */}
                                                <div style={{ textAlign: 'center', marginBottom: '5px', marginTop: '10px' }}>
                                                    <span style={{ fontSize: '16px', fontWeight: 'bold' }}>ጉዳዩ፡ <span style={{ textDecoration: 'underline' }}>ንብረት እንዲያስረክቡ ስለማዘዝ፡</span></span>
                                                </div>
                                                <div style={{ borderBottom: '1px solid #000', marginBottom: '30px' }}></div>
                                                {/* BODY */}
                                                <div style={{ fontSize: '14px', fontWeight: 'bold', lineHeight: '2.8' }}>
                                                    <p style={{ margin: '8px 0 0 0', textAlign: 'justify' }}>
                                                        <span style={{ paddingRight: '30px' }}></span>
                                                        እርስዎ ከነበሩበት
                                                        <span style={{ borderBottom: '1.5px dashed #000', padding: '0 8px', margin: '0 4px', color: '#1d4ed8' }}>{order.recipientRole || '\u00A0\u00A0\u00A0\u00A0'}</span>
                                                        መደብ ወደ
                                                        <span style={{ borderBottom: '1.5px dashed #000', padding: '0 8px', margin: '0 4px' }}>{order.newPosition || '\u00A0\u00A0\u00A0\u00A0'}</span>
                                                        ስራ መደብ የተዛወሩ /የለቀቁ ስለሆነ በእጅዎ የሚገኘውን ንብረት ለአቶ/ወ/ሮ/ወ/ሪት
                                                        <span style={{ borderBottom: '1.5px dashed #000', padding: '0 8px', margin: '0 4px' }}>{order.itemReceiverName || '\u00A0\u00A0\u00A0\u00A0'}</span>
                                                        በአቶ/ወ/ሮ/ወ/ሪት
                                                        <span style={{ borderBottom: '1.5px dashed #000', padding: '0 8px', margin: '0 4px' }}>{order.overseerName || '\u00A0\u00A0\u00A0\u00A0'}</span>
                                                        አረካካቢነት እንዲያስረክቡ እናሳስባለን፡፡
                                                    </p>
                                                </div>
                                                <div style={{ textAlign: 'center', margin: '40px 0' }}>
                                                    <p style={{ fontSize: '15px', fontWeight: 'bold', margin: 0 }}>« ከሠላምታ ጋር »</p>
                                                </div>
                                                {/* CARBON COPY */}
                                                <div style={{ marginTop: 'auto', paddingTop: '40px' }}>
                                                    <p style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '14px', textDecoration: 'underline', textUnderlineOffset: '4px' }}>ግልባጭ:</p>
                                                    <div style={{ marginLeft: '24px', fontSize: '14px', fontWeight: 'bold', lineHeight: '2.4' }}>
                                                        <p style={{ margin: 0 }}>፩ ለንብረት ክፍል</p>
                                                        <p style={{ margin: 0 }}>፪ ለንብረት አስረካቢ</p>
                                                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                                                            <span>፫ ለአቶ/ወ/ሮ/ወ/ሪት</span>
                                                            <span style={{ ...blankValue, width: '250px' }}>{order.ccName}</span>
                                                        </div>
                                                    </div>
                                                    <p style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '20px', marginLeft: '48px', textDecoration: 'underline' }}>ደ/ማ/ዩ:</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* FORM 2: Handover Receipt */}
                                    <div className={`w-full overflow-x-auto bg-slate-100 print:bg-white custom-scrollbar print:border-t-0 print:mt-0 ${activeFormPage !== 2 ? 'hidden print:block' : 'border-t border-slate-200 mt-2'}`}>
                                        <div className="flex justify-center py-8 px-4 min-w-[210mm] print:py-0 print:px-0">
                                            <HandoverReceiptForm
                                                recipientName={order.recipientName}
                                                itemReceiverName={order.itemReceiverName}
                                                overseerName={order.overseerName}
                                                recipientRole={order.recipientRole}
                                                items={order.items || []}
                                                delivererSigned={!!order.delivererSignatureData}
                                                delivererSignatureDate={order.completedAt}
                                                delivererSignatureData={order.delivererSignatureData}
                                                receiverSigned={!!order.receiverAcknowledged}
                                                receiverSignatureDate={order.receiverAcknowledgedAt}
                                                receiverSignatureData={order.receiverSignatureData}
                                                overseerSigned={!!order.overseerAcknowledged}
                                                overseerSignatureDate={order.overseerAcknowledgedAt}
                                                overseerSignatureData={order.overseerSignatureData}
                                            />
                                        </div>
                                    </div>

                                    {/* Approve / Reject Action Area */}
                                    <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-center gap-4 print:hidden">
                                        {(effectiveRole === 'managing_director' || effectiveRole === 'academic_coordinator') && (
                                            rejectingOrderId === order.id ? (
                                                <div className="flex flex-col gap-2 w-full max-w-md bg-white p-4 rounded-xl border border-red-200 shadow-sm">
                                                    <label className="text-sm font-bold text-slate-700">Reason for Rejection / Feedback:</label>
                                                    <textarea 
                                                        value={rejectReason}
                                                        onChange={(e) => setRejectReason(e.target.value)}
                                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                                                        rows={3}
                                                        placeholder="Explain why this transfer is being rejected..."
                                                    />
                                                    <div className="flex gap-2 justify-end mt-2">
                                                        <button 
                                                            onClick={() => { setRejectingOrderId(null); setRejectReason(''); }}
                                                            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button 
                                                            onClick={() => confirmReject(order.id)}
                                                            disabled={processingIds.has(order.id) || !rejectReason.trim()}
                                                            className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                                                        >
                                                            {processingIds.has(order.id) ? 'Processing...' : 'Confirm Reject'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleReject(order.id)}
                                                    disabled={processingIds.has(order.id)}
                                                    className={`px-8 py-3 border rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${processingIds.has(order.id) ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white border-red-200 text-red-600 hover:bg-red-50'}`}
                                                >
                                                    <FiX /> Reject
                                                </button>
                                            )
                                        )}
                                        
                                        {rejectingOrderId !== order.id && (
                                            <button
                                                onClick={() => handleApprove(order)}
                                                disabled={processingIds.has(order.id)}
                                                className={`px-8 py-3 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shadow-sm ${processingIds.has(order.id) ? 'bg-indigo-300 text-white cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                                            >
                                                <FiCheck /> {processingIds.has(order.id) ? 'Processing...' : (effectiveRole.includes('stock_clerk') ? 'Finalize Transfer' : 'Approve Transfer')}
                                            </button>
                                        )}
                                    </div>

                                    {/* Form Pagination Controls */}
                                    <div className="flex justify-center items-center py-6 bg-white border-t border-slate-200 print:hidden">
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => {
                                                    setActiveFormPage(1);
                                                    document.getElementById(`order-${order.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                }}
                                                disabled={activeFormPage === 1}
                                                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                            >
                                                &lt; Back
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setActiveFormPage(1);
                                                    document.getElementById(`order-${order.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                }}
                                                className={`w-10 h-10 flex items-center justify-center font-bold text-sm transition-colors border ${activeFormPage === 1
                                                    ? 'bg-slate-900 text-white border-slate-900'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                                    }`}
                                            >
                                                1
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setActiveFormPage(2);
                                                    document.getElementById(`order-${order.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                }}
                                                className={`w-10 h-10 flex items-center justify-center font-bold text-sm transition-colors border ${activeFormPage === 2
                                                    ? 'bg-slate-900 text-white border-slate-900'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                                    }`}
                                            >
                                                2
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setActiveFormPage(2);
                                                    document.getElementById(`order-${order.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                }}
                                                disabled={activeFormPage === 2}
                                                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                            >
                                                Next &gt;
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2 mt-8 mb-4 print:hidden">
                    <button
                        onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setExpandedOrderId(null); }}
                        disabled={currentPage === 1}
                        className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                    >
                        Previous
                    </button>
                    <div className="flex items-center space-x-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                onClick={() => { setCurrentPage(page); setExpandedOrderId(null); }}
                                className={`w-10 h-10 rounded-xl font-bold transition-all shadow-sm ${currentPage === page
                                    ? 'bg-blue-600 text-white border border-blue-600'
                                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                                    }`}
                            >
                                {page}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); setExpandedOrderId(null); }}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                    >
                        Next
                    </button>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body { background: white !important; padding: 0 !important; margin: 0 !important; }
                    body * { visibility: hidden; }
                    .transfer-order-print-area, .transfer-order-print-area *,
                    .handover-receipt-print-area, .handover-receipt-print-area * { visibility: visible; }
                    .transfer-order-print-area, .handover-receipt-print-area {
                        position: relative; width: 100% !important;
                        padding: 20mm !important; box-shadow: none !important; border: none !important;
                        page-break-after: always;
                    }
                    @page { size: A4; margin: 0; }
                }
            `}} />
        </div>
    );
}
