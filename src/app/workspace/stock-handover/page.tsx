'use client';
import { addDocWithAudit, updateDocWithAudit } from '@/utils/auditTrail';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, getDocs,  serverTimestamp, onSnapshot, where, doc} from 'firebase/firestore';
import { FiPrinter, FiSend, FiUser, FiCheckCircle, FiClock, FiUsers, FiClipboard, FiXCircle } from 'react-icons/fi';
import { Loader2, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Material {
    id: string;
    materialName: string;
    materialCode: string;
    materialType: string;
    quantity: number;
    unit: string;
    updatedAt?: any;
    createdAt?: any;
}

interface HandoverItemState {
    physicalCount: number | '';
    stockCardBalance: number;
    discrepancy: number | '';
    condition: string;
    lastDateOfMovement: string;
}

export default function StockHandoverPage() {
    const { user, userRole } = useAuth();
    const [materials, setMaterials] = useState<Material[]>([]);
    const [itemStates, setItemStates] = useState<Record<string, HandoverItemState>>({});

    // Digital Workflow Fields
    const [reason, setReason] = useState('');

    // Paper Form Fields
    const [publicBody, setPublicBody] = useState('');
    const [storesNo, setStoresNo] = useState('');
    const [stockClassification, setStockClassification] = useState('');
    const [handoverDate, setHandoverDate] = useState(new Date().toISOString().split('T')[0]);

    // Receiver search
    const [receiverName, setReceiverName] = useState('');
    const [receiverEmail, setReceiverEmail] = useState('');
    const [receiverId, setReceiverId] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [myHandovers, setMyHandovers] = useState<any[]>([]);
    const [advancingId, setAdvancingId] = useState<string | null>(null);

    const NEXT_STATUS: Record<string, string> = {
        witness_assigned: 'handover_in_progress',
        handover_in_progress: 'pending_signatures',
        pending_signatures: 'pending_final_approval',
    };

    const NEXT_LABEL: Record<string, { en: string; am: string }> = {
        witness_assigned: { en: 'Start Handover Process', am: 'ርክክብ ጀምር' },
        handover_in_progress: { en: 'Confirm Signatures', am: 'ፊርማ አረጋግጥ' },
        pending_signatures: { en: 'Send for Final Approval', am: 'ለመጨረሻ ማጽደቅ ላክ' },
    };

    const advanceStatus = async (handoverId: string, currentStatus: string) => {
        const nextStatus = NEXT_STATUS[currentStatus];
        if (!nextStatus || !user) return;
        setAdvancingId(handoverId);
        try {
            const ref = doc(db!, 'Stock_Handovers', handoverId);
            await updateDocWithAudit(ref, { status: nextStatus });
        } catch (err) {
            console.error('Error advancing status:', err);
        } finally {
            setAdvancingId(null);
        }
    };

    useEffect(() => {
        if (!db || !userRole) return;

        const fetchMaterials = async () => {
            try {
                const typeFilter = userRole.includes('consumable') ? 'consumable' : 'fixed_asset';

                // Set default stock classification if empty
                if (!stockClassification) {
                    setStockClassification(typeFilter === 'consumable' ? 'Consumables' : 'Fixed Assets');
                }

                const materialsRef = collection(db!, 'materials');
                const snapshot = await getDocs(materialsRef);

                const materialList: Material[] = [];
                snapshot.docs.forEach(doc => {
                    const d = doc.data();
                    if (d.items && Array.isArray(d.items) && (d.formType === 'receipt_for_articles' || (d.items.length > 0 && !d.materialName))) {
                        d.items.forEach((item: any, idx: number) => {
                            if (item.description && typeof item.description === 'string' && item.description.trim()) {
                                materialList.push({
                                    id: `${doc.id}_${idx}`,
                                    materialName: item.description.trim(),
                                    materialCode: item.itemNo || d.receiptNo || '',
                                    materialType: d.materialType || 'consumable',
                                    quantity: Number(item.quantity) || 0,
                                    unit: item.unit || 'pcs',
                                    createdAt: d.createdAt,
                                    updatedAt: d.updatedAt || d.createdAt,
                                });
                            }
                        });
                    } else if (d.materialName) {
                        materialList.push({ id: doc.id, ...d } as Material);
                    }
                });

                // Filter by store keeper type and group by name
                const aggregatedMap = new Map<string, Material>();
                materialList.filter(m => m.materialType === typeFilter).forEach(item => {
                    const key = (item.materialName || '').trim().toLowerCase();
                    if (!key) return;
                    if (aggregatedMap.has(key)) {
                        const existing = aggregatedMap.get(key)!;
                        existing.quantity += item.quantity;
                        if (item.updatedAt > existing.updatedAt) {
                            existing.updatedAt = item.updatedAt;
                        }
                    } else {
                        aggregatedMap.set(key, { ...item });
                    }
                });

                const aggregatedList = Array.from(aggregatedMap.values()).sort((a, b) => a.materialName.localeCompare(b.materialName));
                setMaterials(aggregatedList);

                // Initialize item states
                const initialStates: Record<string, HandoverItemState> = {};
                aggregatedList.forEach(m => {
                    initialStates[m.id] = {
                        physicalCount: m.quantity, // Default to matching system quantity
                        stockCardBalance: m.quantity,
                        discrepancy: 0,
                        condition: 'New',
                        lastDateOfMovement: m.updatedAt ? new Date(m.updatedAt.seconds ? m.updatedAt.seconds * 1000 : m.updatedAt).toISOString().split('T')[0] : handoverDate
                    };
                });
                setItemStates(initialStates);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching materials:", error);
                setLoading(false);
            }
        };

        fetchMaterials();
    }, [userRole]);

    // Track my submitted handovers
    useEffect(() => {
        if (!db || !user) return;
        const q = query(collection(db!, 'Stock_Handovers'), where('handoverKeeperId', '==', user.uid));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a: any, b: any) => {
                const da = a.createdAt?.toDate?.() || new Date(0);
                const db2 = b.createdAt?.toDate?.() || new Date(0);
                return db2.getTime() - da.getTime();
            });
            setMyHandovers(list);
        });
        return () => unsub();
    }, [user]);

    // Handle User Search
    useEffect(() => {
        const searchUsers = async () => {
            if (!receiverName.trim() || receiverName.length < 2) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                const usersRef = collection(db!, 'users');
                const q = query(usersRef);
                const snapshot = await getDocs(q);

                const filtered = snapshot.docs
                    .map(uDoc => ({ id: uDoc.id, ...uDoc.data() }))
                    .filter((u: any) =>
                        (u.id !== user?.uid && u.email !== user?.email) && (
                            u.displayName?.toLowerCase().includes(receiverName.toLowerCase()) ||
                            u.email?.toLowerCase().includes(receiverName.toLowerCase())
                        )
                    )
                    .slice(0, 5);

                setSearchResults(filtered);
            } catch (error) {
                console.error("Error searching users:", error);
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(searchUsers, 300);
        return () => clearTimeout(timeoutId);
    }, [receiverName]);

    const handleSelectUser = (u: any) => {
        setReceiverName(u.displayName || '');
        setReceiverEmail(u.email || '');
        setReceiverId(u.id || '');
        setShowResults(false);
    };

    const handleItemStateChange = (id: string, field: keyof HandoverItemState, value: string | number) => {
        setItemStates(prev => {
            const newState = { ...prev[id], [field]: value };
            if (field === 'physicalCount') {
                if (value === '') {
                    newState.discrepancy = '';
                } else {
                    newState.discrepancy = (value as number) - newState.stockCardBalance;
                }
            }
            return { ...prev, [id]: newState };
        });
    };

    const handleSubmit = async () => {
        if (!user || !db || !receiverName || !reason) return;
        setSubmitting(true);

        try {
            const items = materials.map(m => ({
                materialId: m.id,
                materialName: m.materialName,
                materialCode: m.materialCode,
                unit: m.unit,
                ...itemStates[m.id]
            }));

            await addDocWithAudit(collection(db!, 'Stock_Handovers'), {
                handoverKeeperId: user.uid,
                handoverKeeperName: user.displayName || 'Unknown',
                handoverKeeperEmail: user.email,
                receivingKeeperId: receiverId,
                receivingKeeperName: receiverName.trim(),
                receivingKeeperEmail: receiverEmail.trim(),
                reason: reason,
                publicBody: publicBody,
                storesNo: storesNo,
                stockClassification: stockClassification,
                handoverDate: handoverDate,
                items: items,
                status: 'pending_team_leader_review', // Changed to Team Leader as per Step 2
                createdAt: serverTimestamp(),
            });

            setSubmitted(true);
            setTimeout(() => setSubmitted(false), 5000);

            // Reset workflow fields
            setReceiverName('');
            setReceiverEmail('');
            setReceiverId('');
            setReason('');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            console.error('Error submitting handover:', error);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 min-h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
                    <p className="text-slate-400 text-sm font-bold tracking-widest uppercase">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#eaeff5] py-8 px-4 sm:px-6 lg:px-8 font-serif flex flex-col items-center">

            {/* DIGITAL WORKFLOW CONTROLS - Hidden when printing */}
            <div className="w-full max-w-[210mm] bg-white rounded-xl shadow-md p-6 mb-8 print:hidden flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between border-t-4 border-blue-600 font-sans">
                <div className="flex-1 w-full space-y-3">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FiSend className="text-blue-600" /> Handover Request Workflow
                    </h2>
                    <p className="text-sm text-slate-600">Please provide the reason for handover. This will be submitted to the Property Management Team Leader for review (Step 2).</p>
                    <div className="pt-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Reason for Handover *</label>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full md:w-2/3 border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        >
                            <option value="">-- Select Reason --</option>
                            <option value="retirement">ከሥራው በጡረታ ሲገለል ወይም የአመት ረፍት ሲወጣ (Retirement / Annual Leave)</option>
                            <option value="transfer_gov">ለሌላ መንግሥት ሥራ ከሥራው ሲለይ (Transfer to other Govt Work)</option>
                            <option value="training">ከመሥሪያ ቤቱ ውጭ ለሥልጠና ሲላክ (Training outside office)</option>
                            <option value="promotion">ዕድገት ሲያገኝ (Promotion)</option>
                            <option value="transfer_pos">ወደ ሌላ የሥራ መደብ ሲዛወር (Transfer to another position)</option>
                            <option value="medical">ረጅም ህክምና ሲያደርግ (Long Medical Treatment)</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-col gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => window.print()}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition-colors"
                    >
                        <FiPrinter /> Print Form
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || materials.length === 0 || !receiverName || !reason}
                        className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all ${submitting || materials.length === 0 || !receiverName || !reason
                                ? 'bg-blue-300 text-white cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30'
                            }`}
                    >
                        {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</> : <><FiSend /> Submit Request</>}
                    </button>
                </div>
            </div>

            {/* Success Notification */}
            <AnimatePresence>
                {submitted && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="w-full max-w-[210mm] bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl mb-8 flex items-center gap-3 print:hidden font-sans"
                    >
                        <FiCheckCircle className="text-2xl text-green-600" />
                        <div>
                            <h4 className="font-bold">Request Submitted Successfully</h4>
                            <p className="text-sm">Your handover request has been forwarded to the Team Leader for review.</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* EXACT PHYSICAL PAPER FORM REPLICA */}
            <div className="w-full max-w-[210mm] bg-white min-h-[297mm] shadow-[0_0_15px_rgba(0,0,0,0.1)] mx-auto p-8 sm:p-12 text-black print:p-0 print:shadow-none print:m-0 print:w-full overflow-hidden">

                {/* Headers */}
                <div className="text-center w-full mb-10">
                    <h1 className="font-bold text-[14px] leading-tight">የገንዘብና ኢኮኖሚ ልማት ሚኒስቴር</h1>
                    <h1 className="font-bold text-[14px] leading-tight mt-1">MINISTRY OF FINANACE & ECONOMIC DEVELOPMENT</h1>

                    <h2 className="font-bold text-[15px] mt-6 leading-tight">የዕቃ ቆጠራ</h2>
                    <h2 className="font-bold text-[15px] mt-1 leading-tight tracking-wider">STOCK TAKING SHEET</h2>

                    <div className="mt-6 inline-block">
                        <p className="text-[13px] border-b border-black border-dashed pb-0.5 leading-tight">
                            ስለ ትክክለኛነቱ ያረጋገጠው የንብረት ቆጠራ ቡድን አባላት ስምና ፊርማ
                        </p>
                        <p className="text-[13px] leading-tight mt-1">Name and signature of the stock taking team members</p>
                    </div>
                </div>

                {/* Signatures Row */}
                <div className="flex justify-between w-full mb-10 px-4">
                    {/* Handing Over */}
                    <div className="text-center w-[250px]">
                        <p className="font-bold text-[14px] underline mb-3">የአስረካቢ</p>

                        <div className="flex flex-col items-center">
                            <div className="flex items-end text-[13px]">
                                <span>የዕቃ ግ/ቤት ኃላፊ ሥም</span>
                                <div className="border-b border-black border-dashed ml-2 w-[120px] h-[20px] text-center font-bold flex items-end justify-center">
                                    {user?.displayName || ''}
                                </div>
                            </div>
                            <p className="text-[13px] mt-1 text-center w-full">Name of the store keeper</p>
                        </div>

                        <div className="flex flex-col items-center mt-6">
                            <div className="flex items-end text-[13px] w-full justify-center">
                                <span>ፊርማ</span>
                                <div className="border-b border-black border-dashed ml-2 w-[180px] h-[20px]"></div>
                            </div>
                            <p className="text-[13px] mt-1 ml-8 w-[180px] text-center">Signature</p>
                        </div>
                    </div>

                    {/* Receiving */}
                    <div className="text-center w-[250px] relative group">
                        <p className="font-bold text-[14px] underline mb-3">የተረካቢ</p>

                        <div className="flex flex-col items-center relative">
                            <div className="flex items-end text-[13px]">
                                <span>የዕቃ ግ/ቤት ኃላፊ ሥም</span>
                                <input
                                    className="border-b border-black border-dashed ml-2 w-[120px] h-[20px] outline-none text-center font-bold bg-transparent placeholder:text-gray-300 print:placeholder:text-transparent"
                                    value={receiverName}
                                    onChange={(e) => {
                                        setReceiverName(e.target.value);
                                        setShowResults(true);
                                    }}
                                    onFocus={() => setShowResults(true)}
                                    placeholder="Search..."
                                />
                            </div>
                            <p className="text-[13px] mt-1 text-center w-full">Name of the store keeper</p>

                            {/* Search Results Dropdown (Hidden when printing) */}
                            <AnimatePresence>
                                {showResults && (receiverName.length >= 2) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 5 }}
                                        className="absolute top-[25px] right-0 w-[200px] z-50 bg-white border border-gray-300 shadow-xl print:hidden text-left font-sans text-sm rounded overflow-hidden"
                                    >
                                        {searchResults.length > 0 ? (
                                            <div className="max-h-[200px] overflow-y-auto">
                                                {searchResults.map((u) => (
                                                    <div
                                                        key={u.id}
                                                        onClick={() => handleSelectUser(u)}
                                                        className="p-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                                                    >
                                                        <div className="font-bold">{u.displayName}</div>
                                                        <div className="text-xs text-gray-500">{u.email}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : !isSearching && (
                                            <div className="p-3 text-center text-gray-500 text-xs">No users found</div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="flex flex-col items-center mt-6">
                            <div className="flex items-end text-[13px] w-full justify-center">
                                <span>ፊርማ</span>
                                <div className="border-b border-black border-dashed ml-2 w-[180px] h-[20px]"></div>
                            </div>
                            <p className="text-[13px] mt-1 ml-8 w-[180px] text-center">Signature</p>
                        </div>
                    </div>
                </div>

                {/* Form Metadata Fields */}
                <div className="space-y-4 mb-8">
                    <div className="flex items-end text-[13px]">
                        <div className="w-[120px]">
                            <p className="font-bold leading-none">የመሥሪያ ቤቱ ሥም</p>
                            <p className="font-bold leading-tight mt-0.5">Public Body:</p>
                        </div>
                        <input
                            className="flex-1 border-b-[1.5px] border-black outline-none bg-transparent ml-2 font-bold px-2"
                            value={publicBody}
                            onChange={(e) => setPublicBody(e.target.value)}
                        />
                    </div>

                    <div className="flex items-end text-[13px]">
                        <div className="w-[120px]">
                            <p className="font-bold leading-none">የዕቃ ግ/ቤት መለያ</p>
                            <p className="font-bold leading-tight mt-0.5">Stores No.</p>
                        </div>
                        <input
                            className="w-[300px] border-b-[1.5px] border-black outline-none bg-transparent ml-2 font-bold px-2"
                            value={storesNo}
                            onChange={(e) => setStoresNo(e.target.value)}
                        />
                    </div>

                    <div className="flex items-end text-[13px]">
                        <div className="w-[120px]">
                            <p className="font-bold leading-none">የዕቃ ምድብ</p>
                            <p className="font-bold leading-tight mt-0.5">Stock classification</p>
                        </div>
                        <input
                            className="flex-1 border-b-[1.5px] border-black outline-none bg-transparent ml-2 font-bold px-2"
                            value={stockClassification}
                            onChange={(e) => setStockClassification(e.target.value)}
                        />
                    </div>

                    <div className="flex items-end text-[13px]">
                        <div className="w-[120px]">
                            <p className="font-bold leading-none">ቀን</p>
                            <p className="font-bold leading-tight mt-0.5">Date</p>
                        </div>
                        <input
                            type="date"
                            className="w-[200px] border-b-[1.5px] border-black outline-none bg-transparent ml-2 font-bold px-2 font-sans"
                            value={handoverDate}
                            onChange={(e) => setHandoverDate(e.target.value)}
                        />
                    </div>
                </div>

                {/* Table */}
                <table className="w-full border-collapse border-[2px] border-black text-[11px] leading-tight text-center">
                    <thead>
                        <tr>
                            <th className="border-[1.5px] border-black p-1 w-[40px] font-bold">
                                <p>ተ.ቁ</p>
                                <p className="mt-1">No.</p>
                            </th>
                            <th className="border-[1.5px] border-black p-1 w-[180px] font-bold">
                                <p>የዕቃው መግለጫ</p>
                                <p className="mt-1">Item description</p>
                            </th>
                            <th className="border-[1.5px] border-black p-1 w-[80px] font-bold">
                                <p>የዕቃው መለያ ቁጥር</p>
                                <p className="mt-1">Category of Asset</p>
                            </th>
                            <th className="border-[1.5px] border-black p-1 w-[60px] font-bold">
                                <p>በቆጠራ የተገኘ ብዛት</p>
                                <p className="mt-1">Count</p>
                            </th>
                            <th className="border-[1.5px] border-black p-1 w-[60px] font-bold">
                                <p>በስቶክ ካርድ የተገኘ ሂሳብ</p>
                                <p className="mt-1">Stock Card Balance</p>
                            </th>
                            <th className="border-[1.5px] border-black p-1 w-[60px] font-bold">
                                <p>ልዩነት</p>
                                <p className="mt-1">Stock Discrepancy</p>
                            </th>
                            <th className="border-[1.5px] border-black p-1 w-[100px] font-bold">
                                <p>ዕቃው የሚገኝበት ሁኔታ</p>
                                <p className="mt-1">Conditions to Goods</p>
                            </th>
                            <th className="border-[1.5px] border-black p-1 w-[100px] font-bold">
                                <p>ዕቃው የመጨረሻ ቀን የተንቀሳቀሰበት</p>
                                <p className="mt-1">Last Date of Movement</p>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {materials.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="border border-black p-4 text-gray-500 italic font-sans">
                                    No items found in your inventory.
                                </td>
                            </tr>
                        ) : (
                            materials.map((m, idx) => {
                                const state = itemStates[m.id];
                                if (!state) return null;
                                return (
                                    <tr key={m.id}>
                                        <td className="border border-black p-1 font-bold">{idx + 1}</td>
                                        <td className="border border-black p-1 text-left font-bold">{m.materialName}</td>
                                        <td className="border border-black p-1">{m.materialCode}</td>
                                        <td className="border border-black p-0 h-full">
                                            <input
                                                type="number"
                                                className="w-full h-full min-h-[24px] text-center outline-none bg-transparent font-bold font-sans hover:bg-gray-100 focus:bg-gray-100"
                                                value={state.physicalCount}
                                                onChange={(e) => handleItemStateChange(m.id, 'physicalCount', e.target.value === '' ? '' : Number(e.target.value))}
                                            />
                                        </td>
                                        <td className="border border-black p-1 font-bold">{state.stockCardBalance}</td>
                                        <td className="border border-black p-1 font-bold">
                                            {state.discrepancy !== '' && state.discrepancy !== 0 ? (state.discrepancy > 0 ? `+${state.discrepancy}` : state.discrepancy) : '-'}
                                        </td>
                                        <td className="border border-black p-0 h-full">
                                            <input
                                                type="text"
                                                className="w-full h-full min-h-[24px] text-center outline-none bg-transparent font-sans text-[10px] hover:bg-gray-100 focus:bg-gray-100"
                                                value={state.condition}
                                                onChange={(e) => handleItemStateChange(m.id, 'condition', e.target.value)}
                                            />
                                        </td>
                                        <td className="border border-black p-0 h-full">
                                            <input
                                                type="text"
                                                className="w-full h-full min-h-[24px] text-center outline-none bg-transparent font-sans text-[10px] hover:bg-gray-100 focus:bg-gray-100"
                                                value={state.lastDateOfMovement}
                                                onChange={(e) => handleItemStateChange(m.id, 'lastDateOfMovement', e.target.value)}
                                            />
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                        {/* Empty rows to fill space if few items exist */}
                        {Array.from({ length: Math.max(0, 10 - materials.length) }).map((_, i) => (
                            <tr key={`empty-${i}`}>
                                <td className="border border-black p-1 h-[24px]"></td>
                                <td className="border border-black p-1 h-[24px]"></td>
                                <td className="border border-black p-1 h-[24px]"></td>
                                <td className="border border-black p-1 h-[24px]"></td>
                                <td className="border border-black p-1 h-[24px]"></td>
                                <td className="border border-black p-1 h-[24px]"></td>
                                <td className="border border-black p-1 h-[24px]"></td>
                                <td className="border border-black p-1 h-[24px]"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MY HANDOVER HISTORY - Hidden when printing */}
            {myHandovers.length > 0 && (
                <div className="w-full max-w-[210mm] mt-8 print:hidden font-sans">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">My Handover Requests</h2>
                    <div className="space-y-4">
                        {myHandovers.map((h: any) => {
                            const STEPS = [
                                { key: 'pending_team_leader_review', label: 'Step 1-2: Team Leader Review', amLabel: 'ቡድን መሪ ግምገማ', icon: FiClock },
                                { key: 'witness_assigned', label: 'Step 3: Witness Assigned', amLabel: 'አረካክቢ ተመድቧል', icon: FiUsers },
                                { key: 'handover_in_progress', label: 'Step 4: Handover In Progress', amLabel: 'ርክክብ እየተከናወነ', icon: FiClipboard },
                                { key: 'pending_signatures', label: 'Step 5: Pending Signatures', amLabel: 'ፊርማ ይጠበቃል', icon: FiUser },
                                { key: 'pending_final_approval', label: 'Step 6: Final Approval', amLabel: 'የመጨረሻ ማጽደቅ', icon: ShieldCheck },
                                { key: 'completed', label: 'Step 7: Completed', amLabel: 'ተጠናቋል', icon: CheckCircle2 },
                            ];
                            const STATUS_ORDER = STEPS.map(s => s.key);
                            const currentIdx = STATUS_ORDER.indexOf(h.status);
                            const isRejected = h.status === 'rejected';

                            return (
                                <div key={h.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <p className="font-bold text-slate-800">To: {h.receivingKeeperName}</p>
                                            <p className="text-xs text-slate-500">{h.createdAt?.toDate?.()?.toLocaleDateString() || h.handoverDate}</p>
                                        </div>
                                        {isRejected && (
                                            <span className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1">
                                                <FiXCircle /> Rejected
                                            </span>
                                        )}
                                    </div>
                                    {!isRejected && (
                                        <div className="flex items-center gap-1 overflow-x-auto pb-2">
                                            {STEPS.map((step, i) => {
                                                const StepIcon = step.icon;
                                                const isDone = i <= currentIdx;
                                                const isCurrent = i === currentIdx;
                                                return (
                                                    <div key={step.key} className="flex items-center">
                                                        <div className={`flex flex-col items-center min-w-[80px] ${isCurrent ? 'scale-105' : ''
                                                            }`}>
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${isDone ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                                                                } ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-1 bg-blue-100 text-blue-600' : ''}`}>
                                                                <StepIcon className="w-4 h-4" />
                                                            </div>
                                                            <p className={`text-[9px] mt-1 text-center leading-tight font-bold ${isDone ? 'text-green-700' : 'text-slate-400'
                                                                } ${isCurrent ? 'text-blue-700' : ''}`}>{step.amLabel}</p>
                                                        </div>
                                                        {i < STEPS.length - 1 && (
                                                            <div className={`w-6 h-[2px] mt-[-12px] ${i < currentIdx ? 'bg-green-400' : 'bg-slate-200'}`} />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {h.witnessName && (
                                        <p className="text-xs text-slate-500 mt-2">Witness: <span className="font-bold text-slate-700">{h.witnessName}</span></p>
                                    )}
                                    {/* Action Button */}
                                    {!isRejected && NEXT_LABEL[h.status] && (
                                        <div className="mt-4 pt-3 border-t border-slate-100">
                                            <button
                                                onClick={() => advanceStatus(h.id, h.status)}
                                                disabled={advancingId === h.id}
                                                className={`w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${advancingId === h.id
                                                        ? 'bg-slate-100 text-slate-400'
                                                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20'
                                                    }`}
                                            >
                                                {advancingId === h.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <ArrowRight className="w-4 h-4" />
                                                        {NEXT_LABEL[h.status].am} — {NEXT_LABEL[h.status].en}
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                    {h.status === 'pending_final_approval' && (
                                        <div className="mt-4 pt-3 border-t border-slate-100">
                                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-xs font-bold flex items-center gap-2">
                                                <FiClock /> Waiting for Team Leader final approval...
                                            </div>
                                        </div>
                                    )}
                                    {h.status === 'completed' && (
                                        <div className="mt-4 pt-3 border-t border-slate-100">
                                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-xs font-bold flex items-center gap-2">
                                                <FiCheckCircle /> Handover completed successfully!
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
