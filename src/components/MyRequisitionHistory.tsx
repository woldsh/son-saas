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
        pending: requests.filter(r => ['pending', 'pending_department_leader', 'approved_by_head', 'approved_by_coordinator', 'forwarded_to_chief', 'pending_managing_director', 'pending_general_service', 'pending_procurement', 'forwarded_to_team_leader', 'approved_by_procurement_team_leader', 'approved_by_clerk'].includes(r.status)).length,
        approved: requests.filter(r => ['approved', 'approved_by_md'].includes(r.status)).length,
        issued: requests.filter(r => ['completed', 'received', 'issued', 'handout_completed'].includes(r.status)).length,
        total: requests.length
    };

    const filteredRequests = requests.filter(r => {
        const matchesSearch = r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.items.some(item => item.materialName.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'pending' && stats.pending > 0 && ['pending', 'pending_department_leader', 'approved_by_head', 'approved_by_coordinator', 'forwarded_to_chief', 'pending_managing_director', 'pending_general_service', 'pending_procurement', 'forwarded_to_team_leader', 'approved_by_procurement_team_leader', 'approved_by_clerk'].includes(r.status)) ||
            (statusFilter === 'approved' && ['approved', 'approved_by_md'].includes(r.status)) ||
            (statusFilter === 'issued' && ['completed', 'received', 'issued'].includes(r.status)) ||
            (statusFilter === 'rejected' && r.status === 'rejected');

        return matchesSearch && matchesStatus;
    });

    const getStatusBadge = (request: MaterialRequest) => {
        const s = request.status.toLowerCase();

        // If there's a verification code, show it in a premium way
        if (request.verification_code) {
            return (
                <div className="flex flex-col gap-2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-black uppercase tracking-widest">
                        <Fingerprint size={12} className="animate-pulse" /> Ready for Pickup
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(request.verification_code!);
                        }}
                        className={`
                            flex items-center justify-between gap-3 px-3 py-2 rounded-xl border-2 transition-all duration-300
                            ${copiedCode === request.verification_code
                                ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-200'
                                : 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800 hover:scale-105 active:scale-95'
                            }
                        `}
                    >
                        <div className="flex flex-col items-start leading-none">
                            <span className="text-[7px] font-black uppercase tracking-widest opacity-60">Handout Code</span>
                            <span className="text-sm font-mono font-black tracking-[0.2em]">
                                {request.verification_code}
                            </span>
                        </div>
                        {copiedCode === request.verification_code ? <Check size={14} /> : <Copy size={14} className="opacity-60" />}
                    </button>
                    {copiedCode === request.verification_code && (
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest animate-in fade-in zoom-in-50">Copied!</span>
                    )}
                </div>
            );
        }

        if (s === 'rejected' || s.includes('reject')) return (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 text-xs font-semibold">
                <XCircle size={14} /> Rejected
            </span>
        );
        if (['completed', 'received', 'issued', 'handout_completed'].includes(s)) return (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-xs font-semibold">
                <Package size={14} /> Issued
            </span>
        );
        if (['approved', 'approved_by_md'].includes(s)) return (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-xs font-semibold">
                <CheckCircle2 size={14} /> Approved
            </span>
        );
        return (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 text-xs font-semibold">
                <Clock size={14} /> Pending
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto p-6 lg:p-10 space-y-10 animate-in fade-in duration-500">
            {selectedRequest && (
                <ReadOnlyPaperForm20
                    request={selectedRequest}
                    onClose={() => setSelectedRequest(null)}
                />
            )}

            {/* Header Section */}
            <div className="flex items-start gap-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-200 shrink-0">
                    <ClipboardList className="text-white" size={32} />
                </div>
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                        {t('requisition_history_title')}
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">
                        {t('requisition_history_subtitle')}
                    </p>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <SummaryCard label={t('pending_requests_history')} value={stats.pending} color="text-amber-500" />
                <SummaryCard label={t('approved_requests_history')} value={stats.approved} color="text-emerald-500" />
                <SummaryCard label={t('issued_requests_history')} value={stats.issued} color="text-blue-500" />
                <SummaryCard label={t('total_requests_history')} value={stats.total} color="text-purple-600" />
            </div>

            {/* Filter Section */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder={t('search_placeholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-16 pr-6 py-4 bg-slate-50/50 border border-transparent rounded-[1.5rem] focus:bg-white focus:border-blue-500 outline-none transition-all font-medium text-slate-700"
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 hover:text-slate-600 transition-colors">
                        <Filter size={20} />
                    </button>
                    <div className="relative w-full md:w-48">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full pl-6 pr-10 py-4 bg-slate-50/50 border border-transparent rounded-[1.5rem] focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                        >
                            <option value="all">{t('all_status')}</option>
                            <option value="pending">{t('pending_requests_history')}</option>
                            <option value="approved">{t('approved_requests_history')}</option>
                            <option value="issued">{t('issued_requests_history')}</option>
                            <option value="rejected">Rejected</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-50">
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">{t('req_number')}</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">{t('date')}</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">{t('items_summary')}</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">{t('department_header')}</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">{t('status')}</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">{t('approver')}</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredRequests.map((request) => (
                                <tr key={request.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-6">
                                        <span className="font-black text-slate-900 tracking-tight">#{request.id.slice(0, 8)}</span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700 text-sm">
                                                {request.createdAt?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                                {request.createdAt?.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-sm font-medium text-slate-600">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-black text-slate-800 tracking-tight">
                                                {request.items[0]?.materialName}
                                                {request.items.length > 1 && ` +${request.items.length - 1} more`}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                                                {request.items.length} item(s), {request.items.reduce((acc, curr) => acc + curr.quantity, 0)} total qty
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                            {request.department?.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        {getStatusBadge(request)}
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                                <User size={14} className="text-slate-400" />
                                            </div>
                                            <span className="font-bold text-slate-700 text-sm">{request.currentApproverName || 'Panding...'}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <button
                                            onClick={() => setSelectedRequest(request)}
                                            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-bold text-sm transition-colors group/view"
                                        >
                                            <Eye size={18} className="group-hover/view:scale-110 transition-transform" />
                                            {t('view_details')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredRequests.length === 0 && (
                        <div className="p-20 text-center space-y-4">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                                <Package size={40} />
                            </div>
                            <p className="text-slate-400 font-bold uppercase text-xs tracking-[0.2em]">No requisitions found matching your criteria</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function SummaryCard({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all space-y-4 group">
            <p className="text-slate-500 font-bold uppercase text-[11px] tracking-[0.2em]">
                {label}
            </p>
            <p className={`text-6xl font-black ${color} tracking-tighter group-hover:scale-110 transition-transform origin-left`}>
                {value}
            </p>
        </div>
    );
}
