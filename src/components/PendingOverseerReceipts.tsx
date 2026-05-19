'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/lib/firebase';
import {
    collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { FiInbox, FiClock, FiCheck } from 'react-icons/fi';
import { Loader2, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import HandoverReceiptForm from '@/components/HandoverReceiptForm';
import Image from 'next/image';

interface TransferOrder {
    id: string;
    recipientId: string;
    recipientName: string;
    recipientEmail: string;
    recipientRole: string;
    newPosition: string;
    itemReceiverName: string;
    itemReceiverId: string;
    overseerName: string;
    overseerId: string;
    refNumber: string;
    date: string;
    ccName: string;
    status: string;
    createdBy: string;
    createdByName: string;
    createdAt: any;
    completedAt?: any;
    receiverAcknowledged?: boolean;
    receiverAcknowledgedAt?: any;
    items?: any[];
    delivererSignatureData?: string;
    receiverSignatureData?: string;
    overseerSignatureData?: string;
    overseerAcknowledged?: boolean;
    overseerAcknowledgedAt?: any;
}

export default function PendingOverseerReceipts() {
    const { user, userRole } = useAuth();
    const { t } = useLanguage();
    const [orders, setOrders] = useState<TransferOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [currentSignature, setCurrentSignature] = useState<string | null>(null);
    const [activeFormPage, setActiveFormPage] = useState(1);

    const blankValue: React.CSSProperties = {
        borderBottom: '1.5px dashed #000', minHeight: '22px', padding: '0 4px',
        fontFamily: "'Times New Roman', serif", fontSize: '14px', fontWeight: 'bold',
        display: 'inline-block', minWidth: '80px',
    };

    useEffect(() => {
        if (!user || !db) { setLoading(false); return; }

        const q = query(
            collection(db!, 'Transfer_Orders'),
            where('status', 'in', ['pending_handover', 'completed'])
        );

        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as TransferOrder))
                .filter(o => !o.overseerAcknowledged)
                .filter(o => 
                    o.overseerId === user.uid || 
                    o.overseerName === user.displayName
                );

            setOrders(data);
            if (data.length === 1) setExpandedOrderId(data[0].id);
            setLoading(false);
            setCurrentSignature(null);
        }, () => setLoading(false));

        return () => unsub();
    }, [user]);

    const handleAcknowledge = async (orderId: string, signatureData: string) => {
        if (!db) return;
        try {
            await updateDoc(doc(db!, 'Transfer_Orders', orderId), {
                overseerAcknowledged: true,
                overseerAcknowledgedAt: serverTimestamp(),
                overseerSignatureData: signatureData
            });
            setOrders(prev => prev.filter(o => o.id !== orderId));
            setCurrentSignature(null);
        } catch (e) {
            console.error('Error signing as overseer:', e);
            throw e;
        }
    };

    if (loading) return null;
    if (orders.length === 0) return null;

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-2 print:hidden"
            >
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm border border-amber-200">
                    <FiInbox className="text-xl" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Handover Receipts (Awaiting Your Signature)</h2>
                    <p className="text-sm font-medium text-slate-500">You have {orders.length} receipt(s) to verify and sign as አረጋጋጭ.</p>
                </div>
            </motion.div>

            <AnimatePresence>
                {orders.map((order, index) => {
                    const isExpanded = expandedOrderId === order.id;

                    return (
                        <motion.div
                            key={order.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
                        >
                            <button
                                onClick={() => {
                                    setExpandedOrderId(isExpanded ? null : order.id);
                                    setActiveFormPage(1);
                                    setCurrentSignature(null);
                                }}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors print:hidden"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-sm">
                                        {order.recipientName?.charAt(0)?.toUpperCase() || 'H'}
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-slate-900 text-sm">
                                            Handover: {order.recipientName} → {order.itemReceiverName}
                                        </h3>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                                            Ref: {order.refNumber} • {order.date}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-md text-xs font-bold flex items-center gap-1.5">
                                        <FiClock /> Needs Your Signature
                                    </span>
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="border-t border-slate-200">
                                    <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 border-b border-slate-200 print:hidden justify-end">
                                        <button onClick={() => window.print()}
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

                                    {/* ===== FORM 2: Handover Receipt ===== */}
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
                                                interactiveRole={!order.overseerAcknowledged ? "overseer" : undefined}
                                                onSignatureChange={setCurrentSignature}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col items-center justify-center print:hidden">
                                        {!currentSignature ? (
                                            <div className="flex flex-col items-center gap-2 text-slate-500 animate-pulse">
                                                <span className="text-xl">✍️</span>
                                                <p className="text-sm font-semibold">Please sign on the አረጋጋጭ dotted line above...</p>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={async () => await handleAcknowledge(order.id, currentSignature)}
                                                className="flex items-center gap-2 px-8 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all shadow-sm active:scale-95"
                                            >
                                                <FiCheck className="text-xl" /> Confirm & Verify Handover
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
            
            <style jsx global>{`
                @media print {
                    body { background: white !important; padding: 0 !important; margin: 0 !important; }
                    .print\\:hidden { display: none !important; }
                }
            `}</style>
        </div>
    );
}
