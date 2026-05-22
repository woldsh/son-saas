'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/lib/firebase';
import {
    collection, query, where, onSnapshot, getDocs
} from 'firebase/firestore';
import { FiFileText, FiCheckCircle } from 'react-icons/fi';
import { Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
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
}

export default function MaterialTransferReport() {
    const { user } = useAuth();
    const langCtx = useLanguage();
    const t: any = langCtx.t;
    const [orders, setOrders] = useState<TransferOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [activeFormPage, setActiveFormPage] = useState(1);

    useEffect(() => {
        if (!user || !db) { setLoading(false); return; }

        // Fetch completed transfer orders
        const qCompleted = query(
            collection(db, 'Transfer_Orders'),
            where('status', '==', 'completed')
        );
        
        // Also could include orders that are past the handover phase
        // but for now we look for 'completed'
        
        const unsub = onSnapshot(qCompleted, (snap) => {
            const completedOrders = snap.docs.map(d => ({ id: d.id, ...d.data() } as TransferOrder));
            
            // Sort by completedAt descending
            completedOrders.sort((a, b) => {
                const timeA = a.completedAt?.toMillis?.() || 0;
                const timeB = b.completedAt?.toMillis?.() || 0;
                return timeB - timeA;
            });
            
            setOrders(completedOrders);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching completed transfer orders:", err);
            setLoading(false);
        });

        return () => unsub();
    }, [user]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <FiFileText className="text-2xl text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">No Transfer Reports Found</h3>
                <p className="text-sm text-slate-500">There are no finalized material transfers yet.</p>
            </div>
        );
    }

    const blankValue: React.CSSProperties = {
        borderBottom: '1.5px dashed #000', minHeight: '22px', padding: '0 4px',
        fontFamily: "'Times New Roman', serif", fontSize: '14px', fontWeight: 'bold',
        display: 'inline-block', minWidth: '80px',
    };

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 flex items-center gap-4 print:hidden">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
                    <FiFileText className="text-xl" />
                </div>
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-slate-900">{t('material_transfer_report') || 'Material Transfer Report'}</h2>
                    <p className="text-sm text-slate-600">View finalized material transfer formats.</p>
                </div>
                <span className="px-4 py-2 bg-emerald-200 text-emerald-900 rounded-full text-sm font-bold">{orders.length}</span>
            </motion.div>

            <AnimatePresence>
                {orders.map((order, idx) => {
                    const isExpanded = expandedOrderId === order.id;
                    const formattedDate = order.completedAt?.toDate?.().toLocaleDateString() || order.date || '—';

                    return (
                        <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                            {/* Collapsed header */}
                            <button
                                onClick={() => {
                                    setExpandedOrderId(isExpanded ? null : order.id);
                                    setActiveFormPage(1);
                                }}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors print:hidden"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm">
                                        {order.recipientName?.charAt(0)?.toUpperCase() || 'R'}
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold text-slate-900 text-sm">Transfer from {order.recipientName} to {order.itemReceiverName}</p>
                                        <p className="text-xs text-slate-500">Ref: {order.refNumber || '—'} • Completed: {formattedDate}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-semibold flex items-center gap-1">
                                        <FiCheckCircle className="text-[10px]" /> Finalized
                                    </span>
                                    <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                                </div>
                            </button>

                            {/* Expanded content */}
                            {isExpanded && (
                                <div className="border-t border-slate-200">
                                    {/* Action buttons */}
                                    <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 border-b border-slate-200 print:hidden justify-end">
                                        <button onClick={handlePrint}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm">
                                            <Printer className="w-4 h-4" /> Print Report
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
                                                delivererSigned={!!order.completedAt || !!order.delivererSignatureData}
                                                delivererSignatureDate={order.completedAt}
                                                delivererSignatureData={order.delivererSignatureData}
                                                receiverSigned={!!order.receiverAcknowledged}
                                                receiverSignatureDate={order.receiverAcknowledgedAt}
                                                receiverSignatureData={order.receiverSignatureData}
                                                overseerSigned={!!order.overseerAcknowledged}
                                                overseerSignatureDate={order.overseerAcknowledgedAt}
                                                overseerSignatureData={order.overseerSignatureData}
                                                interactiveRole={undefined}
                                                onSignatureChange={() => {}}
                                            />
                                        </div>
                                    </div>

                                    {/* Form Pagination Controls */}
                                    <div className="flex justify-center items-center py-6 bg-white border-t border-slate-200 print:hidden">
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => {
                                                    setActiveFormPage(1);
                                                }}
                                                disabled={activeFormPage === 1}
                                                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                            >
                                                &lt; Back
                                            </button>
                                            
                                            <button
                                                onClick={() => {
                                                    setActiveFormPage(1);
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

            <style jsx global>{`
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
            `}</style>
        </div>
    );
}
