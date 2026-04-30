'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import {
    collection, query, onSnapshot, doc, updateDoc, serverTimestamp, where, getDocs
} from 'firebase/firestore';
import {
    FiSearch, FiCheckCircle, FiXCircle, FiClock, FiUser, FiCalendar,
    FiArrowRight, FiClipboard, FiUsers, FiAlertTriangle
} from 'react-icons/fi';
import { Loader2, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HandoverRecord {
    id: string;
    handoverKeeperId: string;
    handoverKeeperName: string;
    handoverKeeperEmail: string;
    receivingKeeperId: string;
    receivingKeeperName: string;
    receivingKeeperEmail: string;
    reason: string;
    publicBody: string;
    storesNo: string;
    stockClassification: string;
    handoverDate: string;
    items: any[];
    status: string;
    createdAt: any;
    witnessId?: string;
    witnessName?: string;
    history?: any[];
}

const REASON_LABELS: Record<string, string> = {
    retirement: 'ከሥራው በጡረታ ሲገለል / Retirement',
    transfer_gov: 'ለሌላ መንግሥት ሥራ / Transfer to Govt Work',
    training: 'ለሥልጠና ሲላክ / Training',
    promotion: 'ዕድገት ሲያገኝ / Promotion',
    transfer_pos: 'ወደ ሌላ ሥራ ሲዛወር / Transfer',
    medical: 'ረጅም ህክምና / Long Medical',
};

const STATUS_CONFIG: Record<string, { label: string; amLabel: string; color: string; icon: any }> = {
    pending_team_leader_review: { label: 'Pending Your Review', amLabel: 'የቡድን መሪ ግምገማ ይጠበቃል', color: 'amber', icon: FiClock },
    witness_assigned: { label: 'Witness Assigned', amLabel: 'አረካክቢ ተመድቧል', color: 'blue', icon: FiUsers },
    handover_in_progress: { label: 'Handover In Progress', amLabel: 'ርክክብ እየተከናወነ ነው', color: 'indigo', icon: FiClipboard },
    pending_signatures: { label: 'Pending Signatures', amLabel: 'ፊርማ ይጠበቃል', color: 'purple', icon: FiUser },
    pending_final_approval: { label: 'Pending Final Approval', amLabel: 'የመጨረሻ ማጽደቅ ይጠበቃል', color: 'orange', icon: ShieldCheck },
    completed: { label: 'Completed', amLabel: 'ተጠናቋል', color: 'green', icon: FiCheckCircle },
    rejected: { label: 'Rejected', amLabel: 'ውድቅ ተደርጓል', color: 'red', icon: FiXCircle },
};

export default function StockHandoverRequestsPage() {
    const { user, userRole } = useAuth();
    const [records, setRecords] = useState<HandoverRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Witness assignment
    const [showWitnessModal, setShowWitnessModal] = useState(false);
    const [witnessTarget, setWitnessTarget] = useState<string | null>(null);
    const [witnessSearch, setWitnessSearch] = useState('');
    const [witnessResults, setWitnessResults] = useState<any[]>([]);
    const [selectedWitness, setSelectedWitness] = useState<any>(null);

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db!, 'Stock_Handovers'));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as HandoverRecord));
            list.sort((a, b) => {
                const da = a.createdAt?.toDate?.() || new Date(0);
                const db2 = b.createdAt?.toDate?.() || new Date(0);
                return db2.getTime() - da.getTime();
            });
            setRecords(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Witness search
    useEffect(() => {
        if (witnessSearch.length < 2) { setWitnessResults([]); return; }
        const timeout = setTimeout(async () => {
            const snap = await getDocs(collection(db!, 'users'));
            const filtered = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter((u: any) =>
                    u.displayName?.toLowerCase().includes(witnessSearch.toLowerCase()) ||
                    u.email?.toLowerCase().includes(witnessSearch.toLowerCase())
                ).slice(0, 5);
            setWitnessResults(filtered);
        }, 300);
        return () => clearTimeout(timeout);
    }, [witnessSearch]);

    // Step 2: Team Leader approves & assigns witness (Step 3)
    const handleApproveAndAssignWitness = (recordId: string) => {
        setWitnessTarget(recordId);
        setShowWitnessModal(true);
        setSelectedWitness(null);
        setWitnessSearch('');
    };

    const confirmWitnessAssignment = async () => {
        if (!witnessTarget || !selectedWitness || !user) return;
        setProcessingId(witnessTarget);
        try {
            const ref = doc(db!, 'Stock_Handovers', witnessTarget);
            await updateDoc(ref, {
                status: 'witness_assigned',
                witnessId: selectedWitness.id,
                witnessName: selectedWitness.displayName || '',
                witnessEmail: selectedWitness.email || '',
                approvedByTeamLeader: user.uid,
                approvedByTeamLeaderName: user.displayName,
                approvedAt: serverTimestamp(),
                history: [{
                    status: 'witness_assigned',
                    user: user.uid,
                    timestamp: new Date().toISOString(),
                    note: `Approved by Team Leader. Witness assigned: ${selectedWitness.displayName}`
                }]
            });
            setSuccessMsg('Approved! Witness has been assigned. Handover can now proceed.');
            setTimeout(() => setSuccessMsg(null), 5000);
            setShowWitnessModal(false);
        } catch (err) {
            console.error(err);
        } finally {
            setProcessingId(null);
        }
    };

    // Step 6: Final approval by Team Leader
    const handleFinalApproval = async (recordId: string) => {
        if (!user) return;
        setProcessingId(recordId);
        try {
            const ref = doc(db!, 'Stock_Handovers', recordId);
            await updateDoc(ref, {
                status: 'completed',
                finalApprovedBy: user.uid,
                finalApprovedByName: user.displayName,
                finalApprovedAt: serverTimestamp(),
            });
            setSuccessMsg('Handover completed! Document is finalized.');
            setTimeout(() => setSuccessMsg(null), 5000);
        } catch (err) {
            console.error(err);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (recordId: string) => {
        const note = prompt('Reason for rejection:');
        if (!note) return;
        setProcessingId(recordId);
        try {
            const ref = doc(db!, 'Stock_Handovers', recordId);
            await updateDoc(ref, {
                status: 'rejected',
                rejectedBy: user?.uid,
                rejectedByName: user?.displayName,
                rejectionNote: note,
                rejectedAt: serverTimestamp(),
            });
            setSuccessMsg('Request rejected.');
            setTimeout(() => setSuccessMsg(null), 5000);
        } catch (err) {
            console.error(err);
        } finally {
            setProcessingId(null);
        }
    };

    const filtered = records.filter(r =>
        r.handoverKeeperName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.receivingKeeperName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (REASON_LABELS[r.reason] || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 min-h-[60vh]">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
            {/* Success */}
            <AnimatePresence>
                {successMsg && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-8 py-4 rounded-xl shadow-2xl font-bold flex items-center gap-3"
                    >
                        <FiCheckCircle className="text-xl" /> {successMsg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">Stock Handover Protocol</div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Handover Requests</h1>
                    <p className="text-sm text-slate-500 mt-1">Review, assign witnesses, and finalize stock handovers</p>
                </div>
                <div className="relative w-full md:w-80">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                </div>
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-20 text-center">
                    <FiClock className="text-5xl text-slate-200 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-slate-700">No Handover Requests</h3>
                    <p className="text-sm text-slate-400 mt-1">No stock handover requests have been submitted yet.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {filtered.map(rec => {
                        const sc = STATUS_CONFIG[rec.status] || STATUS_CONFIG.pending_team_leader_review;
                        const StatusIcon = sc.icon;
                        const isExpanded = expandedId === rec.id;
                        const isPending = rec.status === 'pending_team_leader_review';
                        const isFinalApproval = rec.status === 'pending_final_approval';

                        return (
                            <div key={rec.id} className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all ${processingId === rec.id ? 'opacity-50 pointer-events-none' : ''}`}>
                                {/* Card Header */}
                                <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : rec.id)}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl bg-${sc.color}-100 flex items-center justify-center`}>
                                            <StatusIcon className={`text-xl text-${sc.color}-600`} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800">{rec.handoverKeeperName} → {rec.receivingKeeperName}</h3>
                                            <p className="text-xs text-slate-500 mt-0.5">{REASON_LABELS[rec.reason] || rec.reason}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-3 py-1 rounded-lg text-xs font-bold bg-${sc.color}-50 text-${sc.color}-700 border border-${sc.color}-200`}>
                                            {sc.amLabel}
                                        </span>
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <FiCalendar /> {rec.createdAt?.toDate?.()?.toLocaleDateString() || rec.handoverDate}
                                        </span>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                            <div className="border-t border-slate-100 p-6 space-y-6">
                                                {/* Info Grid */}
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                    <div><p className="text-slate-400 text-xs font-bold">Handing Over</p><p className="font-bold text-slate-800">{rec.handoverKeeperName}</p></div>
                                                    <div><p className="text-slate-400 text-xs font-bold">Receiving</p><p className="font-bold text-slate-800">{rec.receivingKeeperName}</p></div>
                                                    <div><p className="text-slate-400 text-xs font-bold">Items</p><p className="font-bold text-slate-800">{rec.items?.length || 0} items</p></div>
                                                    <div><p className="text-slate-400 text-xs font-bold">Witness</p><p className="font-bold text-slate-800">{rec.witnessName || 'Not assigned'}</p></div>
                                                </div>

                                                {/* Items Table */}
                                                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-slate-50">
                                                            <tr>
                                                                <th className="p-3 text-left font-bold text-slate-600">#</th>
                                                                <th className="p-3 text-left font-bold text-slate-600">Item</th>
                                                                <th className="p-3 text-center font-bold text-slate-600">Count</th>
                                                                <th className="p-3 text-center font-bold text-slate-600">Stock Card</th>
                                                                <th className="p-3 text-center font-bold text-slate-600">Discrepancy</th>
                                                                <th className="p-3 text-center font-bold text-slate-600">Condition</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {rec.items?.map((item: any, i: number) => (
                                                                <tr key={i} className="border-t border-slate-100">
                                                                    <td className="p-3 text-slate-500">{i + 1}</td>
                                                                    <td className="p-3 font-bold text-slate-800">{item.materialName}</td>
                                                                    <td className="p-3 text-center font-bold text-blue-600">{item.physicalCount}</td>
                                                                    <td className="p-3 text-center">{item.stockCardBalance}</td>
                                                                    <td className={`p-3 text-center font-bold ${item.discrepancy < 0 ? 'text-red-600' : item.discrepancy > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                                                        {item.discrepancy !== 0 ? (item.discrepancy > 0 ? `+${item.discrepancy}` : item.discrepancy) : '-'}
                                                                    </td>
                                                                    <td className="p-3 text-center text-xs">{item.condition}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Actions */}
                                                {isPending && (
                                                    <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                                                        <button onClick={() => handleApproveAndAssignWitness(rec.id)}
                                                            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">
                                                            <FiCheckCircle /> Approve & Assign Witness
                                                        </button>
                                                        <button onClick={() => handleReject(rec.id)}
                                                            className="px-6 py-3 border-2 border-slate-200 text-slate-500 rounded-xl font-bold hover:border-red-500 hover:text-red-500 transition-colors">
                                                            <FiXCircle className="text-xl" />
                                                        </button>
                                                    </div>
                                                )}
                                                {isFinalApproval && (
                                                    <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                                                        <button onClick={() => handleFinalApproval(rec.id)}
                                                            className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors shadow-lg shadow-green-500/20">
                                                            <ShieldCheck className="w-5 h-5" /> Final Approve & Complete
                                                        </button>
                                                        <button onClick={() => handleReject(rec.id)}
                                                            className="px-6 py-3 border-2 border-slate-200 text-slate-500 rounded-xl font-bold hover:border-red-500 hover:text-red-500 transition-colors">
                                                            <FiXCircle className="text-xl" />
                                                        </button>
                                                    </div>
                                                )}
                                                {rec.status === 'completed' && (
                                                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 font-bold text-sm flex items-center gap-2">
                                                        <FiCheckCircle /> This handover has been finalized.
                                                    </div>
                                                )}
                                                {rec.status === 'rejected' && (
                                                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 font-bold text-sm flex items-center gap-2">
                                                        <FiXCircle /> Rejected. {(rec as any).rejectionNote}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Witness Assignment Modal */}
            <AnimatePresence>
                {showWitnessModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setShowWitnessModal(false)}
                    >
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5"
                            onClick={e => e.stopPropagation()}
                        >
                            <div>
                                <h3 className="text-xl font-black text-slate-800">Assign Witness (አረካክቢ)</h3>
                                <p className="text-sm text-slate-500 mt-1">Search for a supervisor or auditor with Stock Management knowledge.</p>
                            </div>
                            <div className="relative">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="text" placeholder="Search by name or email..." value={witnessSearch}
                                    onChange={e => setWitnessSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                />
                            </div>

                            {witnessResults.length > 0 && (
                                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
                                    {witnessResults.map((u: any) => (
                                        <button key={u.id} onClick={() => { setSelectedWitness(u); setWitnessSearch(u.displayName); setWitnessResults([]); }}
                                            className={`w-full flex items-center gap-3 p-3 hover:bg-blue-50 text-left border-b border-slate-100 last:border-0 ${selectedWitness?.id === u.id ? 'bg-blue-50' : ''}`}>
                                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600"><FiUser /></div>
                                            <div>
                                                <p className="font-bold text-sm text-slate-800">{u.displayName}</p>
                                                <p className="text-xs text-slate-500">{u.email}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {selectedWitness && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
                                    <FiUser className="text-blue-600" />
                                    <div>
                                        <p className="font-bold text-sm text-blue-900">{selectedWitness.displayName}</p>
                                        <p className="text-xs text-blue-600">{selectedWitness.email}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowWitnessModal(false)}
                                    className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                                <button onClick={confirmWitnessAssignment} disabled={!selectedWitness}
                                    className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${selectedWitness ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                                    <FiCheckCircle /> Confirm & Approve
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
