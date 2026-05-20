'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'next/navigation';
import { FaBoxOpen, FaSearch, FaClipboardList, FaMapMarkerAlt, FaTags, FaInfoCircle } from 'react-icons/fa';

interface MaterialItem {
    id: string;
    name: string;
    code: string;
    type: string;
    quantity: string | number;
    unit: string;
    condition: string;
    storeNo: string;
    shelfNo: string;
    model: string;
    imageUrl?: string;
    targetDepartment?: string;
    remarks?: string;
}

const isDeptMatch = (userDept: string | null, targetDept: string | null) => {
    if (!targetDept) return false;
    const t = targetDept.toLowerCase().trim().replace(/_/g, ' ');
    if (!userDept) return false;
    const u = userDept.toLowerCase().trim().replace(/_/g, ' ');

    if (t === u) return true;

    const mappings: { [key: string]: string[] } = {
        'cs': ['computer science', 'computer_science', 'cs'],
        'computer science': ['computer science', 'computer_science', 'cs'],
        'computer_science': ['computer science', 'computer_science', 'cs'],

        'hrm': ['hrm', 'human resource management', 'human resources'],
        'finance': ['finance', 'accounting and finance', 'accounting_finance'],
        'accounting_finance': ['finance', 'accounting and finance', 'accounting_finance'],

        'natural_resource': ['natural resource', 'natural resource management', 'natural_resource_management', 'natural_resource'],
        'natural_resource_management': ['natural resource', 'natural resource management', 'natural_resource_management', 'natural_resource'],

        'peace_development': ['peace and dev', 'peace and development', 'peace_development'],
        'procurement_admin': ['procurement', 'procurement admin', 'procurement_admin'],
        'library_service': ['library', 'library service', 'library_service'],
    };

    if (mappings[u] && mappings[u].includes(t)) return true;
    if (mappings[t] && mappings[t].includes(u)) return true;

    return false;
};

export default function AvailableMaterialsList({ mode: propMode }: { mode?: 'department' | 'personal' }) {
    const { user, department, userRole } = useAuth();
    // Fallback: If department is missing in AuthContext, try to extract it from userRole (e.g., 'hrm_team_leader' -> 'hrm')
    const activeDepartment = department || (userRole ? userRole.split('_')[0] : null);

    const searchParams = useSearchParams();
    const queryMode = searchParams?.get('mode') as 'department' | 'personal' | null;
    const mode = propMode || queryMode || 'department';

    const [materials, setMaterials] = useState<MaterialItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, 'materials'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedItems: MaterialItem[] = [];
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const tDept = data.targetDepartment || '';
                const tUser = data.targetUser || '';

                // Normalize target and user department check
                const matchesDept = isDeptMatch(activeDepartment, tDept);

                let canSee = false;
                if (mode === 'personal') {
                    // "Available Materials for me" — only show materials targeted to this specific user
                    canSee = !!(tUser && user?.uid === tUser);
                } else {
                    // "Available Materials for [DEPARTMENT]" — show all dept materials
                    const normalizedRole = userRole?.toLowerCase().replace(/\s+/g, '_') || '';
                    const isLeader = normalizedRole === 'department_head' || normalizedRole.endsWith('_leader') || normalizedRole.endsWith('_head');

                    if (tUser) {
                        // If targeted to a specific user, ONLY that exact user can see it (in their personal view). 
                        // It does NOT show up in the general department view for anyone, not even leaders.
                        // (Unless the leader is the targeted user themselves, but they'd view it in their personal tab).
                        canSee = false;
                    } else {
                        // If no specific target user, only dept head / team leader sees it, AND dept must match
                        canSee = !!isLeader && matchesDept;
                    }
                }

                if (!canSee) return;

                // Handle array of items (like Model 19)
                if (data.items && Array.isArray(data.items)) {
                    data.items.forEach((item: any, index: number) => {
                        fetchedItems.push({
                            id: `${doc.id}-${index}`,
                            name: item.description || item.materialName || 'Unknown Material',
                            code: item.model || item.serie || item.materialCode || '',
                            type: data.materialType || data.classificationOfStock || '',
                            quantity: item.quantity || 0,
                            unit: item.unit || 'pcs',
                            condition: item.condition || '',
                            storeNo: data.storeNo || '',
                            shelfNo: data.shelfNo || '',
                            model: item.model || data.model || '',
                            imageUrl: item.imageUrl || data.imageUrl,
                            targetDepartment: tDept,
                            remarks: item.remarks || data.remarks || ''
                        });
                    });
                } else if (data.materialName || data.description) {
                    // Handle flat object structure
                    fetchedItems.push({
                        id: doc.id,
                        name: data.materialName || data.description,
                        code: data.materialCode || data.model || '',
                        type: data.materialType || data.classificationOfStock || '',
                        quantity: data.quantity || 0,
                        unit: data.unit || 'pcs',
                        condition: data.condition || '',
                        storeNo: data.storeNo || '',
                        shelfNo: data.shelfNo || '',
                        model: data.model || '',
                        imageUrl: data.image || data.imageUrl,
                        targetDepartment: tDept,
                        remarks: data.remarks || ''
                    });
                }
            });
            setMaterials(fetchedItems);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [activeDepartment, userRole, user]);

    const filteredMaterials = materials.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <span className="ml-3 font-semibold text-lg">Loading materials...</span>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <FaBoxOpen className="w-8 h-8 text-blue-600 p-1.5 bg-blue-50 rounded-xl" />
                        {mode === 'personal' ? 'Available Materials for Me' : 'Available Materials'}
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                        {mode === 'personal' 
                            ? 'Materials specifically assigned to you'
                            : `Materials available for your department (${activeDepartment ? activeDepartment.toUpperCase() : 'General'})`}
                    </p>
                    {mode === 'personal' && (
                        <p className="text-xs text-gray-400 mt-2">
                            Debug: Your Account UID is {user?.uid}
                        </p>
                    )}
                </div>

                <div className="relative max-w-md w-full">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaSearch className="text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by material name or code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-full p-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all text-sm outline-none bg-gray-50/50 focus:bg-white"
                    />
                </div>
            </div>

            {filteredMaterials.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                    <div className="w-20 h-20 mx-auto bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <FaClipboardList className="text-gray-300 text-3xl" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-700 mb-1">No Materials Found</h3>
                    <p className="text-gray-500 max-w-sm mx-auto">
                        There are currently no materials specifically allocated or available for your department matching this criteria.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                                    <th className="p-4 pl-6">Material Item</th>
                                    <th className="p-4">Code / SKU</th>
                                    <th className="p-4">Type</th>
                                    <th className="p-4">Stock Qty</th>
                                    <th className="p-4">Model</th>
                                    <th className="p-4 pr-6 w-1/4">Remarks / Note</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredMaterials.map((material) => (
                                    <tr key={material.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="p-4 pl-6">
                                            <div className="flex items-center gap-3">
                                                {material.imageUrl ? (
                                                    <div className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-200 shadow-sm">
                                                        <img src={material.imageUrl} alt={material.name} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="w-11 h-11 rounded-lg bg-indigo-50/80 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-100 shadow-sm">
                                                        <FaBoxOpen className="text-xl" />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-bold text-slate-800 text-[14px] leading-tight">{material.name}</p>
                                                    {material.condition && (
                                                        <p className="text-[11px] text-slate-500 capitalize mt-0.5">{material.condition.replace(/_/g, ' ')}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {material.code ? (
                                                <span className="font-mono text-[12px] font-bold text-slate-600 bg-slate-100/80 px-2 py-1 rounded-md border border-slate-200/60 shadow-sm">
                                                    {material.code}
                                                </span>
                                            ) : <span className="text-slate-400 text-xs italic">-</span>}
                                        </td>
                                        <td className="p-4">
                                            {material.type ? (
                                                <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-600">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                                                    <span className="capitalize">{material.type.replace(/_/g, ' ')}</span>
                                                </div>
                                            ) : <span className="text-slate-400 text-xs italic">-</span>}
                                        </td>
                                        <td className="p-4">
                                            <div className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg text-[13px] font-black border border-indigo-100/80 shadow-sm">
                                                {material.quantity} <span className="text-indigo-500/80 font-semibold">{material.unit}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-[12px] text-slate-600 font-medium">
                                            {material.model ? (
                                                <span className="text-slate-800">{material.model}</span>
                                            ) : <span className="text-slate-400 italic">-</span>}
                                        </td>
                                        <td className="p-4 pr-6">
                                            {material.remarks ? (
                                                <p className="text-[12px] font-medium text-slate-600 line-clamp-2 leading-relaxed" title={material.remarks}>
                                                    {material.remarks}
                                                </p>
                                            ) : <span className="text-slate-400 text-xs italic">No note provided</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
