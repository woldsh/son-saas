'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiCheck, FiUser, FiCalendar, FiBox, FiClock, FiActivity } from 'react-icons/fi';
import Image from 'next/image';

interface RequestItem {
    materialName: string;
    quantity: number;
    unit?: string;
    materialId?: string;
    image?: string;
    materialCode?: string;
}

interface MaterialRequestReviewModalProps {
    request: {
        id: string;
        requesterName: string;
        department: string;
        items: RequestItem[];
        createdAt: any;
        status: string;
        history: { status: string; note: string; timestamp: string; userName?: string; userRole?: string }[];
    };
    onClose: () => void;
    onApprove: () => void;
    onReject: () => void;
    isProcessing: boolean;
}

export default function MaterialRequestReviewModal({
    request,
    onClose,
    onApprove,
    onReject,
    isProcessing
}: MaterialRequestReviewModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const formattedDate = request.createdAt?.toDate?.() ? 
        request.createdAt.toDate().toLocaleDateString('en-US', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        }) : 'Recent';

    return createPortal(
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8 overflow-hidden" 
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            
            <div 
                className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <FiActivity size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                                Review <span className="text-blue-600">Request</span>
                            </h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                ID: {request.id.slice(0, 8)}...
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-3 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-2xl transition-all border border-slate-100 shadow-sm"
                    >
                        <FiX size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* Left Side: Info & History */}
                        <div className="lg:col-span-1 space-y-6">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Requester Info</h3>
                                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-slate-400">
                                            <FiUser size={18} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 text-sm leading-none">{request.requesterName}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-tight">{request.department}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-slate-400">
                                            <FiCalendar size={18} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 text-sm leading-none">{formattedDate}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-tight">Request Date</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Request Journey</h3>
                                <div className="space-y-4 pl-2">
                                    {request.history?.slice().reverse().map((step, idx) => (
                                        <div key={idx} className="relative pl-6 border-l-2 border-slate-100 pb-2 last:pb-0">
                                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-blue-500 shadow-sm" />
                                            <p className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none mb-1">
                                                {step.status.replace(/_/g, ' ')}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 leading-tight">
                                                {step.userName} • {step.userRole}
                                            </p>
                                            <p className="text-[10px] italic text-slate-500 mt-1">"{step.note}"</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Items List */}
                        <div className="lg:col-span-2 space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                                Requested Materials
                                <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full text-[9px]">{request.items.length} items</span>
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {request.items.map((item, idx) => (
                                    <div key={idx} className="bg-slate-50 rounded-3xl p-4 border border-slate-100 flex items-center gap-4 group hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300">
                                        <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
                                            {item.image ? (
                                                <Image src={item.image} alt={item.materialName} width={64} height={64} className="object-cover" />
                                            ) : (
                                                <FiBox className="text-slate-200" size={24} />
                                            )}
                                        </div>
                                        <div className="min-w-0 pr-2">
                                            <h4 className="font-bold text-slate-900 text-sm truncate leading-none mb-1">{item.materialName}</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-2">{item.materialCode || 'No Code'}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-black text-blue-600 leading-none">{item.quantity}</span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{item.unit || 'pcs'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-8 py-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
                    <button 
                        onClick={onReject}
                        disabled={isProcessing}
                        className="px-8 py-3.5 bg-white text-slate-400 hover:text-red-500 rounded-[1.25rem] font-black text-xs uppercase tracking-widest transition-all border border-slate-200 hover:border-red-200 hover:bg-red-50"
                    >
                        Reject
                    </button>
                    <button 
                        onClick={onApprove}
                        disabled={isProcessing}
                        className="px-12 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.25rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isProcessing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <FiCheck size={18} />
                                Approve Request
                            </>
                        )}
                    </button>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </div>
    , document.body);
}
