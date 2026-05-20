'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'next/navigation';
import { FaBoxOpen, FaSearch, FaClipboardList } from 'react-icons/fa';
import { FiEye, FiBox, FiExternalLink, FiPrinter, FiX } from 'react-icons/fi';
import Link from 'next/link';
import { getAssetProfilePath, getAssetCode, isFixedAsset } from '@/utils/assetIdentity';

interface MaterialItem {
    id: string;
    name: string;
    code: string;
    type: string;
    materialType?: string;
    category?: string;
    quantity: string | number;
    unit: string;
    condition: string;
    storeNo: string;
    shelfNo: string;
    model: string;
    imageUrl?: string;
    targetDepartment?: string;
    remarks?: string;
    unitPrice?: number;
    currency?: string;
    assetCode?: string;
    rawDoc?: any;
    rawItem?: any;
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
const isAcademicDept = (targetDept: string | null) => {
    if (!targetDept) return false;
    const t = targetDept.toLowerCase().trim().replace(/_/g, ' ');
    return [
        'cs', 'computer science', 'natural resource', 'peace', 'academic', 'it', 'engineering',
        'agribusiness', 'animal', 'economics', 'forester', 'horticulture', 'management', 'plant', 'veterinary', 'common course', 'accounting_finance'
    ].some(d => t.includes(d));
};

const isAdminDept = (targetDept: string | null) => {
    if (!targetDept) return false;
    const t = targetDept.toLowerCase().trim().replace(/_/g, ' ');
    return ['hrm', 'human resource', 'finance', 'accounting', 'procurement', 'library', 'admin', 'registrar', 'security', 'student'].some(d => t.includes(d));
};

const getDepartmentLabel = (id: string) => {
    const deps: { [key: string]: string } = {
        'hrm': 'Human Resource Mgt',
        'finance': 'Finance',
        'procurement_admin': 'Procurement Admin',
        'resource_development': 'Resource Dev & Revenue',
        'building_renovation': 'Building Renovation',
        'library_service': 'Library Service',
        'security': 'Security',
        'registrar': 'Registrar',
        'student_service': 'Student Service',
        'accounting_finance': 'ACCOUNTING AND FINANCE',
        'agribusiness': 'Agribusiness',
        'animal_science': 'Animal Science',
        'computer_science': 'Computer Science',
        'economics': 'Economics',
        'general_forester': 'General Forester',
        'horticulture': 'Horticulture',
        'management': 'Management',
        'natural_resource_management': 'Natural Resource',
        'plant_science': 'Plant Science',
        'peace_development': 'Peace and Dev',
        'veterinary_science': 'Veterinary Science',
        'common_course': 'Common Course'
    };
    return deps[id] || id.replace(/_/g, ' ').toUpperCase();
};

const getClassificationLabel = (id: string) => {
    const classifications: { [key: string]: string } = {
        'vehicles': 'Vehicles',
        'computers': 'Computers & IT Equipments',
        'office_equipments': 'Office Equipments',
        'furnitures': 'Furnitures & Fittings',
        'plant_machinery': 'Plant & Machinery',
        'buildings': 'Buildings',
        'stationery': 'Stationery',
        'cleaning': 'Cleaning Supplies',
        'maintenance': 'Maintenance Supplies',
        'other': 'Other Consumables'
    };
    return classifications[id] || id.replace(/_/g, ' ').toUpperCase();
};

export default function AvailableMaterialsList({ mode: propMode, targetUserId }: { mode?: 'department' | 'personal' | 'executive_academic' | 'executive_admin' | 'specific_user', targetUserId?: string | null }) {
    const { user, department, userRole } = useAuth();
    // Fallback: If department is missing in AuthContext, try to extract it from userRole (e.g., 'hrm_team_leader' -> 'hrm')
    const activeDepartment = department || (userRole ? userRole.split('_')[0] : null);

    const searchParams = useSearchParams();
    const queryMode = searchParams?.get('mode') as 'department' | 'personal' | 'executive_academic' | 'executive_admin' | 'specific_user' | null;
    const mode = propMode || queryMode || 'department';

    const [materials, setMaterials] = useState<MaterialItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [subDeptFilter, setSubDeptFilter] = useState<string | null>(null);
    const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null);

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
                    canSee = !!(tUser && user?.uid === tUser);
                } else if (mode === 'specific_user') {
                    canSee = !!(tUser && targetUserId === tUser);
                } else if (mode === 'executive_academic') {
                    const isAca = isAcademicDept(tDept);
                    canSee = !tUser && isAca;
                    if (canSee && subDeptFilter && subDeptFilter !== 'all') {
                        canSee = tDept?.toLowerCase().includes(subDeptFilter.toLowerCase()) || false;
                    }
                } else if (mode === 'executive_admin') {
                    const isAdm = isAdminDept(tDept);
                    canSee = !tUser && isAdm;
                    if (canSee && subDeptFilter && subDeptFilter !== 'all') {
                        canSee = tDept?.toLowerCase().includes(subDeptFilter.toLowerCase()) || false;
                    }
                } else {
                    const normalizedRole = userRole?.toLowerCase().replace(/\s+/g, '_') || '';
                    const isLeader = normalizedRole === 'department_head' || normalizedRole.endsWith('_leader') || normalizedRole.endsWith('_head');

                    if (tUser) {
                        canSee = false;
                    } else {
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
                            code: item.model || item.serie || item.materialCode || item.itemNo || '',
                            type: data.materialType || data.classificationOfStock || '',
                            materialType: data.materialType || 'consumable',
                            category: data.classificationOfStock || data.category || '',
                            quantity: item.quantity || 0,
                            unit: item.unit || 'pcs',
                            condition: item.condition || '',
                            storeNo: data.storeNo || '',
                            shelfNo: data.shelfNo || '',
                            model: item.model || data.model || '',
                            imageUrl: item.imageUrl || item.image || data.imageUrl || data.image,
                            targetDepartment: tDept,
                            remarks: item.remarks || item.remark || data.remarks || '',
                            unitPrice: Number(item.unitPriceBirr) || Number(item.unitPrice) || 0,
                            currency: data.currency || 'ETB',
                            assetCode: data.assetCode || '',
                            rawDoc: data,
                            rawItem: item
                        });
                    });
                } else if (data.materialName || data.description) {
                    // Handle flat object structure
                    fetchedItems.push({
                        id: doc.id,
                        name: data.materialName || data.description,
                        code: data.materialCode || data.model || '',
                        type: data.materialType || data.classificationOfStock || '',
                        materialType: data.materialType || 'consumable',
                        category: data.category || data.classificationOfStock || '',
                        quantity: data.quantity || 0,
                        unit: data.unit || 'pcs',
                        condition: data.condition || '',
                        storeNo: data.storeNo || '',
                        shelfNo: data.shelfNo || '',
                        model: data.model || '',
                        imageUrl: data.image || data.imageUrl,
                        targetDepartment: tDept,
                        remarks: data.remarks || '',
                        unitPrice: Number(data.unitPrice) || Number(data.unitPriceBirr) || 0,
                        currency: data.currency || 'ETB',
                        assetCode: data.assetCode || '',
                        rawDoc: data
                    });
                }
            });
            setMaterials(fetchedItems);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [activeDepartment, userRole, user, mode, subDeptFilter, targetUserId]);

    // Reset sub filter when mode changes
    useEffect(() => {
        setSubDeptFilter('all');
    }, [mode]);

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
                        {mode === 'personal' ? 'Available Materials for Me' : 
                         mode === 'specific_user' ? 'Materials Assigned to User' :
                         mode === 'executive_academic' ? 'Available for Academic Staff' :
                         mode === 'executive_admin' ? 'Available for Administrative Staff' :
                         'Available Materials'}
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                        {mode === 'personal' 
                            ? 'Materials specifically assigned to you'
                            : mode === 'specific_user'
                            ? 'Materials specifically assigned to the selected user'
                            : mode === 'executive_academic'
                            ? 'Materials designated for academic departments'
                            : mode === 'executive_admin'
                            ? 'Materials designated for administrative departments'
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

            {/* Sub-department filters */}
            {mode === 'executive_academic' && (
                <div className="flex flex-wrap gap-2 px-1">
                    {[
                        { id: 'all', label: 'All Academic' },
                        { id: 'computer_science', label: 'Computer Science' },
                        { id: 'natural_resource', label: 'Natural Resource' },
                        { id: 'peace', label: 'Peace & Dev' },
                        { id: 'agribusiness', label: 'Agribusiness' },
                        { id: 'animal', label: 'Animal Science' },
                        { id: 'plant', label: 'Plant Science' },
                        { id: 'veterinary', label: 'Veterinary' },
                        { id: 'accounting_finance', label: 'Accounting (Academics)' }
                    ].map(dept => (
                        <button
                            key={dept.id}
                            onClick={() => setSubDeptFilter(dept.id)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                                (subDeptFilter || 'all') === dept.id 
                                ? 'bg-blue-600 text-white shadow-sm' 
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {dept.label}
                        </button>
                    ))}
                </div>
            )}

            {mode === 'executive_admin' && (
                <div className="flex flex-wrap gap-2 px-1">
                    {[
                        { id: 'all', label: 'All Admin' },
                        { id: 'hrm', label: 'HRM' },
                        { id: 'finance', label: 'Finance' },
                        { id: 'procurement', label: 'Procurement' },
                        { id: 'registrar', label: 'Registrar' },
                        { id: 'student', label: 'Student Service' },
                        { id: 'library', label: 'Library' }
                    ].map(dept => (
                        <button
                            key={dept.id}
                            onClick={() => setSubDeptFilter(dept.id)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                                (subDeptFilter || 'all') === dept.id 
                                ? 'bg-emerald-600 text-white shadow-sm' 
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {dept.label}
                        </button>
                    ))}
                </div>
            )}

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
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 w-8">#</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500">ዕቃ (Material)</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500">ዓይነት (Type)</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500">ብዛት (Qty)</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500">ዋጋ (Price)</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500">ሁኔታ (Status)</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right">ዝርዝር</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredMaterials.map((m, idx) => {
                                    const qty = Number(m.quantity) || 0;
                                    const isLowStock = qty <= 5 && qty > 0;
                                    const isOutOfStock = qty === 0;
                                    const mockMat = { materialType: m.materialType, assetCode: m.assetCode, id: m.id } as any;

                                    return (
                                        <tr key={m.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-4 py-3 text-xs text-gray-400 w-8">
                                                {idx + 1}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 relative">
                                                        {m.imageUrl ? (
                                                            <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <FiBox className="m-auto text-gray-300 text-sm h-full" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-800 text-sm truncate">{m.name}</p>
                                                        {m.code && m.code !== 'N/A' && (
                                                            <p className="text-[10px] text-gray-400 font-mono">{m.code}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${m.materialType === 'fixed_asset'
                                                    ? 'bg-indigo-50 text-indigo-700'
                                                    : 'bg-green-50 text-green-700'
                                                    }`}>
                                                    {m.materialType === 'fixed_asset' ? 'Fixed' : 'Consumable'}
                                                </span>
                                                {m.category && <p className="text-[10px] text-gray-400 mt-0.5">{m.category}</p>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`font-bold text-sm ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-gray-800'}`}>
                                                    {qty}
                                                </span>
                                                <span className="text-[10px] text-gray-400 ml-1">{m.unit}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {m.unitPrice && m.unitPrice > 0 ? `${m.unitPrice.toLocaleString()} ${m.currency || 'ETB'}` : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {isOutOfStock ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600">Empty Stock</span>
                                                ) : isLowStock ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600">Low Stock</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-600">In Stock</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {isFixedAsset(mockMat) && (
                                                        <Link
                                                            href={getAssetProfilePath(mockMat)}
                                                            className="px-2 py-1.5 text-[10px] font-black text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            title="Open QR Asset Profile"
                                                        >
                                                            QR
                                                        </Link>
                                                    )}
                                                    <button
                                                        onClick={() => setSelectedMaterial(m)}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <FiEye className="text-base" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* View Details Modal (Model 19 Format) */}
            {selectedMaterial && (() => {
                const currentEntry = selectedMaterial.rawItem || selectedMaterial.rawDoc;
                const mockMat = { materialType: selectedMaterial.materialType, assetCode: selectedMaterial.assetCode, id: selectedMaterial.id } as any;

                return (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:absolute print:inset-0 print:block print:bg-white print:p-0 print:m-0" onClick={() => setSelectedMaterial(null)}>
                        <div className="bg-white w-full max-w-[1000px] max-h-[90vh] rounded-xl shadow-2xl overflow-y-auto print:absolute print:top-0 print:left-0 print:max-w-none print:w-[210mm] print:max-h-none print:overflow-visible print:shadow-none print:m-0 print:p-0 print:rounded-none" onClick={(e) => e.stopPropagation()}>
                            <div className="sticky top-0 right-0 p-4 flex justify-between items-center bg-white/90 backdrop-blur-md border-b border-gray-100 z-10 print:hidden">
                                <div />
                                <div className="flex items-center gap-2">
                                    {isFixedAsset(mockMat) && (
                                        <Link
                                            href={getAssetProfilePath(mockMat)}
                                            className="px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded hover:bg-indigo-100 transition-colors flex items-center gap-2 font-bold shadow-sm"
                                        >
                                            <FiExternalLink className="text-lg" /> Asset Profile
                                        </Link>
                                    )}
                                    <button onClick={() => window.print()} className="px-4 py-2 bg-gray-100 border border-gray-300 text-slate-800 rounded hover:bg-gray-200 transition-colors flex items-center gap-2 font-bold shadow-sm">
                                        <FiPrinter className="text-xl" /> Print
                                    </button>
                                    <button onClick={() => setSelectedMaterial(null)} className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg text-gray-500 transition-colors flex items-center gap-2 font-bold">
                                        <FiX className="text-xl" /> Close
                                    </button>
                                </div>
                            </div>

                            <div id="printable-receipt" className="p-8 md:p-12 font-serif bg-[#FDFCF8] print:p-4 print:text-[11px]" style={{ color: '#1a1a1a' }}>
                                {/* Header Row 1: Model / Serial / Receipt No */}
                                <div className="flex justify-between items-start mb-6 print:mb-2">
                                    <div className="w-[150px]">
                                        <p className="text-[14px] font-bold leading-tight">ሞዴል ፲፱</p>
                                        <p className="text-[12px] italic">Model 19</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[14px] font-bold leading-tight">ሴሪ ሀ/13</p>
                                        <p className="text-[12px] italic">Serial A/13</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[20px] font-bold">ቁ.</span>
                                        <div className="w-[140px] border-b border-black h-[24px] relative">
                                            <div className="absolute inset-0 flex items-center justify-center text-[16px] font-bold tracking-widest">{currentEntry.materialCode || selectedMaterial.code || 'N/A'}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Row 2: Emblem + Gov Text | Numbered lines */}
                                <div className="flex justify-between gap-8 mb-6 print:mb-2">
                                    <div className="w-[450px] flex flex-col items-center justify-start mt-[-40px] shrink-0 print:mt-[-20px]">
                                        <div className="w-[70px] h-[70px] rounded-full flex items-center justify-center shrink-0 mb-3 print:mb-1 print:w-[60px] print:h-[60px]" style={{ filter: 'grayscale(1) contrast(1000%) brightness(1.1)', opacity: 0.9 }}>
                                            <img src="https://upload.wikimedia.org/wikipedia/commons/3/3f/Emblem_of_Ethiopia.svg" alt="Emblem of Ethiopia" className="w-full h-full object-contain" />
                                        </div>
                                        <div className="flex flex-col text-center justify-center w-full">
                                            <p className="text-[14px] font-bold leading-tight print:text-[12px]">በኢትዮጵያ ፌዴራላዊ ዲሞክራሲያዊ ሪፐብሊክ</p>
                                            <p className="text-[11px] font-bold leading-tight uppercase print:text-[9px]">The Federal Democratic Republic of Ethiopia</p>
                                            <p className="text-[14px] font-bold leading-tight mt-2 print:mt-1 print:text-[12px]">የገንዘብና ኢኮኖሚ ትብብር ሚኒስቴር</p>
                                            <p className="text-[11px] font-bold leading-tight uppercase print:text-[9px]">Ministry of Finance and</p>
                                            <p className="text-[11px] font-bold leading-tight uppercase print:text-[9px]">Economic Cooperation</p>
                                        </div>
                                    </div>

                                    <div className="flex-1 text-[12px] space-y-4 print:space-y-2 print:text-[10px]">
                                        <div className="flex items-end">
                                            <span className="shrink-0 whitespace-nowrap">1. ዋጋው በገንዘብ ወጪ መዝገብ የተመዘገበት ተራ ቁጥር</span>
                                            <div className="flex-1 border-b border-black ml-3 h-[18px] flex items-end justify-center font-bold pb-[2px] print:h-[14px]">
                                                {currentEntry.expenditureRegistryNo || '—'}
                                            </div>
                                        </div>
                                        <p className="text-[10px] italic pl-4 -mt-1 print:text-[8px] print:-mt-0.5">Item No. In Expenditure Registry</p>

                                        <div className="flex items-end">
                                            <span className="shrink-0 whitespace-nowrap">2. ዕቃ ገቢ መዝገብ የገባበት ገጽ</span>
                                            <div className="flex-1 border-b border-black ml-3 h-[18px] flex items-end justify-center font-bold pb-[2px] print:h-[14px]">
                                                {currentEntry.incomingGoodsEntryNo || '—'}
                                            </div>
                                        </div>
                                        <p className="text-[10px] italic pl-4 -mt-1 print:text-[8px] print:-mt-0.5">No. of entry in the register of incoming goods</p>

                                        <div className="flex items-end">
                                            <span className="shrink-0 whitespace-nowrap">3. ለዕቃው የተሰጠው መደብ</span>
                                            <div className="flex-1 border-b border-black ml-3 h-[18px] flex items-end justify-center font-bold pb-[2px] print:h-[14px]">
                                                {getClassificationLabel(currentEntry.classificationOfStock || selectedMaterial.category || '') || (selectedMaterial.materialType === 'fixed_asset' ? 'Fixed Asset' : 'Consumable')}
                                            </div>
                                        </div>
                                        <p className="text-[10px] italic pl-4 -mt-1 print:text-[8px] print:-mt-0.5">Classification of stock</p>

                                        <div className="flex items-end">
                                            <span className="shrink-0 whitespace-nowrap">4. ዕቃው የሚቀመጥበት መጋዝን ቁጥር</span>
                                            <div className="flex-1 border-b border-black ml-3 h-[18px] flex items-end justify-center font-bold pb-[2px] print:h-[14px]">
                                                {currentEntry.storeLocation || selectedMaterial.storeNo || '—'}
                                            </div>
                                        </div>
                                        <p className="text-[10px] italic pl-4 -mt-1 print:text-[8px] print:-mt-0.5">Store No.</p>

                                        <div className="flex items-end">
                                            <span className="shrink-0 whitespace-nowrap">5. የመደርደሪያው ቁጥር</span>
                                            <div className="flex-1 border-b border-black ml-3 h-[18px] flex items-end justify-center font-bold pb-[2px] print:h-[14px]">
                                                {currentEntry.shelfNumber || selectedMaterial.shelfNo || '—'}
                                            </div>
                                        </div>
                                        <p className="text-[10px] italic pl-4 -mt-1 print:text-[8px] print:-mt-0.5">Shelf No.</p>
                                    </div>
                                </div>

                                <div className="mb-8 relative w-[350px] print:mb-2">
                                    <div className="flex items-end">
                                        <span className="text-[14px] font-bold leading-tight mr-2 print:text-[12px]">የ</span>
                                        <div className="flex-1 border-b border-black h-[22px] flex items-end justify-center font-bold pb-1 text-[13px] print:h-[16px] print:text-[11px] print:pb-0">
                                            {getDepartmentLabel(currentEntry.department || selectedMaterial.targetDepartment || '')}
                                        </div>
                                    </div>
                                    <div className="text-[11px] italic ml-10 mt-1 leading-none print:text-[9px]">
                                        Department
                                    </div>
                                </div>

                                <div className="text-center mb-8 mt-2 relative print:mb-4 print:mt-1">
                                    <p className="text-[20px] font-bold tracking-[0.2em] print:text-[16px]">
                                        የዕቃ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ወይም &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; የንብረት &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ገቢ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ደረሰኝ
                                    </p>
                                    <p className="text-[13px] font-bold tracking-[0.05em] mt-1 border-b-[1.5px] border-black inline-block pb-0.5 print:text-[11px]">
                                        RECEIPT FOR ARTICLES OR PROPERTY RECEIVED
                                    </p>
                                </div>

                                <div className="space-y-2 mb-6 text-[12px] leading-relaxed print:mb-2 print:text-[10px]">
                                    <div className="relative">
                                        <div className="flex items-end">
                                            <span className="text-[14px] font-bold whitespace-nowrap mr-2 leading-tight print:text-[12px]">ስም</span>
                                            <div className="w-[45%] border-b border-black h-[18px] flex items-end justify-center font-bold text-[14px] print:h-[14px] print:text-[12px]">
                                                {currentEntry.responsiblePerson || '—'}
                                            </div>
                                            <span className="text-[14px] font-bold whitespace-nowrap ml-4 leading-tight print:text-[12px]">ከዚህ በታች በዝርዝር የተመለከተውን</span>
                                            <div className="flex-1 border-b border-black h-[18px] ml-2 print:h-[14px]"></div>
                                        </div>
                                        <div className="flex text-[11px] italic mt-1 leading-none print:text-[9px]">
                                            <span className="ml-[60px]">Name</span>
                                            <span className="ml-[45%]">Received the following</span>
                                        </div>
                                    </div>

                                    <div className="flex items-end gap-1 relative mt-3 print:mt-2">
                                        <div className="w-[20%] border-b border-black h-[18px] print:h-[14px]"></div>
                                        <span className="text-[14px] font-bold whitespace-nowrap ml-2 leading-tight print:text-[12px]">ቀን ፳፻</span>
                                        <div className="w-[60px] border-b border-black h-[18px] flex items-end justify-center font-bold text-[14px] print:h-[14px] print:text-[12px]">
                                            {currentEntry.purchaseDate || '—'}
                                        </div>
                                        <span className="text-[14px] font-bold whitespace-nowrap leading-tight print:text-[12px]">ዓ.ም</span>

                                        <span className="text-[14px] font-bold whitespace-nowrap ml-8 leading-tight print:text-[12px]">ከ</span>
                                        <div className="flex-1 border-b border-black h-[18px] flex items-end justify-center font-bold text-[14px] print:h-[14px] print:text-[12px]">
                                            {currentEntry.vendorName || '—'}
                                        </div>
                                        <span className="text-[14px] font-bold whitespace-nowrap leading-tight print:text-[12px]">ተቀብያለሁ ::</span>
                                    </div>
                                    <div className="flex text-[11px] italic mt-1 leading-none print:text-[9px]">
                                        <span className="ml-[25%]">Day 20</span>
                                        <span className="ml-[24%]">From</span>
                                    </div>
                                </div>

                                <table className="w-full border-collapse border-[1.5px] border-black text-[12px] mb-8 print:mb-2 print:text-[10px]">
                                    <thead>
                                        <tr className="h-[40px] print:h-[30px]">
                                            <th rowSpan={2} className="border border-black w-[45px] text-center p-0 align-middle print:w-[35px]">
                                                <div className="font-bold">ተ.ቁ</div>
                                                <div className="text-[9px] italic leading-tight print:text-[7px]">Serial<br />No.</div>
                                                <div className="text-[8px] mt-1 print:text-[6px]">This</div>
                                            </th>
                                            <th rowSpan={2} className="border border-black px-2 align-middle min-w-[250px]">
                                                <div className="font-bold text-center">የዕቃው ወይም የንብረት ዓይነት ዝርዝር</div>
                                                <div className="text-[10px] italic text-center print:text-[8px]">Detailed Description of Articles or Property</div>
                                            </th>
                                            <th rowSpan={2} className="border border-black w-[60px] text-center align-middle print:w-[45px]">
                                                <div className="font-bold">ሞዴል</div>
                                                <div className="text-[9px] italic print:text-[7px]">Model</div>
                                            </th>
                                            <th rowSpan={2} className="border border-black w-[50px] text-center align-middle print:w-[40px]">
                                                <div className="font-bold">ሴሪ</div>
                                                <div className="text-[9px] italic print:text-[7px]">Serie</div>
                                            </th>
                                            <th colSpan={2} className="border border-black text-center h-[20px] print:h-[16px]">
                                                <div className="font-bold">ተከታታይ ገ.</div>
                                                <div className="text-[9px] italic mt-[-2px] print:text-[7px]">Page No.</div>
                                            </th>
                                            <th rowSpan={2} className="border border-black w-[60px] text-center align-middle print:w-[40px]">
                                                <div className="font-bold">ብዛት</div>
                                                <div className="text-[9px] italic print:text-[7px]">Quantity</div>
                                            </th>
                                            <th colSpan={2} className="border border-black text-center h-[20px] print:h-[16px]">
                                                <div className="font-bold">የአንዱ ዋጋ</div>
                                                <div className="text-[9px] italic mt-[-2px] print:text-[7px]">Unit price</div>
                                            </th>
                                            <th colSpan={2} className="border border-black text-center h-[20px] print:h-[16px]">
                                                <div className="font-bold">የዋጋው ድምር</div>
                                                <div className="text-[9px] italic mt-[-2px] print:text-[7px]">Total price</div>
                                            </th>
                                        </tr>
                                        <tr className="h-[35px] print:h-[24px]">
                                            <th className="border border-black w-[35px] text-center print:w-[25px]"><div className="font-bold">ከ</div><div className="text-[9px] italic mt-[-2px] print:text-[7px]">From</div></th>
                                            <th className="border border-black w-[35px] text-center print:w-[25px]"><div className="font-bold">እስከ</div><div className="text-[9px] italic mt-[-2px] print:text-[7px]">To</div></th>
                                            <th className="border border-black w-[50px] text-center print:w-[40px]"><div className="font-bold">ብር</div><div className="text-[9px] italic mt-[-2px] print:text-[7px]">Birr</div></th>
                                            <th className="border border-black w-[30px] text-center print:w-[20px]"><div className="font-bold">ሳ</div><div className="text-[9px] italic mt-[-2px] print:text-[7px]">C</div></th>
                                            <th className="border border-black w-[50px] text-center print:w-[40px]"><div className="font-bold">ብር</div><div className="text-[9px] italic mt-[-2px] print:text-[7px]">Birr</div></th>
                                            <th className="border border-black w-[30px] text-center print:w-[20px]"><div className="font-bold">ሳ</div><div className="text-[9px] italic mt-[-2px] print:text-[7px]">C</div></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from({ length: 15 }).map((_, i) => {
                                            if (i === 0) {
                                                return (
                                                    <tr key={i} className="h-[26px] print:h-[20px]">
                                                        <td className="border border-black text-center print:text-[10px]">1</td>
                                                        <td className="border border-black px-2 py-1 relative">
                                                            <div className="font-bold text-[13px] print:text-[10px]">{selectedMaterial.name}</div>
                                                            {currentEntry.description && <div className="text-[10px] text-gray-700 print:text-[8px]">{currentEntry.description}</div>}
                                                            {selectedMaterial.imageUrl && (
                                                                <div className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 print:hidden">
                                                                    <img src={selectedMaterial.imageUrl} alt={selectedMaterial.name} className="object-cover rounded border border-gray-300 w-full h-full" />
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="border border-black text-center print:text-[10px]">{currentEntry.model || selectedMaterial.model || '—'}</td>
                                                        <td className="border border-black text-center print:text-[10px]">{currentEntry.serie || currentEntry.serialNumber || '—'}</td>
                                                        <td className="border border-black text-center print:text-[10px]">{currentEntry.pageFrom || '—'}</td>
                                                        <td className="border border-black text-center print:text-[10px]">{currentEntry.pageTo || '—'}</td>
                                                        <td className="border border-black text-center font-bold print:text-[10px]">{currentEntry.originalQuantity || selectedMaterial.quantity}</td>
                                                        <td className="border border-black text-center font-bold print:text-[10px]">{Math.floor(selectedMaterial.unitPrice || 0)}</td>
                                                        <td className="border border-black text-center text-[10px] print:text-[8px]">
                                                            {currentEntry.unitPriceCents !== undefined
                                                                ? currentEntry.unitPriceCents.toString().padStart(2, '0')
                                                                : Math.round(((selectedMaterial.unitPrice || 0) % 1) * 100).toString().padStart(2, '0')}
                                                        </td>
                                                        <td className="border border-black text-center font-bold bg-[#fcfcfc] print:text-[10px]">{Math.floor((selectedMaterial.unitPrice || 0) * Number(selectedMaterial.quantity))}</td>
                                                        <td className="border border-black text-center text-[10px] bg-[#fcfcfc] print:text-[8px]">
                                                            {currentEntry.totalPriceCents !== undefined
                                                                ? currentEntry.totalPriceCents.toString().padStart(2, '0')
                                                                : Math.round((((selectedMaterial.unitPrice || 0) * Number(selectedMaterial.quantity)) % 1) * 100).toString().padStart(2, '0')}
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            return (
                                                <tr key={i} className="h-[26px] print:h-[20px]">
                                                    <td className="border border-black text-center">{i + 1}</td>
                                                    <td className="border border-black px-2 py-1"></td>
                                                    <td className="border border-black text-center"></td>
                                                    <td className="border border-black text-center"></td>
                                                    <td className="border border-black text-center"></td>
                                                    <td className="border border-black text-center"></td>
                                                    <td className="border border-black text-center"></td>
                                                    <td className="border border-black text-center"></td>
                                                    <td className="border border-black text-center"></td>
                                                    <td className="border border-black text-center bg-[#fcfcfc]"></td>
                                                    <td className="border border-black text-center bg-[#fcfcfc]"></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="h-[36px] print:h-[24px]">
                                            <td colSpan={6} className="border-none"></td>
                                            <td className="border border-black border-t-[1.5px] border-r-0 text-right pr-2 leading-tight" style={{ borderWidth: '1px', borderTopWidth: '1.5px', borderRightWidth: '0' }}>
                                                <div className="font-bold text-[13px] print:text-[11px]">ድምር</div><div className="text-[11px] italic mt-[-2px] print:text-[9px]">Total</div>
                                            </td>
                                            <td className="border border-black border-t-[1.5px] text-center font-bold text-[14px] print:text-[11px]">{Math.floor(selectedMaterial.unitPrice || 0)}</td>
                                            <td className="border border-black border-t-[1.5px] text-center font-bold text-[12px] print:text-[10px]">
                                                {currentEntry.unitPriceCents !== undefined
                                                    ? currentEntry.unitPriceCents.toString().padStart(2, '0')
                                                    : Math.round(((selectedMaterial.unitPrice || 0) % 1) * 100).toString().padStart(2, '0')}
                                            </td>
                                            <td className="border border-black border-t-[1.5px] text-center font-bold text-[15px] print:text-[12px]">{Math.floor((selectedMaterial.unitPrice || 0) * Number(selectedMaterial.quantity))}</td>
                                            <td className="border border-black border-t-[1.5px] text-center font-bold text-[13px] print:text-[11px]">
                                                {currentEntry.totalPriceCents !== undefined
                                                    ? currentEntry.totalPriceCents.toString().padStart(2, '0')
                                                    : Math.round((((selectedMaterial.unitPrice || 0) * Number(selectedMaterial.quantity)) % 1) * 100).toString().padStart(2, '0')}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>

                                <div className="flex justify-between mb-12 print:mb-4">
                                    <div className="w-[280px] text-center">
                                        <p className="font-bold text-[15px] print:text-[12px]">አስረካቢው</p>
                                        <p className="text-[12px] italic mb-8 print:mb-2 print:text-[10px]">Deliverer (Donor)</p>
                                        <div className="border-b-[1.5px] border-black pb-1 h-[30px] flex items-end justify-center font-bold print:h-[20px]">
                                            {currentEntry.vendorName || '—'}
                                        </div>
                                    </div>
                                    <div className="w-[280px] text-center">
                                        <p className="font-bold text-[15px] print:text-[12px]">ተረካቢው</p>
                                        <p className="text-[12px] italic mb-8 print:mb-2 print:text-[10px]">Deliverer (Recipient)</p>
                                        <div className="border-b-[1.5px] border-black pb-1 h-[30px] flex items-end justify-center font-bold print:h-[20px]">
                                            {currentEntry.delivererRecipient || currentEntry.responsiblePerson || '—'}
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t-[1.5px] border-black pt-4 print:pt-2">
                                    <div className="flex items-start gap-4 text-[11px] leading-relaxed text-justify print:text-[9px]">
                                        <span className="font-bold shrink-0 text-[13px] print:text-[11px]">ማሳሰቢያ:-</span>
                                        <p>ይህ ካርቲ ሦስት ኮፒ ያለው ስለሆነ ሀ/ የመጀመሪያው ኮፒ ለሂሳብ ክፍል ለ/ ሁለተኛው ለገንዘብ ወጪ ክፍል ሐ/ ሦስተኛው ዋናው ለዕቃ ገቢ ክፍል ይላካ :: ገንዘብ ከመሣሪያ ሰነድ ጋር ተያይዞ በወጪ መዝገብ ለገንዘብና ኢኮኖሚ ትብብር ሚኒስቴር ለሒሳብ ማቅረቢያ ይላካል ተያያዘ :: ያዙው ለአስረካቢ ያጣቃ :: ሦስተኛው በማይነቀል ሆኖ ከካርዱ ጋር እንደሆነ ለገባው ማስረጃ ዕቃ ግምጃ ቤት ይቀመጣል :: የዋጋው ድምር በሚለው ውስጥ በብርና ወይም በሌላ ምክንያት የተገኘ ዕቃ ወይም ንብረት የሆነ እንደሆነ ዋጋው ኤክስፐርት ተገምቶ በዋጋው ምትክ ውስጥ ይገባል ::</p>
                                    </div>
                                    <p className="text-right text-[10px] mt-6 font-bold tracking-wider print:text-[8px] print:mt-2">አርቲስቲክ ማተሚያ ድርጅት 000988/10</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
