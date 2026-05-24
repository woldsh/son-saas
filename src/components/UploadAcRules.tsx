'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { UploadCloud, FileText, Image as ImageIcon, File, X, Loader2, Edit2, Trash2, Check, Download } from 'lucide-react';
import { addDocWithAudit } from '@/utils/auditTrail';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdAt: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatedAt?: any;
}

export default function UploadAcRules() {
    const { user, userRole } = useAuth();
    const [rules, setRules] = useState<ACRule[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');

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

    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 
        'application/pdf', 
        'text/csv', 'application/vnd.ms-excel'
    ];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (!allowedTypes.includes(selectedFile.type)) {
                setError('Invalid file type. Please upload an image, PDF, or CSV.');
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
            if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
                setError('File size must be less than 10MB.');
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
            setFile(selectedFile);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !file) {
            setError('Please provide a title and select a file.');
            return;
        }

        setIsUploading(true);
        setError(null);
        setSuccessMsg(null);

        try {
            // Upload to Cloudinary
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'ac_rules');

            const uploadRes = await fetch('/api/images/upload', {
                method: 'POST',
                body: formData,
            });

            if (!uploadRes.ok) {
                const errorData = await uploadRes.json();
                throw new Error(errorData.error || 'Failed to upload file');
            }

            const data = await uploadRes.json();
            const { url, publicId, format } = data.data;

            // Save to Firestore
            await addDocWithAudit(collection(db!, 'ac_rules'), {
                title: title.trim(),
                description: description.trim(),
                fileUrl: url,
                publicId: publicId,
                fileType: file.type || format || 'unknown',
                uploadedBy: user?.uid,
                uploaderName: user?.displayName || user?.email?.split('@')[0] || 'Unknown User',
                uploaderRole: userRole || 'Unknown Role',
                createdAt: serverTimestamp(),
            });

            setSuccessMsg('AC Rule uploaded successfully!');
            setTitle('');
            setDescription('');
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';

            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err: unknown) {
            console.error("Upload error:", err);
            const errorMessage = err instanceof Error ? err.message : 'An error occurred during upload.';
            setError(errorMessage);
        } finally {
            setIsUploading(false);
        }
    };

    const startEditing = (rule: ACRule) => {
        setEditingId(rule.id);
        setEditTitle(rule.title);
        setEditDescription(rule.description || '');
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditTitle('');
        setEditDescription('');
    };

    const handleSaveEdit = async (ruleId: string) => {
        if (!editTitle.trim()) return;
        try {
            const ruleRef = doc(db!, 'ac_rules', ruleId);
            await updateDoc(ruleRef, {
                title: editTitle.trim(),
                description: editDescription.trim(),
                updatedAt: serverTimestamp()
            });
            setEditingId(null);
        } catch (err) {
            console.error("Error updating rule:", err);
            setError("Failed to update the rule.");
        }
    };

    const handleDelete = async (rule: ACRule) => {
        if (!confirm(`Are you sure you want to delete "${rule.title}"?`)) return;
        
        try {
            // Optional: You can also delete the file from Cloudinary via API if you create a delete route.
            // For now, we just delete the firestore document.
            await deleteDoc(doc(db!, 'ac_rules', rule.id));
        } catch (err) {
            console.error("Error deleting rule:", err);
            setError("Failed to delete the rule.");
        }
    };

    const getFileIcon = (fileType: string) => {
        if (fileType.includes('image')) return <ImageIcon className="w-8 h-8 text-blue-500" />;
        if (fileType.includes('pdf')) return <FileText className="w-8 h-8 text-rose-500" />;
        if (fileType.includes('csv') || fileType.includes('excel')) return <File className="w-8 h-8 text-emerald-500" />;
        return <File className="w-8 h-8 text-slate-500" />;
    };

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Manage AC Rules</h1>
                    <p className="text-slate-500 mt-1">Upload and manage Academic Coordinator rules and guidelines.</p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3">
                    <X className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}
            {successMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-3">
                    <Check className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">{successMsg}</p>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 md:p-8">
                <form onSubmit={handleUpload} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Rule Title <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g., Q1 Academic Guidelines"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Description (Optional)</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Add any extra context..."
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 resize-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Rule File <span className="text-rose-500">*</span></label>
                            <div className="relative group">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".jpg,.jpeg,.png,.gif,.pdf,.csv"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    required
                                />
                                <div className={`w-full h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-all duration-300
                                    ${file ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50 group-hover:border-blue-400 group-hover:bg-blue-50/50'}`}>
                                    {file ? (
                                        <>
                                            <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                                                {getFileIcon(file.type)}
                                            </div>
                                            <p className="text-sm font-bold text-slate-700 truncate max-w-[200px]">{file.name}</p>
                                            <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                <UploadCloud className="w-6 h-6 text-blue-500" />
                                            </div>
                                            <p className="text-sm font-bold text-slate-700">Click or drag file to upload</p>
                                            <p className="text-xs text-slate-500 mt-1">Supports Image, PDF, CSV (Max 10MB)</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-100">
                        <button
                            type="submit"
                            disabled={isUploading || !title || !file}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-500/30"
                        >
                            {isUploading ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Uploading...</>
                            ) : (
                                <><UploadCloud className="w-5 h-5" /> Upload Rule</>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-lg font-black text-slate-800">Uploaded Rules</h2>
                </div>
                
                {loading ? (
                    <div className="p-12 flex justify-center items-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                ) : rules.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 font-medium flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <FileText className="w-8 h-8 text-slate-400" />
                        </div>
                        No AC rules have been uploaded yet.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {rules.map((rule) => (
                            <div key={rule.id} className="p-6 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                                    {getFileIcon(rule.fileType)}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    {editingId === rule.id ? (
                                        <div className="space-y-2">
                                            <input 
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                className="w-full px-3 py-1.5 text-sm font-bold text-slate-900 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                            />
                                            <input 
                                                value={editDescription}
                                                onChange={(e) => setEditDescription(e.target.value)}
                                                placeholder="Description..."
                                                className="w-full px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                            />
                                            <div className="flex gap-2">
                                                <button onClick={() => handleSaveEdit(rule.id)} className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">Save</button>
                                                <button onClick={cancelEditing} className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <h3 className="text-base font-bold text-slate-900 truncate">{rule.title}</h3>
                                            {rule.description && <p className="text-sm text-slate-500 truncate mt-0.5">{rule.description}</p>}
                                            <div className="flex items-center gap-3 mt-2 text-xs font-medium text-slate-400">
                                                <span>By {rule.uploaderName}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                <span>{rule.createdAt?.toDate ? rule.createdAt.toDate().toLocaleDateString() : 'Just now'}</span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-center">
                                    <a 
                                        href={rule.fileUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="View/Download"
                                    >
                                        <Download className="w-5 h-5" />
                                    </a>
                                    {(user?.uid === rule.uploadedBy || userRole?.includes('managing_director')) && editingId !== rule.id && (
                                        <>
                                            <button 
                                                onClick={() => startEditing(rule)}
                                                className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(rule)}
                                                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
