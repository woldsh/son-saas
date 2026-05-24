'use client';
import { updateDocWithAudit } from '@/utils/auditTrail';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/lib/firebase';
import {
    collection, query, where, onSnapshot, doc,  serverTimestamp, getDoc, getDocs
} from 'firebase/firestore';
import { FiFileText, FiClock, FiCheck } from 'react-icons/fi';
import { Loader2, CheckCircle, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import HandoverReceiptForm from './HandoverReceiptForm';

interface TransferOrder {
    id: string;
    recipientId: string;
    recipientName: string;
    recipientEmail: string;
    recipientRole: string;
    newPosition: string;
    itemReceiverName: string;
    itemReceiverId?: string;
    overseerName: string;
    overseerId?: string;
    refNumber: string;
    date: string;
    ccName: string;
    status: string;
    createdBy: string;
    createdByName: string;
    createdAt: any;
    receiverAcknowledgedAt?: any;
    items?: any[];
    delivererSignatureData?: string;
    receiverSignatureData?: string;
    overseerSignatureData?: string;
    completedAt?: any;
    receiverAcknowledged?: boolean;
    overseerAcknowledged?: boolean;
    overseerAcknowledgedAt?: any;
    rejectReason?: string;
    rejectedBy?: string;
    rejectedAt?: any;
}

export default function PendingTransferOrders() {
    const { user } = useAuth();
    const langCtx = useLanguage();
    const t: any = langCtx.t;
    const [orders, setOrders] = useState<TransferOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [currentSignature, setCurrentSignature] = useState<string | null>(null);
    const [activeFormPage, setActiveFormPage] = useState(1);
    const router = useRouter();

    useEffect(() => {
        if (!user || !db) { 
            const t = setTimeout(() => setLoading(false), 0);
            return () => clearTimeout(t);
        }

        // Listen for orders where user is the DELIVERER (recipientId)
        const q1 = query(
            collection(db!, 'Transfer_Orders'),
            where('recipientId', '==', user.uid),
            where('status', 'in', ['pending_handover', 'rejected'])
        );

        // Listen for orders where user is the RECEIVER (itemReceiverId)
        const q2 = query(
            collection(db!, 'Transfer_Orders'),
            where('itemReceiverId', '==', user.uid),
            where('status', 'in', ['pending_handover', 'rejected'])
        );

        let delivererOrders: TransferOrder[] = [];
        let receiverOrders: TransferOrder[] = [];
        let loaded1 = false, loaded2 = false;

        const merge = () => {
            // Merge and deduplicate by id
            const map = new Map<string, TransferOrder>();
            [...delivererOrders, ...receiverOrders].forEach(o => map.set(o.id, o));
            const merged = Array.from(map.values());
            setOrders(merged);
            if (merged.length === 1) setExpandedOrderId(merged[0].id);
            if (loaded1 && loaded2) setLoading(false);
            setCurrentSignature(null);
        };

        const unsub1 = onSnapshot(q1, (snap) => {
            delivererOrders = snap.docs.map(d => ({ id: d.id, ...d.data() } as TransferOrder));
            loaded1 = true;
            merge();
        }, () => { loaded1 = true; merge(); });

        const unsub2 = onSnapshot(q2, (snap) => {
            receiverOrders = snap.docs.map(d => ({ id: d.id, ...d.data() } as TransferOrder));
            loaded2 = true;
            merge();
        }, () => { loaded2 = true; merge(); });

        return () => { unsub1(); unsub2(); };
    }, [user]);

    const handleAcknowledge = async (orderId: string, signatureData: string) => {
        if (!db || !user) return;
        
        // Find the specific order to validate signatures
        const order = orders.find(o => o.id === orderId);
        if (order && (!order.receiverSignatureData || !order.overseerSignatureData || !signatureData)) {
            alert("Cannot confirm: All three signatures (አስረካቢ, ተረካቢ, አረጋጋጭ) must be signed and captured first.");
            return;
        }

        try {
            const userDoc = await getDoc(doc(db!, 'users', user.uid));
            const userData = userDoc.data();
            const userRole = userData?.userRole || '';
            const department = userData?.department || '';

            // Extract the normalized department prefix from the userRole
            // e.g. 'computer_science_teacher' → 'computer_science'
            // e.g. 'computer_science_head' → 'computer_science'
            const getDeptPrefix = (role: string) => {
                if (role.endsWith('_teacher')) return role.replace('_teacher', '');
                if (role.endsWith('_head')) return role.replace('_head', '');
                if (role.endsWith('_employee')) return role.replace('_employee', '');
                if (role.endsWith('_leader')) return role.replace('_leader', '');
                // Fallback: normalize the department label
                return department.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            };

            const isTeacherOrAcademic = userRole.includes('teacher') || userRole.includes('academic_staff') || userRole.includes('_head');

            let status = 'completed';
            let currentApproverRole = '';
            let currentApproverId = '';

            if (isTeacherOrAcademic) {
                const deptPrefix = getDeptPrefix(userRole);
                const headRole = deptPrefix ? `${deptPrefix}_head` : 'department_head';

                // Find the department head by matching userRole AND subRole
                const headQuery = query(collection(db!, 'users'), where('userRole', '==', headRole));
                const headSnap = await getDocs(headQuery);

                if (!headSnap.empty) {
                    currentApproverId = headSnap.docs[0].id;
                    currentApproverRole = headRole;
                    status = 'pending_department_leader';
                } else {
                    // No dept head found, skip to academic coordinator
                    const acQuery = query(collection(db!, 'users'), where('userRole', '==', 'academic_coordinator'));
                    const acSnap = await getDocs(acQuery);
                    currentApproverRole = 'academic_coordinator';
                    currentApproverId = acSnap.empty ? '' : acSnap.docs[0].id;
                    status = 'approved_by_head';
                }
            } else {
                const deptPrefix = getDeptPrefix(userRole);
                const leaderRole = deptPrefix ? `${deptPrefix}_leader` : 'team_leader';
                const leaderQuery = query(collection(db!, 'users'), where('userRole', '==', leaderRole));
                const leaderSnap = await getDocs(leaderQuery);

                if (!leaderSnap.empty) {
                    currentApproverId = leaderSnap.docs[0].id;
                    currentApproverRole = leaderRole;
                    status = 'pending_department_leader';
                } else {
                    // No team leader found, try managing director
                    const mdQuery = query(collection(db!, 'users'), where('userRole', 'in', ['managing_director_leader', 'managing_director']));
                    const mdSnap = await getDocs(mdQuery);
                    currentApproverRole = 'managing_director';
                    currentApproverId = mdSnap.empty ? '' : mdSnap.docs[0].id;
                    status = 'pending_managing_director';
                }
            }

            await updateDocWithAudit(doc(db!, 'Transfer_Orders', orderId), {
                status: status,
                currentApproverRole: currentApproverRole,
                currentApproverId: currentApproverId,
                delivererDepartment: department,
                completedAt: serverTimestamp(),
                delivererSignatureData: signatureData
            });

            // Navigate to the new handover receipt page
            router.push(`/workspace/handover-receipt/${orderId}`);
        } catch (e) {
            console.error('Error acknowledging order:', e);
            throw e;
        }
    };

    const handleDismissRejection = async (orderId: string) => {
        if (!db) return;
        try {
            await updateDocWithAudit(doc(db!, 'Transfer_Orders', orderId), {
                status: 'rejected_acknowledged'
            });
        } catch (e) {
            console.error('Error dismissing rejection:', e);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) return null;
    if (orders.length === 0) return null;

    const blankValue: React.CSSProperties = {
        borderBottom: '1.5px dashed #000', minHeight: '22px', padding: '0 4px',
        fontFamily: "'Times New Roman', serif", fontSize: '14px', fontWeight: 'bold',
        display: 'inline-block', minWidth: '80px',
    };

    return (
        <div className="space-y-6">
            {/* Section header */}
            {orders.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 flex items-center gap-4 print:hidden">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
                        <FiFileText className="text-xl" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-slate-900">{t('pending_transfer_orders') || 'Pending Transfer Orders'}</h2>
                        <p className="text-sm text-slate-600">Review and acknowledge transfer orders assigned to you.</p>
                    </div>
                    <span className="px-4 py-2 bg-amber-200 text-amber-900 rounded-full text-sm font-bold">{orders.length}</span>
                </motion.div>
            )}

            <AnimatePresence>
                {orders.map((order, idx) => {
                    const isExpanded = expandedOrderId === order.id;

                    return (
                        <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                            {/* Collapsed header */}
                            <button
                                onClick={() => {
                                    setExpandedOrderId(isExpanded ? null : order.id);
                                    setActiveFormPage(1);
                                    setCurrentSignature(null);
                                }}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors print:hidden"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                                        {order.createdByName?.charAt(0)?.toUpperCase() || 'P'}
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold text-slate-900 text-sm">Transfer Order from {order.createdByName}</p>
                                        <p className="text-xs text-slate-500">Ref: {order.refNumber || '—'} • {order.date || '—'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {order.status === 'rejected' ? (
                                        <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-xs font-semibold flex items-center gap-1">
                                            <FiClock className="text-[10px]" /> Rejected
                                        </span>
                                    ) : (
                                        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs font-semibold flex items-center gap-1">
                                            <FiClock className="text-[10px]" /> Pending
                                        </span>
                                    )}
                                    <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                                </div>
                            </button>

                            {/* Expanded content */}
                            {isExpanded && (
                                <div className="border-t border-slate-200">
                                    {order.status === 'rejected' && (
                                        <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                                            <h3 className="text-red-800 font-bold mb-2">Transfer Rejected</h3>
                                            <p className="text-sm text-red-700 mb-4">
                                                <span className="font-semibold">Reason:</span> {order.rejectReason || 'No specific reason provided.'}
                                                {order.rejectedBy && <span className="block mt-1 text-xs opacity-80">Rejected by: {order.rejectedBy.replace(/_/g, ' ')}</span>}
                                            </p>
                                            <button
                                                onClick={() => handleDismissRejection(order.id)}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors"
                                            >
                                                Dismiss Notification
                                            </button>
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 border-b border-slate-200 print:hidden justify-end">
                                        <button onClick={handlePrint}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm">
                                            <Printer className="w-4 h-4" /> Print
                                        </button>
                                    </div>

                                    {/* ===== FORM 1: Transfer Order Letter ===== */}
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
                                                        <span style={{ borderBottom: '1.5px dashed #000', padding: '0 8px', margin: '0 4px', color: '#1d4ed8' }}>
                                                            {order.recipientRole || '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}
                                                        </span>
                                                        መደብ ወደ
                                                        <span style={{ borderBottom: '1.5px dashed #000', padding: '0 8px', margin: '0 4px' }}>
                                                            {order.newPosition || '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}
                                                        </span>
                                                        ስራ መደብ የተዛወሩ /የለቀቁ ስለሆነ በእጅዎ የሚገኘውን ንብረት ለአቶ/ወ/ሮ/ወ/ሪት
                                                        <span style={{ borderBottom: '1.5px dashed #000', padding: '0 8px', margin: '0 4px' }}>
                                                            {order.itemReceiverName || '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}
                                                        </span>
                                                        በአቶ/ወ/ሮ/ወ/ሪት
                                                        <span style={{ borderBottom: '1.5px dashed #000', padding: '0 8px', margin: '0 4px' }}>
                                                            {order.overseerName || '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}
                                                        </span>
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

                                    {/* ===== FORM 2: Handover Receipt Form ===== */}
                                    <div className={`w-full overflow-x-auto bg-slate-100 print:bg-white custom-scrollbar print:border-t-0 print:mt-0 ${activeFormPage !== 2 ? 'hidden print:block' : 'border-t border-slate-200 mt-8'}`}>
                                        <div className="flex justify-center py-8 px-4 min-w-[210mm] print:py-0 print:px-0">
                                            <HandoverReceiptForm
                                                recipientName={order.recipientName}
                                                itemReceiverName={order.itemReceiverName}
                                                overseerName={order.overseerName}
                                                recipientRole={order.recipientRole}
                                                items={order.items || []}
                                                delivererSigned={order.status === 'completed' || order.status === 'pending_receipt' || order.completedAt != null}
                                                delivererSignatureDate={order.completedAt}
                                                delivererSignatureData={order.delivererSignatureData}
                                                receiverSigned={!!order.receiverAcknowledged}
                                                receiverSignatureDate={order.receiverAcknowledgedAt}
                                                receiverSignatureData={order.receiverSignatureData}
                                                overseerSigned={!!order.overseerAcknowledged}
                                                overseerSignatureDate={order.overseerAcknowledgedAt}
                                                overseerSignatureData={order.overseerSignatureData}
                                                interactiveRole={
                                                    order.status !== 'completed'
                                                        ? (user?.uid === order.itemReceiverId && !order.receiverAcknowledged)
                                                            ? 'receiver'
                                                            : (user?.uid === order.recipientId && order.receiverAcknowledged && order.overseerAcknowledged)
                                                                ? 'deliverer'
                                                                : undefined
                                                        : undefined
                                                }
                                                onSignatureChange={setCurrentSignature}
                                            />
                                        </div>
                                    </div>

                                    {/* Inline Action Area */}
                                    {order.status !== 'completed' && order.status !== 'rejected' && (
                                        <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col items-center justify-center print:hidden">
                                            {/* Case 1: Current user is RECEIVER and hasn't signed yet */}
                                            {user?.uid === order.itemReceiverId && !order.receiverAcknowledged ? (
                                                !currentSignature ? (
                                                    <div className="flex flex-col items-center gap-2 text-blue-600 animate-pulse">
                                                        <span className="text-xl">✍️</span>
                                                        <p className="text-sm font-semibold">Please sign in the ተረካቢ (Receiver) box above to acknowledge receipt...</p>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={async () => {
                                                            if (!db || !user) return;
                                                            try {
                                                                await updateDocWithAudit(doc(db!, 'Transfer_Orders', order.id), {
                                                                    receiverAcknowledged: true,
                                                                    receiverAcknowledgedAt: serverTimestamp(),
                                                                    receiverSignatureData: currentSignature
                                                                });
                                                                setCurrentSignature(null);
                                                            } catch (e) {
                                                                console.error('Error signing as receiver:', e);
                                                            }
                                                        }}
                                                        className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-sm active:scale-95"
                                                    >
                                                        <CheckCircle className="w-5 h-5" /> Confirm Receipt & Sign
                                                    </button>
                                                )
                                            ) : user?.uid === order.recipientId ? (
                                                /* Case 2: Current user is DELIVERER */
                                                !(order.receiverAcknowledged && order.overseerAcknowledged) ? (
                                                    <div className="flex flex-col items-center gap-2 text-amber-600">
                                                        <FiClock className="text-xl" />
                                                        <p className="text-sm font-semibold text-center">
                                                            Waiting for the Receiver ({order.itemReceiverName}) and Overseer ({order.overseerName}) to sign first.
                                                        </p>
                                                    </div>
                                                ) : !currentSignature ? (
                                                    <div className="flex flex-col items-center gap-2 text-slate-500 animate-pulse">
                                                        <span className="text-xl">✍️</span>
                                                        <p className="text-sm font-semibold">Please sign in the አስረካቢ (Deliverer) box above...</p>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={async () => await handleAcknowledge(order.id, currentSignature)}
                                                        className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-sm active:scale-95"
                                                    >
                                                        <FiCheck className="text-xl" /> Confirm & Approve Handover
                                                    </button>
                                                )
                                            ) : (
                                                /* Case 3: User is neither deliverer nor receiver (shouldn't happen normally) */
                                                <div className="flex flex-col items-center gap-2 text-slate-400">
                                                    <FiClock className="text-xl" />
                                                    <p className="text-sm font-semibold text-center">This order is awaiting signatures.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

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
                                                className={`w-10 h-10 flex items-center justify-center font-bold text-sm transition-colors border ${
                                                    activeFormPage === 1
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
                                                className={`w-10 h-10 flex items-center justify-center font-bold text-sm transition-colors border ${
                                                    activeFormPage === 2
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
