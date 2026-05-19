'use client';

import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, where, updateDoc, doc, getDoc } from 'firebase/firestore';
import { FiSearch, FiCode, FiUser, FiPackage, FiCheckCircle, FiClock, FiSend } from 'react-icons/fi';
import { useAuth } from '@/contexts/AuthContext';
import EmployeeModel22SigningModal from './EmployeeModel22SigningModal';

interface MaterialDetail {
    materialName: string;
    materialCode?: string;
    materialType: string;
    quantity: number;
    unit: string;
}

interface SentCodeRecord {
    id: string;
    verification_code: string;
    requester_name: string;
    material_details: MaterialDetail[];
    status: string;
    created_at: any;
    isSeen?: boolean;
    request_id?: string;
    department?: string;
    recipientSignature?: string;
}

interface ClerkReportViewProps {
    materialTypeFilter?: 'fixed_asset' | 'consumable';
}

export default function ClerkReportView({ materialTypeFilter }: ClerkReportViewProps) {
    const [records, setRecords] = useState<SentCodeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmingSendId, setConfirmingSendId] = useState<string | null>(null);
    const [signingRecord, setSigningRecord] = useState<SentCodeRecord | null>(null);

    // Get current user from useAuth
    const { user } = useAuth();
    const [userData, setUserData] = useState<any>(null);

    useEffect(() => {
        if (!user?.uid) return;
        const fetchUserData = async () => {
            if (user?.uid && db) {
                try {
                    const userDoc = await getDoc(doc(db!, 'users', user.uid));
                    if (userDoc.exists()) {
                        setUserData(userDoc.data());
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                }
            }
        };
        fetchUserData();
    }, [user?.uid]);

    const handleConfirmSend = async (id: string) => {
        if (!db) return;
        try {
            await updateDoc(doc(db!, 'Send_to_Users', id), {
                status: 'shared_with_store',
                sharedAt: new Date().toISOString()
            });
            setConfirmingSendId(null);
        } catch (error) {
            console.error("Error sending code to store:", error);
            alert("Failed to send code.");
        }
    };

    // Mark notifications as seen when records are loaded
    useEffect(() => {
        if (!user?.uid || !records.length || !db) return;

        const markAsSeen = async () => {
            // Include both 'false' and 'undefined' (existing records)
            const unseenRecords = records.filter(r => r.isSeen !== true);
            if (unseenRecords.length === 0) return;

            try {
                const promises = unseenRecords.map(r =>
                    updateDoc(doc(db!, 'Send_to_Users', r.id), { isSeen: true })
                );
                await Promise.all(promises);
            } catch (err) {
                console.error("Error marking handouts as seen:", err);
            }
        };

        markAsSeen();
    }, [records, user?.uid]);

    useEffect(() => {
        // ... previous useEffect ...
        if (!user?.uid || !db) {
            setLoading(false);
            return;
        }

        // Everyone (including Store Keepers and Stock Clerks) only sees their own codes
        // on this page, because this is their Personal Account verification codes page.
        const q = query(
            collection(db!, 'Send_to_Users'),
            where('requester_user_id', '==', user.uid)
        );

        const timeoutId = setTimeout(() => {
            setLoading(false);
        }, 5000);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            clearTimeout(timeoutId);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as SentCodeRecord[];

            const sortedData = data.sort((a, b) => {
                const timeA = a.created_at?.seconds || 0;
                const timeB = b.created_at?.seconds || 0;
                return timeB - timeA;
            });

            setRecords(sortedData);
            setLoading(false);
        }, (error) => {
            clearTimeout(timeoutId);
            setLoading(false);
        });

        return () => {
            clearTimeout(timeoutId);
            unsubscribe();
        };
    }, [user?.uid, userData?.userRole]);

    const effectiveMaterialTypeFilter = materialTypeFilter ||
        (userData?.stockType === 'fixed_asset' ? 'fixed_asset' :
            userData?.stockType === 'consumable' ? 'consumable' : undefined);

    const filteredRecords = records.filter(record => {
        const matchesSearch =
            record.requester_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            record.verification_code.includes(searchTerm);

        const matchesType = !effectiveMaterialTypeFilter ||
            record.material_details.some(m => m.materialType === effectiveMaterialTypeFilter);

        return matchesSearch && matchesType;
    });

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
            {/* Header / Filter */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Verification Codes</h2>
                    <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">Sent to Users</p>
                </div>
                <div className="relative w-full md:w-96 group">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search requester or code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-600"
                    />
                </div>
            </div>

            {/* Records Table */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-bold">
                                <th className="p-5 font-bold">Requester</th>
                                <th className="p-5 font-bold">Code</th>
                                <th className="p-5 font-bold min-w-[200px]">Requested Items</th>
                                <th className="p-5 font-bold">Status</th>
                                <th className="p-5 font-bold">Date</th>
                                <th className="p-5 font-bold text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-16 text-center text-slate-400">
                                        <FiPackage className="text-5xl mx-auto mb-4 opacity-30" />
                                        <p className="font-bold uppercase tracking-widest text-sm">No records found</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map(record => (
                                    <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                                        {/* Requester */}
                                        <td className="p-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
                                                    <FiUser className="text-lg" />
                                                </div>
                                                <span className="font-bold text-slate-800 text-sm whitespace-nowrap">{record.requester_name}</span>
                                            </div>
                                        </td>
                                        
                                        {/* Verification Code */}
                                        <td className="p-5">
                                            <div className="inline-flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                                <FiCode className="text-indigo-500 text-xs" />
                                                <span className="font-mono font-black text-indigo-600 text-sm tracking-widest">{record.verification_code}</span>
                                            </div>
                                        </td>

                                        {/* Requested Items */}
                                        <td className="p-5">
                                            <div className="space-y-2">
                                                {record.material_details.map((item, idx) => (
                                                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm bg-white border border-slate-100 p-2 rounded-lg">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-slate-700">{item.materialName}</span>
                                                            {item.materialCode && (
                                                                <span className="text-[10px] font-mono text-slate-400">{item.materialCode}</span>
                                                            )}
                                                        </div>
                                                        <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-500 whitespace-nowrap">
                                                            {item.quantity} {item.unit}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="p-5">
                                            {record.status === 'verified' || record.status === 'shared_with_store' || record.status === 'handout_completed' ? (
                                                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl border border-emerald-100 whitespace-nowrap">
                                                    <FiCheckCircle />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Verified</span>
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-2 text-amber-600 px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-100 whitespace-nowrap">
                                                    <FiClock className="animate-pulse" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Auth</span>
                                                </div>
                                            )}
                                        </td>

                                        {/* Date */}
                                        <td className="p-5">
                                            {record.created_at ? (
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                                                    {record.created_at?.toDate().toLocaleDateString()}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-300">-</span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="p-5 text-center align-middle">
                                            {record.status !== 'verified' && record.status !== 'shared_with_store' && record.status !== 'handout_completed' ? (
                                                <button
                                                    onClick={() => setSigningRecord(record)}
                                                    className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-indigo-600 font-black uppercase tracking-widest text-[10px] px-6 py-2.5 rounded-xl transition-all shadow-md hover:shadow-indigo-500/20 active:scale-95 group/btn whitespace-nowrap w-full"
                                                >
                                                    <span>Verify</span>
                                                    <FiCheckCircle className="group-hover/btn:scale-110 transition-transform" />
                                                </button>
                                            ) : (
                                                <span className="text-xs font-bold text-slate-300 italic">No action needed</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Employee Model 22 Signing Modal */}
            {signingRecord && (
                <EmployeeModel22SigningModal
                    record={signingRecord}
                    onClose={() => setSigningRecord(null)}
                    onSigned={() => setSigningRecord(null)}
                />
            )}
        </div>
    );
}
