'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { FileText, Image as ImageIcon, File, Loader2, Download, Search, ExternalLink, X } from 'lucide-react';

export interface ACRule {
    id: string;
    title: string;
    description: string;
    fileUrl: string;
    fileType: string;
    publicId: string;
    uploadedBy: string;
    uploaderName: string;
    uploaderRole: string;
    createdAt: any;
    updatedAt?: any;
}

export default function ViewAcRules() {
    const [rules, setRules] = useState<ACRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRule, setSelectedRule] = useState<ACRule | null>(null);

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, 'ac_rules'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedRules = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ACRule[];
            setRules(fetchedRules);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching rules:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const getFileIcon = (fileType: string) => {
        if (fileType.includes('image')) return <ImageIcon className="w-8 h-8 text-blue-500" />;
        if (fileType.includes('pdf')) return <FileText className="w-8 h-8 text-rose-500" />;
        if (fileType.includes('csv') || fileType.includes('excel')) return <File className="w-8 h-8 text-emerald-500" />;
        return <File className="w-8 h-8 text-slate-500" />;
    };

    const filteredRules = rules.filter(rule => 
        rule.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (rule.description && rule.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Academic Coordinator Rules</h1>
                    <p className="text-slate-500 mt-1">View and download rules and guidelines uploaded by the Academic Coordinator and Managing Director.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-lg font-black text-slate-800">Available Rules</h2>
                    
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search rules..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                    </div>
                </div>
                
                {loading ? (
                    <div className="p-12 flex justify-center items-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                ) : filteredRules.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 font-medium flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <FileText className="w-8 h-8 text-slate-400" />
                        </div>
                        {searchTerm ? 'No rules match your search.' : 'No AC rules have been uploaded yet.'}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                        {filteredRules.map((rule) => (
                            <div 
                                key={rule.id} 
                                onClick={() => setSelectedRule(rule)}
                                className="group relative bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-200 transition-all duration-300 flex flex-col h-full cursor-pointer"
                            >
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                                        {getFileIcon(rule.fileType)}
                                    </div>
                                    <div className="flex-1 min-w-0 pt-1">
                                        <h3 className="text-base font-bold text-slate-900 truncate" title={rule.title}>{rule.title}</h3>
                                        <p className="text-xs font-medium text-slate-500 mt-1 truncate">By {rule.uploaderName}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{rule.uploaderRole}</p>
                                    </div>
                                </div>
                                
                                {rule.description && (
                                    <p className="text-sm text-slate-600 line-clamp-2 mb-4 flex-1">
                                        {rule.description}
                                    </p>
                                )}
                                
                                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400">
                                        {rule.createdAt?.toDate ? rule.createdAt.toDate().toLocaleDateString() : 'Just now'}
                                    </span>
                                    
                                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 group-hover:bg-blue-50 text-slate-700 group-hover:text-blue-600 font-bold text-xs rounded-xl transition-colors">
                                        <ExternalLink className="w-4 h-4" />
                                        Open File
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* File Viewer Modal */}
            {selectedRule && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                            <div className="flex items-center gap-3">
                                {getFileIcon(selectedRule.fileType)}
                                <div>
                                    <h3 className="text-lg font-black text-slate-800">{selectedRule.title}</h3>
                                    <p className="text-xs text-slate-500">Uploaded by {selectedRule.uploaderName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a 
                                    href={selectedRule.fileUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-sm rounded-xl transition-colors"
                                >
                                    <Download className="w-4 h-4" />
                                    Download
                                </a>
                                <button 
                                    onClick={() => setSelectedRule(null)}
                                    className="p-2 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-xl transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center min-h-[50vh]">
                            {selectedRule.fileType.includes('image') ? (
                                <img 
                                    src={selectedRule.fileUrl} 
                                    alt={selectedRule.title} 
                                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-sm bg-white"
                                />
                            ) : selectedRule.fileType.includes('csv') || selectedRule.fileType.includes('excel') ? (
                                <div className="text-center text-slate-500">
                                    <File className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                                    <p className="text-lg font-medium text-slate-700">Spreadsheet File</p>
                                    <p className="text-sm mt-2">Please use the Download button above to view this file.</p>
                                </div>
                            ) : (
                                <iframe 
                                    src={selectedRule.fileUrl} 
                                    className="w-full h-[80vh] rounded-xl border border-slate-200 bg-white shadow-sm"
                                    title={selectedRule.title}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
