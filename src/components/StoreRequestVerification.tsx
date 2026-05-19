'use client';

import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, where, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { FiSearch, FiUser, FiPackage, FiCheckCircle, FiClock, FiActivity, FiCopy, FiCheck, FiArrowRight } from 'react-icons/fi';
import ClerkModel22Form from './ClerkModel22Form';
import KeeperModel22SigningModal from './KeeperModel22SigningModal';
import { getDoc } from 'firebase/firestore';


interface MaterialDetail {
    materialName: string;
    materialCode?: string;
    materialType: string;
    quantity: number;
    unit: string;
}

interface RequestRecord {
    id: string;
    request_id: string;
    verification_code: string;
    requester_name: string;
    material_details: MaterialDetail[];
    status: string;
    created_at: any;
    sharedAt?: string; // ISO string
    department?: string;
    recipientSignature?: string;
    keeperSignature?: string;
    keeperName?: string;
}

interface StoreRequestVerificationProps {
    storeType: 'fixed_asset' | 'consumable';
}

export default function StoreRequestVerification({ storeType }: StoreRequestVerificationProps) {
    const [requests, setRequests] = useState<RequestRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // Verification State
    const [verifyingId, setVerifyingId] = useState<string | null>(null);
    const [inputCode, setInputCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successId, setSuccessId] = useState<string | null>(null);

    // Track processing IDs to prevent double-processing
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

    // Modal State
    const [model22Request, setModel22Request] = useState<any | null>(null);
    const [isFetchingRequest, setIsFetchingRequest] = useState(false);
    const [keeperSigningRecord, setKeeperSigningRecord] = useState<RequestRecord | null>(null);


    useEffect(() => {
        // Fetch from Send_to_Users
        if (!db) return;
        const q = query(
            collection(db!, 'Send_to_Users'),
            orderBy('created_at', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as RequestRecord[];

            setRequests(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Auto-verify logic (only for manual code entry)
    useEffect(() => {
        // Auto-verify input when 6 digits match
        if (inputCode.length === 6 && verifyingId) {
            const record = requests.find(r => r.id === verifyingId);
            if (record && !processingIds.has(record.id)) {
                handleVerify(record, inputCode);
            }
        }
        // Note: shared_with_store requests now require keeper signature via KeeperModel22SigningModal
    }, [inputCode, verifyingId, requests, processingIds]);

    const handleVerify = async (record: RequestRecord, codeToCheck?: string, isAutoVerify: boolean = false) => {
        const verificationCode = codeToCheck || inputCode;

        if (verificationCode !== record.verification_code) {
            if (!isAutoVerify) setError('Incorrect verification code.');
            return;
        }

        try {
            if (!db) return;
            setLoading(true);
            const batch = writeBatch(db!);

            // 1. Update User_reports status from Completed to accepted
            const userReportQuery = query(
                collection(db!, 'User-Report'),
                where('requestId', '==', record.request_id)
            );
            const userReportSnap = await getDocs(userReportQuery);

            userReportSnap.docs.forEach((userRepDoc) => {
                batch.update(userRepDoc.ref, {
                    status: 'accepted',
                    acceptedAt: new Date().toISOString()
                });
            });

            // 2. Inventory Deduction: Already handled at Stock Clerk approval stage in MaterialRequestView.tsx
            // No deduction here to prevent double-counting

            // 3. Update Send_to_Users status to identify it as completed in this view
            const sendToUserRef = doc(db!, 'Send_to_Users', record.id);
            batch.update(sendToUserRef, { status: 'handout_completed' });

            // 4. Update the original Request_materials document to 'handout_completed' instead of deleting
            // This allows the Store Keeper to view the Model 22 document even after verification.
            if (record.request_id) {
                const requestMaterialRef = doc(db!, 'Request_materials', record.request_id);
                batch.update(requestMaterialRef, {
                    status: 'handout_completed',
                    handoutCompletedAt: new Date().toISOString()
                });
            }

            await batch.commit();

            setSuccessId(record.id);
            setVerifyingId(null);
            setInputCode('');
            setError(null);

            // 5. Auto-Deletion: Delete document after 24 hours (86,400,000ms)
            setTimeout(async () => {
                try {
                    if (db) {
                        await deleteDoc(doc(db!, 'Send_to_Users', record.id));
                        console.log(`Document ${record.id} deleted automatically.`);
                    }
                } catch (delError) {
                    console.error('Failed to auto-delete document:', delError);
                }
            }, 86400000); // 24 hours

        } catch (err) {
            console.error(err);
            setError('Failed to update records.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const openModel22 = async (record: RequestRecord) => {
        if (!record.request_id || !db) return;

        try {
            setIsFetchingRequest(true);
            const requestDoc = await getDoc(doc(db!, 'Request_materials', record.request_id));
            if (requestDoc.exists()) {
                const data = requestDoc.data();
                setModel22Request({
                    id: requestDoc.id,
                    ...data,
                    items: data.items || record.material_details,
                    department: data.department || record.department || 'Property Management',
                    recipientSignature: data.recipientSignature || record.recipientSignature,
                    keeperSignature: data.keeperSignature || record.keeperSignature,
                    keeperName: data.keeperName || record.keeperName
                });
            } else {
                // Fallback: Reconstruct a synthetic request from the local record if the original archive was deleted
                // This ensures "VERIFIED" requests processed before the archive fix can still be viewed.
                let deptFallback = record.department || 'Official Handout';

                // Try to recover department from User-Report if it's missing in the record
                if (!record.department) {
                    try {
                        const reportQuery = query(collection(db!, 'User-Report'), where('requestId', '==', record.request_id));
                        const reportSnap = await getDocs(reportQuery);
                        if (!reportSnap.empty) {
                            deptFallback = reportSnap.docs[0].data().department || deptFallback;
                        }
                    } catch (err) {
                        console.warn('Failed to recover department from User-Report:', err);
                    }
                }

                const reconstructedItems = record.material_details.map(item => ({
                    ...item,
                    materialId: item.materialCode || 'archive_ref',
                    materialCode: item.materialCode || 'N/A',
                    condition: 'Good' // Standard archive default
                }));

                setModel22Request({
                    id: record.request_id || record.id,
                    requesterName: record.requester_name,
                    requesterId: 'archive_sys',
                    department: deptFallback,
                    items: reconstructedItems,
                    status: 'handout_completed',
                    createdAt: record.created_at,
                    receiptNo: record.verification_code || '---',
                    recipientSignature: record.recipientSignature,
                    keeperSignature: record.keeperSignature,
                    keeperName: record.keeperName
                });
            }
        } catch (err) {
            console.error('Error fetching request:', err);
            alert('Failed to load the official document.');
        } finally {
            setIsFetchingRequest(false);
        }
    };


    const filteredRequests = requests.filter(req => {
        const matchesSearch = (req.requester_name || '').toLowerCase().includes(searchTerm.toLowerCase());

        // Normalize types for robust comparison (handles 'fixed_asset' vs 'Fixed Asset')
        const normalizedStoreType = storeType.toLowerCase().replace(/[^a-z]/g, '');
        const matchesType = req.material_details?.some(m => {
            const itemType = (m.materialType || '').toLowerCase().replace(/[^a-z]/g, '');
            return itemType.includes(normalizedStoreType) || normalizedStoreType.includes(itemType);
        });

        return matchesSearch && matchesType;
    });

    if (loading && requests.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/20 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-50"></div>
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                            <FiActivity className="text-xl animate-pulse" />
                        </div>
                        Store Verification
                    </h2>
                    <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em] mt-2 ml-13">Automated Handout Pipeline</p>
                </div>
                <div className="relative w-full md:w-[450px] group/search">
                    <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-indigo-500 transition-colors text-lg" />
                    <input
                        type="text"
                        placeholder="Search by requester name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border-2 border-slate-100/80 rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 outline-none transition-all font-semibold text-slate-600 placeholder:text-slate-300 shadow-inner"
                    />
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/80 border-b border-slate-100">
                            <tr>
                                <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">Requester</th>
                                <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">Items Requested</th>
                                <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">Serial Codes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRequests.map(req => {
                                const isCompleted = req.status === 'handout_completed' || successId === req.id;

                                const formatDate = (val: any) => {
                                    if (!val) return '';
                                    try {
                                        const d = val.toDate?.() || new Date(val);
                                        return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
                                    } catch { return ''; }
                                };

                                return (
                                    <tr
                                        key={req.id}
                                        onClick={() => {
                                            if (!isCompleted && req.status === 'shared_with_store') {
                                                setKeeperSigningRecord(req);
                                            } else {
                                                openModel22(req);
                                            }
                                        }}
                                        className={`hover:bg-slate-50/50 transition-colors group cursor-pointer ${isFetchingRequest ? 'pointer-events-none opacity-80' : ''}`}
                                    >
                                        <td className="p-5 align-middle">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${isCompleted ? 'bg-green-50 border-green-100 text-green-500' : 'bg-indigo-50 border-indigo-100 text-indigo-500'}`}>
                                                    <FiUser className="text-xl" />
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-700 text-sm">{req.requester_name}</p>
                                                    <p className="text-[10px] uppercase font-bold text-slate-400 mt-1">{formatDate(req.created_at)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5 align-middle">
                                            <div className="flex flex-wrap gap-2">
                                                {req.material_details.map((item, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200/80 rounded-xl shadow-sm">
                                                        <span className="font-bold text-slate-600 text-xs">{item.materialName}</span>
                                                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg border border-slate-200">
                                                            {item.quantity} {item.unit}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-5 align-middle">
                                            {isCompleted ? (
                                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-50 text-green-600 border border-green-100">
                                                    <FiCheckCircle className="text-sm" />
                                                    <span className="text-xs font-black uppercase tracking-wider">Verified</span>
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 shadow-[0_0_10px_rgba(251,191,36,0.2)] relative overflow-hidden">
                                                    {/* Shimmer effect behind */}
                                                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-amber-200/30 to-transparent animate-[shimmer_2s_infinite]"></div>

                                                    <div className="relative">
                                                        <FiClock className="text-sm relative z-10 animate-pulse" />
                                                        <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-40"></div>
                                                    </div>

                                                    <span className="text-xs font-black uppercase tracking-wider relative z-10 flex items-center">
                                                        Waiting
                                                        <span className="flex gap-[1px] ml-1">
                                                            <span className="animate-bounce text-[14px] leading-none" style={{ animationDelay: '0ms' }}>.</span>
                                                            <span className="animate-bounce text-[14px] leading-none" style={{ animationDelay: '200ms' }}>.</span>
                                                            <span className="animate-bounce text-[14px] leading-none" style={{ animationDelay: '400ms' }}>.</span>
                                                        </span>
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-5 align-middle">
                                            <div className="flex flex-col items-end gap-3">
                                                {/* Model 22 button - Sign or View */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!isCompleted && req.status === 'shared_with_store') {
                                                            setKeeperSigningRecord(req);
                                                        } else {
                                                            openModel22(req);
                                                        }
                                                    }}
                                                    className={`px-5 py-2.5 ${!isCompleted && req.status === 'shared_with_store' ? 'bg-green-600 shadow-green-600/20 hover:bg-green-500' : 'bg-blue-600 shadow-blue-600/20 hover:bg-blue-500'} text-white rounded-xl font-black uppercase text-[10px] tracking-[0.15em] shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2 group/btn`}
                                                >
                                                    {!isCompleted && req.status === 'shared_with_store' ? 'Sign & Process' : 'View Model 22'}
                                                    <FiArrowRight className="group-hover/btn:translate-x-1 transition-transform" />
                                                </button>

                                                {isCompleted && req.material_details.some(m => m.materialCode) ? (
                                                    <div className="flex flex-col gap-2">
                                                        {req.material_details.filter(m => m.materialCode).map((item, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCopy(item.materialCode!);
                                                                }}
                                                                className={`
                                                                    flex items-center justify-between gap-3 px-3 py-2 rounded-xl border transition-all text-xs w-max group/btn
                                                                    ${copiedCode === item.materialCode
                                                                        ? 'bg-green-50 border-green-200 text-green-700 shadow-sm'
                                                                        : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:shadow-md'
                                                                    }
                                                                `}
                                                            >
                                                                <div className="flex flex-col text-left">
                                                                    <span className="text-[8px] font-black uppercase text-slate-400">{item.materialName}</span>
                                                                    <span className="font-mono font-black tracking-widest">{item.materialCode}</span>
                                                                </div>
                                                                {copiedCode === item.materialCode ? <FiCheck className="text-green-500 text-lg" /> : <FiCopy className="text-slate-400 group-hover/btn:text-indigo-500 transition-colors text-lg" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-[9px] italic font-bold text-slate-400 tracking-wide pr-1">
                                                        {isCompleted ? 'Handout Archive' : 'Auto-verifying...'}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Empty State */}
            {filteredRequests.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border-4 border-dashed border-slate-100 animate-in fade-in duration-700">
                    <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 mb-6">
                        <FiPackage className="text-4xl" />
                    </div>
                    <h3 className="text-slate-400 font-black uppercase tracking-[0.3em] text-sm">No Active Handouts</h3>
                    <p className="text-slate-300 text-xs font-bold mt-2 italic">Scanning for incoming verification codes...</p>
                </div>
            )}

            {model22Request && (
                <ClerkModel22Form
                    request={model22Request}
                    onClose={() => setModel22Request(null)}
                    onApprove={async () => { }}
                    readOnly={true}
                />
            )}

            {/* Keeper signing modal for shared_with_store requests */}
            {keeperSigningRecord && (
                <KeeperModel22SigningModal
                    record={keeperSigningRecord}
                    onClose={() => setKeeperSigningRecord(null)}
                    onFinalized={() => {
                        setKeeperSigningRecord(null);
                        setSuccessId(keeperSigningRecord.id);
                    }}
                />
            )}
        </div>
    );
}
