'use client';

import { useState, useEffect } from 'react';
import { Printer, Loader2, Search, UserCheck, CheckCircle, Send } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import {
    collection, query, getDocs, addDoc, serverTimestamp, where, orderBy, onSnapshot, doc, getDoc
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

interface UserResult {
    id: string;
    displayName: string;
    email: string;
    userRole: string;
    department?: string;
}

interface TransferOrder {
    id: string;
    recipientName: string;
    recipientRole: string;
    newPosition: string;
    itemReceiverName: string;
    overseerName: string;
    refNumber: string;
    date: string;
    status: string;
    createdAt: any;
}

export default function MaterialTransferOrderPage() {
    const { user } = useAuth();

    // Form fields
    const [refNumber, setRefNumber] = useState('');
    const [date, setDate] = useState('');
    const [recipient, setRecipient] = useState('');
    const [recipientId, setRecipientId] = useState('');
    const [recipientEmail, setRecipientEmail] = useState('');
    const [fromPosition, setFromPosition] = useState('');
    const [toPosition, setToPosition] = useState('');
    const [transfereeName, setTransfereeName] = useState('');
    const [transfereeId, setTransfereeId] = useState('');
    const [receiverName, setReceiverName] = useState('');
    const [receiverId, setReceiverId] = useState('');
    const [ccName, setCcName] = useState('');

    // Search states
    const [recipientResults, setRecipientResults] = useState<UserResult[]>([]);
    const [transfereeResults, setTransfereeResults] = useState<UserResult[]>([]);
    const [receiverResults, setReceiverResults] = useState<UserResult[]>([]);
    const [showRecipientResults, setShowRecipientResults] = useState(false);
    const [showTransfereeResults, setShowTransfereeResults] = useState(false);
    const [showReceiverResults, setShowReceiverResults] = useState(false);
    const [isSearchingRecipient, setIsSearchingRecipient] = useState(false);
    const [isSearchingTransferee, setIsSearchingTransferee] = useState(false);
    const [isSearchingReceiver, setIsSearchingReceiver] = useState(false);

    // Submit & history
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [orders, setOrders] = useState<TransferOrder[]>([]);
    const [currentUserName, setCurrentUserName] = useState('');

    // Fetch current user name
    useEffect(() => {
        if (!user || !db) return;
        const fetchName = async () => {
            const userDoc = await getDoc(doc(db!, 'users', user.uid));
            if (userDoc.exists()) {
                setCurrentUserName(userDoc.data().displayName || '');
            }
        };
        fetchName();
    }, [user]);

    // Listen for existing orders
    useEffect(() => {
        if (!user || !db) return;
        const q = query(
            collection(db!, 'Transfer_Orders'),
            where('createdBy', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
        const unsub = onSnapshot(q, (snap) => {
            setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as TransferOrder)));
        });
        return () => unsub();
    }, [user]);

    // Generic user search function
    const searchUsers = async (term: string, setter: (r: UserResult[]) => void, setSearching: (b: boolean) => void) => {
        if (!term.trim() || term.length < 2 || !db) {
            setter([]);
            return;
        }
        setSearching(true);
        try {
            const snap = await getDocs(collection(db!, 'users'));
            const filtered = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as UserResult))
                .filter((u) =>
                    u.displayName?.toLowerCase().includes(term.toLowerCase()) ||
                    u.email?.toLowerCase().includes(term.toLowerCase())
                )
                .slice(0, 6);
            setter(filtered);
        } catch (e) {
            console.error('Search error:', e);
        } finally {
            setSearching(false);
        }
    };

    // Debounced search for recipient (ለ)
    useEffect(() => {
        const t = setTimeout(() => searchUsers(recipient, setRecipientResults, setIsSearchingRecipient), 300);
        return () => clearTimeout(t);
    }, [recipient]);

    // Debounced search for transferee (ለአቶ/ወ/ሮ/ወ/ሪት)
    useEffect(() => {
        const t = setTimeout(() => searchUsers(transfereeName, setTransfereeResults, setIsSearchingTransferee), 300);
        return () => clearTimeout(t);
    }, [transfereeName]);

    // Debounced search for receiver (በአቶ/ወ/ሮ/ወ/ሪት)
    useEffect(() => {
        const t = setTimeout(() => searchUsers(receiverName, setReceiverResults, setIsSearchingReceiver), 300);
        return () => clearTimeout(t);
    }, [receiverName]);

    const formatRole = (role: string) => {
        return role?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '';
    };

    const handleSelectRecipient = (u: UserResult) => {
        setRecipient(u.displayName);
        setRecipientId(u.id);
        setRecipientEmail(u.email);
        setFromPosition(formatRole(u.userRole) + (u.department ? ` - ${formatRole(u.department)}` : ''));
        setShowRecipientResults(false);
    };

    const handleSelectTransferee = (u: UserResult) => {
        setTransfereeName(u.displayName);
        setTransfereeId(u.id);
        setShowTransfereeResults(false);
    };

    const handleSelectReceiver = (u: UserResult) => {
        setReceiverName(u.displayName);
        setReceiverId(u.id);
        setShowReceiverResults(false);
    };

    const handleApproveAndSend = async () => {
        if (!user || !db || !recipientId || !recipient) return;
        setSubmitting(true);
        try {
            // Fetch materials currently held by the recipient
            const userReportQuery = query(
                collection(db, 'User-Report'),
                where('requesterId', '==', recipientId),
                where('status', '==', 'accepted')
            );
            const userReportSnap = await getDocs(userReportQuery);

            // Build items with price/model from the materials collection
            const items = await Promise.all(userReportSnap.docs.map(async (reportDoc) => {
                const data = reportDoc.data();
                let unitPrice = 0;
                let model = data.model || '';
                let serialNumber = data.serialNumber || '';

                // Look up price and model from the materials collection
                if (data.materialId) {
                    try {
                        const matDoc = await getDoc(doc(db!, 'materials', data.materialId));
                        if (matDoc.exists()) {
                            const matData = matDoc.data();
                            const birr = parseFloat(matData.unitPriceBirr) || 0;
                            const cents = parseFloat(matData.unitPriceCents) || 0;
                            unitPrice = birr + (cents / 100);
                            model = model || matData.model || '';
                            serialNumber = serialNumber || matData.serialNumber || '';
                        }
                    } catch (e) {
                        console.error('Error fetching material details:', e);
                    }
                }

                const qty = Number(data.quantity) || 1;
                return {
                    id: reportDoc.id,
                    name: data.materialName || '',
                    model,
                    quantity: qty,
                    unitPrice,
                    totalPrice: qty * unitPrice,
                    serialNumber,
                    materialType: data.materialType || ''
                };
            }));

            await addDoc(collection(db!, 'Transfer_Orders'), {
                recipientId,
                recipientName: recipient,
                recipientEmail,
                recipientRole: fromPosition,
                newPosition: toPosition,
                itemReceiverName: transfereeName,
                itemReceiverId: transfereeId || null,
                overseerName: receiverName,
                overseerId: receiverId || null,
                refNumber,
                date,
                ccName,
                items, // Attached the fetched materials here
                status: 'pending_handover',
                createdBy: user.uid,
                createdByName: currentUserName || user.displayName || 'PTL',
                createdAt: serverTimestamp(),
            });
            setSubmitted(true);
            // Reset form
            setRefNumber(''); setDate(''); setRecipient(''); setRecipientId(''); setRecipientEmail('');
            setFromPosition(''); setToPosition(''); setTransfereeName(''); setTransfereeId('');
            setReceiverName(''); setReceiverId(''); setCcName('');
            setTimeout(() => setSubmitted(false), 4000);
        } catch (e) {
            console.error('Error saving transfer order:', e);
        } finally {
            setSubmitting(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    /* shared style for the fill-in-the-blank inputs */
    const blankInput: React.CSSProperties = {
        borderBottom: '1.5px dashed #000',
        height: '22px',
        padding: '0 2px',
        outline: 'none',
        background: 'transparent',
        fontFamily: "'Times New Roman', serif",
        fontSize: '14px',
        fontWeight: 'bold',
    };

    // Reusable search dropdown component
    const SearchDropdown = ({
        results, show, isSearching, onSelect, onClose
    }: {
        results: UserResult[], show: boolean, isSearching: boolean,
        onSelect: (u: UserResult) => void, onClose: () => void
    }) => (
        <AnimatePresence>
            {show && (results.length > 0 || isSearching) && (
                <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute z-[80] left-0 min-w-[350px] max-w-[450px] mt-1 bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden print:hidden"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                >
                    {isSearching ? (
                        <div className="p-4 text-center">
                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin mx-auto" />
                        </div>
                    ) : (
                        <div className="max-h-[200px] overflow-y-auto">
                            {results.map((u) => (
                                <button
                                    key={u.id}
                                    onMouseDown={(e) => { e.preventDefault(); onSelect(u); onClose(); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors text-left border-b border-slate-50 last:border-0"
                                >
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                                        {u.displayName?.charAt(0)?.toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-900 truncate">{u.displayName}</p>
                                        <p className="text-[11px] text-slate-500 truncate">{formatRole(u.userRole)} • {u.email}</p>
                                    </div>
                                    <UserCheck className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                </button>
                            ))}
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4 overflow-y-auto print:bg-white print:py-0 print:px-0">
            {/* Success Banner */}
            <AnimatePresence>
                {submitted && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-4 flex items-center gap-3 shadow-lg print:hidden"
                    >
                        <CheckCircle className="w-6 h-6 text-emerald-600" />
                        <div>
                            <p className="font-bold text-emerald-900">Transfer Order Sent!</p>
                            <p className="text-sm text-emerald-700">The user has been notified in their Return Goods page.</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ============ A4 PAPER ============ */}
            <div
                id="transfer-order-print-area"
                style={{
                    width: '210mm',
                    minHeight: '297mm',
                    padding: '25mm 25mm 25mm 25mm',
                    fontFamily: "'Times New Roman', serif",
                    color: '#000',
                    backgroundColor: '#fff',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    border: '1px solid #e2e8f0',
                }}
                className="print:shadow-none print:border-none"
            >
                {/* ===== HEADER ===== */}
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

                {/* ===== REFERENCE NUMBER & DATE ===== */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: '30px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>ቁጥር: ደ/ማ/ዩ/ቡ/ካ</span>
                        <input type="text" value={refNumber} onChange={(e) => setRefNumber(e.target.value)} style={{ ...blankInput, width: '160px' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>ቀን:</span>
                        <input type="text" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...blankInput, width: '160px' }} />
                    </div>
                </div>

                {/* ===== RECIPIENT (ለ) with SEARCH ===== */}
                <div style={{ position: 'relative', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>ለ</span>
                        <input
                            type="text"
                            value={recipient}
                            onChange={(e) => { setRecipient(e.target.value); setRecipientId(''); setShowRecipientResults(true); }}
                            onFocus={() => setShowRecipientResults(true)}
                            onBlur={() => setTimeout(() => setShowRecipientResults(false), 200)}
                            style={{ ...blankInput, width: '300px' }}
                            placeholder="Search user..."
                        />
                        {recipientId && <span style={{ color: 'green', fontSize: '14px', marginLeft: '4px' }}>✓</span>}
                    </div>
                    <SearchDropdown
                        results={recipientResults} show={showRecipientResults} isSearching={isSearchingRecipient}
                        onSelect={handleSelectRecipient} onClose={() => setShowRecipientResults(false)}
                    />
                </div>

                {/* ===== SUB-REFERENCE ===== */}
                <div style={{ marginBottom: '20px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', textDecoration: 'underline' }}>ደ/ማ/ዩ፡</span>
                </div>

                {/* ===== SUBJECT ===== */}
                <div style={{ textAlign: 'center', marginBottom: '5px', marginTop: '10px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                        ጉዳዩ፡ <span style={{ textDecoration: 'underline' }}>ንብረት እንዲያስረክቡ ስለማዘዝ፡</span>
                    </span>
                </div>
                <div style={{ borderBottom: '1px solid #000', marginBottom: '30px' }}></div>

                {/* ===== BODY PARAGRAPH ===== */}
                <div style={{ fontSize: '14px', fontWeight: 'bold', lineHeight: '2.8' }}>
                    {/* Line 1 — from position auto-filled */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '4px' }}>
                        <span>እርስዎ ከነበሩበት</span>
                        <input
                            type="text"
                            value={fromPosition}
                            onChange={(e) => setFromPosition(e.target.value)}
                            style={{ ...blankInput, flex: 1, minWidth: '150px', color: recipientId ? '#1d4ed8' : '#000' }}
                            placeholder="Auto-fills on user select..."
                            readOnly={!!recipientId}
                        />
                        <span>መደብ ወደ</span>
                        <input
                            type="text"
                            value={toPosition}
                            onChange={(e) => setToPosition(e.target.value)}
                            style={{ ...blankInput, width: '200px' }}
                        />
                    </div>

                    {/* Line 2 — person who takes items (searchable) */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '4px', position: 'relative' }}>
                        <input type="text" style={{ ...blankInput, width: '60px' }} />
                        <span>ስራ መደብ የተዛወሩ /የለቀቁ ስለሆነ በእጅዎ የሚገኘውን ንብረት ለአቶ/ወ/ሮ/ወ/ሪት</span>
                        <div style={{ position: 'relative', flex: 1, minWidth: '100px' }}>
                            <input
                                type="text"
                                value={transfereeName}
                                onChange={(e) => { setTransfereeName(e.target.value); setTransfereeId(''); setShowTransfereeResults(true); }}
                                onFocus={() => setShowTransfereeResults(true)}
                                onBlur={() => setTimeout(() => setShowTransfereeResults(false), 200)}
                                style={{ ...blankInput, width: '100%' }}
                                placeholder="Search..."
                            />
                            {transfereeId && <span style={{ position: 'absolute', right: '4px', top: '2px', color: 'green', fontSize: '14px' }}>✓</span>}
                            <SearchDropdown
                                results={transfereeResults} show={showTransfereeResults} isSearching={isSearchingTransferee}
                                onSelect={handleSelectTransferee} onClose={() => setShowTransfereeResults(false)}
                            />
                        </div>
                    </div>

                    {/* Line 3 — overseer (searchable) */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '4px', position: 'relative' }}>
                        <input type="text" style={{ ...blankInput, width: '200px' }} />
                        <span>በአቶ/ወ/ሮ/ወ/ሪት</span>
                        <div style={{ position: 'relative', flex: 1, minWidth: '150px' }}>
                            <input
                                type="text"
                                value={receiverName}
                                onChange={(e) => { setReceiverName(e.target.value); setReceiverId(''); setShowReceiverResults(true); }}
                                onFocus={() => setShowReceiverResults(true)}
                                onBlur={() => setTimeout(() => setShowReceiverResults(false), 200)}
                                style={{ ...blankInput, width: '100%' }}
                                placeholder="Search..."
                            />
                            {receiverId && <span style={{ position: 'absolute', right: '4px', top: '2px', color: 'green', fontSize: '14px' }}>✓</span>}
                            <SearchDropdown
                                results={receiverResults} show={showReceiverResults} isSearching={isSearchingReceiver}
                                onSelect={handleSelectReceiver} onClose={() => setShowReceiverResults(false)}
                            />
                        </div>
                        <span>አረካካቢነት</span>
                    </div>

                    {/* Line 4 */}
                    <p style={{ margin: '8px 0 0 0' }}>እንዲያስረክቡ እናሳስባለን፡፡</p>
                </div>

                {/* ===== WITH REGARDS ===== */}
                <div style={{ textAlign: 'center', margin: '40px 0' }}>
                    <p style={{ fontSize: '15px', fontWeight: 'bold', margin: 0 }}>« ከሠላมታ ጋር »</p>
                </div>

                {/* ===== CARBON COPY (ግልባጭ) ===== */}
                <div style={{ marginTop: 'auto', paddingTop: '40px' }}>
                    <p style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '14px', textDecoration: 'underline', textUnderlineOffset: '4px' }}>ግልባጭ:</p>
                    <div style={{ marginLeft: '24px', fontSize: '14px', fontWeight: 'bold', lineHeight: '2.4' }}>
                        <p style={{ margin: 0 }}>፩ ለንብረት ክፍል</p>
                        <p style={{ margin: 0 }}>፪ ለንብረት አስረካቢ</p>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                            <span>፫ ለአቶ/ወ/ሮ/ወ/ሪት</span>
                            <input type="text" value={ccName} onChange={(e) => setCcName(e.target.value)} style={{ ...blankInput, width: '250px' }} />
                        </div>
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '20px', marginLeft: '48px', textDecoration: 'underline' }}>ደ/ማ/ዩ:</p>
                </div>
            </div>

            {/* Action Buttons (Below Form) */}
            <div className="w-[210mm] mt-6 print:hidden flex justify-end gap-3 mb-4">
                <button
                    onClick={handleApproveAndSend}
                    disabled={submitting || !recipientId || !recipient}
                    className={`flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 ${submitting || !recipientId ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                >
                    {submitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    {submitting ? 'Sending...' : 'Approve & Send'}
                </button>
                <button
                    onClick={handlePrint}
                    className="flex items-center justify-center gap-2 px-8 py-3 bg-white border border-slate-300 rounded-xl text-slate-800 hover:bg-slate-50 transition-all shadow-md font-bold active:scale-95"
                >
                    <Printer size={20} />
                    Print
                </button>
            </div>

            {/* ============ ORDER HISTORY (below form, hidden on print) ============ */}
            {orders.length > 0 && (
                <div className="w-full max-w-4xl mt-10 print:hidden">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">📋 Past Transfer Orders</h2>
                    <div className="space-y-3">
                        {orders.map((order) => (
                            <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                                <div>
                                    <p className="font-bold text-slate-900">{order.recipientName}</p>
                                    <p className="text-sm text-slate-500">{order.recipientRole} → {order.newPosition || 'N/A'}</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Ref: {order.refNumber || '—'} • {order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : 'Recently'}
                                    </p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${order.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}>
                                    {order.status === 'completed' ? 'Completed' : 'Pending'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ============ PRINT STYLES ============ */}
            <style jsx global>{`
                @media print {
                    body { background: white !important; padding: 0 !important; margin: 0 !important; }
                    body * { visibility: hidden; }
                    #transfer-order-print-area, #transfer-order-print-area * { visibility: visible; }
                    #transfer-order-print-area {
                        position: absolute; left: 0; top: 0;
                        width: 100% !important; height: 100% !important;
                        padding: 25mm 25mm 25mm 25mm !important;
                        box-shadow: none !important; border: none !important;
                    }
                    input { border: none !important; border-bottom: 1.5px dashed #000 !important; background: transparent !important; }
                    input::placeholder { color: transparent !important; }
                    @page { size: A4; margin: 0; }
                }
            `}</style>
        </div>
    );
}
