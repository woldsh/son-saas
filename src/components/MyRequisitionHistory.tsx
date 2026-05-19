'use client';

import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
    Search,
    Filter,
    Eye,
    Clock,
    CheckCircle2,
    XCircle,
    Package,
    Calendar,
    User,
    ClipboardList,
    LayoutDashboard,
    ChevronDown,
    AlertCircle,
    Fingerprint,
    Copy,
    Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import ReadOnlyPaperForm20 from './ReadOnlyPaperForm20';

interface RequestItem {
    materialId: string;
    materialName: string;
    materialCode: string;
    quantity: number;
    condition: string;
    unit: string;
    materialType: string;
}

interface MaterialRequest {
    id: string;
    requesterId: string;
    requesterName: string;
    department: string;
    items: RequestItem[];
    currentApproverName: string;
    status: string;
    createdAt: any;
    formType?: string;
    history?: { status: string; note: string; timestamp: string; user: string }[];
    verification_code?: string; // from Send_to_Users
}

export default function MyRequisitionHistory() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [requests, setRequests] = useState<MaterialRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    useEffect(() => {
        if (!user || !db) return;

        // Query 1: Main Requests
        const requestsRef = collection(db, 'Request_materials');
        const q = query(
            requestsRef,
            where('requesterId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );

        // Query 2: Verification Codes
        const codesRef = collection(db, 'Send_to_Users');
        const cq = query(
            codesRef,
            where('requester_user_id', '==', user.uid)
        );

        const unsubscribeRequests = onSnapshot(q, (snapshot) => {
            const requestList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as MaterialRequest[];

            // Second layer: Fetch codes and merge
            onSnapshot(cq, (codeSnapshot) => {
                const codesMap = new Map();
                codeSnapshot.docs.forEach(d => {
                    const data = d.data();
                    codesMap.set(data.request_id, data.verification_code);
                });

                const mergedList = requestList.map(r => ({
                    ...r,
                    verification_code: codesMap.get(r.id)
                }));

                setRequests(mergedList);
                setLoading(false);
            });
        });

        return () => unsubscribeRequests();
    }, [user]);

    const handleCopy = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const stats = {
        pending: requests.filter(r => ['pending', 'pending_department_leader', 'approved_by_head', 'approved_by_coordinator', 'forwarded_to_chief', 'pending_managing_director', 'pending_procurement', 'forwarded_to_team_leader', 'approved_by_procurement_team_leader', 'approved_by_clerk'].includes(r.status)).length,
        approved: requests.filter(r => ['approved', 'approved_by_md'].includes(r.status)).length,
        issued: requests.filter(r => ['completed', 'received', 'issued', 'handout_completed'].includes(r.status)).length,
        total: requests.length
    };

    const filteredRequests = requests.filter(r => {
        const matchesSearch = r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.items.some(item => item.materialName.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'pending' && stats.pending > 0 && ['pending', 'pending_department_leader', 'approved_by_head', 'approved_by_coordinator', 'forwarded_to_chief', 'pending_managing_director', 'pending_procurement', 'forwarded_to_team_leader', 'approved_by_procurement_team_leader', 'approved_by_clerk'].includes(r.status)) ||
            (statusFilter === 'approved' && ['approved', 'approved_by_md'].includes(r.status)) ||
            (statusFilter === 'issued' && ['completed', 'received', 'issued'].includes(r.status)) ||
            (statusFilter === 'rejected' && r.status === 'rejected');

        return matchesSearch && matchesStatus;
    });

    const getStatusBadge = (request: MaterialRequest) => {
        const s = request.status.toLowerCase();

        if (request.verification_code) {
            return (
                <div className="flex flex-col gap-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-bold uppercase tracking-wide">
                        <Fingerprint size={10} className="animate-pulse" /> Ready
                    </span>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleCopy(request.verification_code!); }}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${copiedCode === request.verification_code
                            ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'
                            }`}
                    >
                        <span className="tracking-widest">{request.verification_code}</span>
                        {copiedCode === request.verification_code ? <Check size={10} /> : <Copy size={10} className="opacity-60" />}
                    </button>
                </div>
            );
        }

        if (s === 'rejected' || s.includes('reject')) return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 text-[10px] font-semibold">
                <XCircle size={12} /> Rejected
            </span>
        );
        if (['completed', 'received', 'issued', 'handout_completed'].includes(s)) return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-semibold">
                <Package size={12} /> Issued
            </span>
        );
        if (['approved', 'approved_by_md'].includes(s)) return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-semibold">
                <CheckCircle2 size={12} /> Approved
            </span>
        );
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-semibold">
                <Clock size={12} /> Pending
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-2 md:p-4 space-y-2">
            {selectedRequest && (
                <ReadOnlyPaperForm20
                    request={selectedRequest}
                    onClose={() => setSelectedRequest(null)}
                    onApprove={() => { }}
                    onReject={() => { }}
                    isProcessing={false}
                />
            )}

            {/* Header */}
            <div className="flex items-baseline gap-2">
                <h1 className="text-sm font-bold text-gray-900">{t('requisition_history_title')}</h1>
                <span className="text-[11px] text-gray-400">— {t('requisition_history_subtitle')}</span>
            </div>

            {/* Stats + Filter Row */}
            <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-2 border border-gray-200 rounded-lg">
                {/* Inline Stats */}
                <div className="flex items-center gap-3 mr-auto">
                    <span className="flex items-center gap-1 text-xs">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        <span className="text-gray-500">Pending</span>
                        <span className="font-bold text-gray-900">{stats.pending}</span>
                    </span>
                    <span className="flex items-center gap-1 text-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span className="text-gray-500">Approved</span>
                        <span className="font-bold text-gray-900">{stats.approved}</span>
                    </span>
                    <span className="flex items-center gap-1 text-xs">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        <span className="text-gray-500">Issued</span>
                        <span className="font-bold text-gray-900">{stats.issued}</span>
                    </span>
                    <span className="flex items-center gap-1 text-xs">
                        <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                        <span className="text-gray-500">Total</span>
                        <span className="font-bold text-gray-900">{stats.total}</span>
                    </span>
                </div>

                {/* Status Filter */}
                <div className="relative">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="pl-2 pr-6 py-1 appearance-none border border-gray-300 rounded-md text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                    >
                        <option value="all">{t('all_status')}</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="issued">Issued</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none w-3 h-3" />
                </div>

                {/* Search */}
                <div className="relative min-w-[160px] max-w-xs">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                    <input
                        type="text"
                        placeholder={t('search_placeholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-7 pr-3 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                            <tr>
                                <th className="px-3 py-3 font-medium text-xs text-center w-10">#</th>
                                <th className="px-4 py-3 font-medium text-xs">{t('req_number')}</th>
                                <th className="px-4 py-3 font-medium text-xs">{t('date')}</th>
                                <th className="px-4 py-3 font-medium text-xs">{t('items_summary')}</th>
                                <th className="px-4 py-3 font-medium text-xs">{t('department_header')}</th>
                                <th className="px-4 py-3 font-medium text-xs">{t('status')}</th>
                                <th className="px-4 py-3 font-medium text-xs">{t('approver')}</th>
                                <th className="px-4 py-3 font-medium text-xs text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                                        <Package className="w-6 h-6 mx-auto mb-1 text-gray-300" />
                                        <p className="text-xs">No requisitions found.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((request, index) => (
                                    <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-3 py-3 text-center text-xs text-gray-400">{index + 1}</td>
                                        <td className="px-4 py-3">
                                            <span className="font-semibold text-gray-900 text-xs">#{request.id.slice(0, 8)}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-700">
                                            {request.createdAt?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="text-xs font-medium text-gray-800">
                                                    {request.items[0]?.materialName}
                                                    {request.items.length > 1 && <span className="text-gray-400"> +{request.items.length - 1}</span>}
                                                </p>
                                                <p className="text-[10px] text-gray-400">{request.items.length} item(s), {request.items.reduce((a, c) => a + c.quantity, 0)} qty</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded capitalize">
                                                {request.department?.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {getStatusBadge(request)}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-600">
                                            {request.currentApproverName || 'Pending...'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => setSelectedRequest(request)}
                                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-medium"
                                            >
                                                <Eye size={14} />
                                                {t('view_details')}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
