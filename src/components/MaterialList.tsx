'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, getDocs, where, updateDoc } from 'firebase/firestore';
import {
    FiSearch, FiEye, FiBox, FiTag, FiInfo, FiCalendar,
    FiDollarSign, FiUser, FiMapPin, FiLayers, FiX, FiPackage, FiPrinter
} from 'react-icons/fi';
import Image from 'next/image';

interface Material {
    id: string;
    category: string;
    condition: string;
    createdAt: string;
    currency: string;
    description: string;
    image: string;
    materialCode: string;
    materialName: string;
    materialType: 'fixed_asset' | 'consumable';
    purchaseDate: string;
    quantity: number;
    remarks: string;
    responsiblePerson: string;
    serialNumber: string;
    shelfNumber: string;
    storeLocation: string;
    tags: string;
    totalPrice: number;
    unit: string;
    unitPrice: number;
    vendorName: string;
    warrantyDate: string;
    expiryDate?: string;
    expenditureRegistryNo?: string;
    incomingGoodsEntryNo?: string;
    delivererRecipient?: string;
    model?: string;
    serie?: string;
    pageFrom?: string;
    pageTo?: string;
    totalPriceCents?: number;
    unitPriceCents?: number;
}

interface MaterialListProps {
    typeFilter?: 'fixed_asset' | 'consumable';
}

export default function MaterialList({ typeFilter }: MaterialListProps) {
    const [materials, setMaterials] = useState<Material[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'fixed_asset' | 'consumable'>(typeFilter || 'all');
    const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const reconcileRan = useRef(false);

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db!, 'materials'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const materialList: Material[] = [];

            snapshot.docs.forEach(doc => {
                const d = doc.data();
                if (d.items && Array.isArray(d.items) && (d.formType === 'receipt_for_articles' || (d.items.length > 0 && !d.materialName))) {
                    d.items.forEach((item: any, idx: number) => {
                        if (item.description && typeof item.description === 'string' && item.description.trim()) {
                            materialList.push({
                                id: `${doc.id}_${idx}`,
                                category: d.classificationOfStock || d.category || 'Receipt Item',
                                condition: item.condition || 'New',
                                createdAt: d.createdAt || new Date().toISOString(),
                                currency: d.currency || 'ETB',
                                description: item.remark || '',
                                image: item.imageUrl || item.image || '',
                                materialCode: item.itemNo || d.receiptNo || 'N/A',
                                materialName: item.description.trim(),
                                materialType: d.materialType || 'consumable',
                                purchaseDate: d.day || '',
                                quantity: Number(item.quantity) || 0,
                                remarks: item.remark || '',
                                responsiblePerson: d.recipientName || '',
                                serialNumber: item.itemNo || '',
                                shelfNumber: d.shelfNo || '',
                                storeLocation: d.storeNo || '',
                                tags: '',
                                totalPrice: (Number(item.unitPriceBirr) || 0) * (Number(item.quantity) || 0),
                                unit: item.unit || 'pcs',
                                unitPrice: Number(item.unitPriceBirr) || 0,
                                vendorName: d.delivererDonor || '',
                                warrantyDate: '',
                                expenditureRegistryNo: d.expenditureRegistryNo || '',
                                incomingGoodsEntryNo: d.incomingGoodsEntryNo || '',
                                delivererRecipient: d.delivererRecipient || '',
                                model: item.model || '',
                                serie: item.serie || '',
                                pageFrom: item.pageFrom || '',
                                pageTo: item.pageTo || '',
                                unitPriceCents: Number(item.unitPriceCents) || 0,
                                totalPriceCents: Number(item.totalPriceCents) || 0,
                            } as Material);
                        }
                    });
                } else if (d.materialName) {
                    materialList.push({
                        id: doc.id,
                        ...d
                    } as Material);
                }
            });

            // Sort by name
            materialList.sort((a, b) => (a.materialName || '').localeCompare(b.materialName || ''));
            setMaterials(materialList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // AUTO-RECONCILIATION
    useEffect(() => {
        if (!db || materials.length === 0 || reconcileRan.current) return;
        reconcileRan.current = true;

        const reconcileInventory = async () => {
            try {
                const acceptedQuery = query(
                    collection(db!, 'User-Report'),
                    where('status', '==', 'accepted')
                );
                const acceptedSnap = await getDocs(acceptedQuery);
                const issuedMap: Record<string, number> = {};
                acceptedSnap.docs.forEach(d => {
                    const data = d.data();
                    const name = (data.materialName || '').trim().toLowerCase();
                    const qty = Number(data.quantity) || 0;
                    if (name && qty > 0) {
                        issuedMap[name] = (issuedMap[name] || 0) + qty;
                    }
                });

                if (Object.keys(issuedMap).length === 0) return;

                const materialsSnap = await getDocs(collection(db!, 'materials'));
                for (const matDoc of materialsSnap.docs) {
                    const data = matDoc.data();
                    if (data.items && Array.isArray(data.items)) continue;
                    const materialName = (data.materialName || '').trim().toLowerCase();
                    if (!materialName) continue;
                    const totalIssued = issuedMap[materialName];
                    if (!totalIssued || totalIssued <= 0) continue;
                    const originalQty = Number(data.originalQuantity) || Number(data.quantity) || 0;
                    const correctQty = Math.max(0, originalQty - totalIssued);
                    const currentQty = Number(data.quantity) || 0;
                    if (currentQty !== correctQty) {
                        await updateDoc(matDoc.ref, { quantity: correctQty, originalQuantity: originalQty });
                    }
                }
            } catch (err) {
                console.error('[Reconcile] Error:', err);
            }
        };
        reconcileInventory();
    }, [materials]);

    // Filter
    const filtered = materials.filter(m => {
        const matchesSearch = !searchTerm ||
            (m.materialName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.materialCode || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTab = activeTab === 'all' || m.materialType === activeTab;
        const matchesTypeFilter = !typeFilter || m.materialType === typeFilter;
        return matchesSearch && matchesTab && matchesTypeFilter;
    });

    // Pagination
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginatedMaterials = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Reset page when filter changes
    useEffect(() => { setCurrentPage(1); }, [searchTerm, activeTab]);

    // Counts
    const fixedCount = materials.filter(m => m.materialType === 'fixed_asset').length;
    const consumableCount = materials.filter(m => m.materialType === 'consumable').length;

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-gray-50 pb-10">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 lg:px-10 py-5">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                        <FiPackage className="text-lg" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Full Inventory</h1>
                        <p className="text-sm text-gray-500">የሙሉ ዕቃ ዝርዝር — Complete Material Registry</p>
                    </div>
                </div>
            </div>

            <div className="px-6 lg:px-10 pt-5">
                {/* Tabs + Search Row */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-5">
                    {/* Tabs */}
                    {!typeFilter && (
                        <div className="flex border-b border-gray-100">
                            <button
                                onClick={() => setActiveTab('all')}
                                className={`flex-1 py-3 text-sm font-bold text-center transition-colors border-b-2 ${activeTab === 'all' ? 'text-blue-600 border-blue-600 bg-blue-50/30' : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'}`}
                            >
                                ሁሉም (All) <span className="ml-1 text-xs text-gray-400">({materials.length})</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('fixed_asset')}
                                className={`flex-1 py-3 text-sm font-bold text-center transition-colors border-b-2 ${activeTab === 'fixed_asset' ? 'text-indigo-600 border-indigo-600 bg-indigo-50/30' : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'}`}
                            >
                                🏗️ የማይንቀሳቀስ ንብረት (Fixed Assets) <span className="ml-1 text-xs text-gray-400">({fixedCount})</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('consumable')}
                                className={`flex-1 py-3 text-sm font-bold text-center transition-colors border-b-2 ${activeTab === 'consumable' ? 'text-green-600 border-green-600 bg-green-50/30' : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'}`}
                            >
                                📦 ፍጆታ ዕቃ (Consumables) <span className="ml-1 text-xs text-gray-400">({consumableCount})</span>
                            </button>
                        </div>
                    )}

                    {/* Search */}
                    <div className="p-4 flex items-center gap-4">
                        <div className="relative flex-1">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                            <input
                                type="text"
                                placeholder="ዕቃ ፈልግ... Search material..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                            />
                        </div>
                        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                            {filtered.length} ዕቃዎች
                        </span>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
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
                                {paginatedMaterials.map((m, idx) => {
                                    const isLowStock = m.quantity <= 5 && m.quantity > 0;
                                    const isOutOfStock = m.quantity === 0;

                                    return (
                                        <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-4 py-3 text-xs text-gray-400">
                                                {(currentPage - 1) * itemsPerPage + idx + 1}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 relative">
                                                        {m.image ? (
                                                            <Image src={m.image} alt={m.materialName} fill className="object-cover" />
                                                        ) : (
                                                            <FiBox className="m-auto text-gray-300 text-sm h-full" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-800 text-sm truncate">{m.materialName}</p>
                                                        {m.materialCode && m.materialCode !== 'N/A' && (
                                                            <p className="text-[10px] text-gray-400 font-mono">{m.materialCode}</p>
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
                                                    {m.quantity}
                                                </span>
                                                <span className="text-[10px] text-gray-400 ml-1">{m.unit}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {m.unitPrice > 0 ? `${m.unitPrice.toLocaleString()} ${m.currency || 'ETB'}` : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {isOutOfStock ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600">Out of Stock</span>
                                                ) : isLowStock ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600">Low Stock</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-600">In Stock</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => setSelectedMaterial(m)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <FiEye className="text-base" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {filtered.length === 0 && (
                            <div className="p-12 text-center">
                                <FiBox className="text-3xl text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 text-sm font-medium">ዕቃ አልተገኘም — No materials found</p>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                            <span className="text-xs text-gray-500">
                                ገጽ {currentPage} ከ {totalPages} ({filtered.length} ዕቃዎች)
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    ← ቀዳሚ
                                </button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum: number;
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`w-8 h-8 text-xs font-bold rounded-lg transition-colors ${currentPage === pageNum
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    ቀጣይ →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* View Details Modal (Exact Model 19 Format) */}
            {selectedMaterial && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:absolute print:inset-0 print:block print:bg-white print:p-0 print:m-0" onClick={() => setSelectedMaterial(null)}>
                    <div className="bg-white w-full max-w-[1000px] max-h-[90vh] rounded-xl shadow-2xl overflow-y-auto print:absolute print:top-0 print:left-0 print:max-w-none print:w-[210mm] print:max-h-none print:overflow-visible print:shadow-none print:m-0 print:p-0 print:rounded-none" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 right-0 p-4 flex justify-end bg-white/90 backdrop-blur-md border-b border-gray-100 z-10 print:hidden">
                            <button onClick={() => window.print()} className="px-4 py-2 bg-gray-100 border border-gray-300 text-slate-800 rounded hover:bg-gray-200 transition-colors flex items-center gap-2 font-bold shadow-sm mr-4">
                                <FiPrinter className="text-xl" /> Print
                            </button>
                            <button onClick={() => setSelectedMaterial(null)} className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg text-gray-500 transition-colors flex items-center gap-2 font-bold">
                                <FiX className="text-xl" /> Close
                            </button>
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
                                        <div className="absolute inset-0 flex items-center justify-center text-[16px] font-bold tracking-widest">{selectedMaterial.materialCode || 'N/A'}</div>
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
                                            {selectedMaterial.expenditureRegistryNo || '—'}
                                        </div>
                                    </div>
                                    <p className="text-[10px] italic pl-4 -mt-1 print:text-[8px] print:-mt-0.5">Item No. In Expenditure Registry</p>

                                    <div className="flex items-end">
                                        <span className="shrink-0 whitespace-nowrap">2. ዕቃ ገቢ መዝገብ የገባበት ገጽ</span>
                                        <div className="flex-1 border-b border-black ml-3 h-[18px] flex items-end justify-center font-bold pb-[2px] print:h-[14px]">
                                            {selectedMaterial.incomingGoodsEntryNo || '—'}
                                        </div>
                                    </div>
                                    <p className="text-[10px] italic pl-4 -mt-1 print:text-[8px] print:-mt-0.5">No. of entry in the register of incoming goods</p>

                                    <div className="flex items-end">
                                        <span className="shrink-0 whitespace-nowrap">3. ለዕቃው የተሰጠው መደብ</span>
                                        <div className="flex-1 border-b border-black ml-3 h-[18px] flex items-end justify-center font-bold pb-[2px] print:h-[14px]">
                                            {selectedMaterial.materialType === 'fixed_asset' ? 'Fixed Asset' : 'Consumable'}
                                        </div>
                                    </div>
                                    <p className="text-[10px] italic pl-4 -mt-1 print:text-[8px] print:-mt-0.5">Classification of stock</p>

                                    <div className="flex items-end">
                                        <span className="shrink-0 whitespace-nowrap">4. ዕቃው የሚቀመጥበት መጋዝን ቁጥር</span>
                                        <div className="flex-1 border-b border-black ml-3 h-[18px] flex items-end justify-center font-bold pb-[2px] print:h-[14px]">
                                            {selectedMaterial.storeLocation || '—'}
                                        </div>
                                    </div>
                                    <p className="text-[10px] italic pl-4 -mt-1 print:text-[8px] print:-mt-0.5">Store No.</p>

                                    <div className="flex items-end">
                                        <span className="shrink-0 whitespace-nowrap">5. የመደርደሪያው ቁጥር</span>
                                        <div className="flex-1 border-b border-black ml-3 h-[18px] flex items-end justify-center font-bold pb-[2px] print:h-[14px]">
                                            {selectedMaterial.shelfNumber || '—'}
                                        </div>
                                    </div>
                                    <p className="text-[10px] italic pl-4 -mt-1 print:text-[8px] print:-mt-0.5">Shelf No.</p>
                                </div>
                            </div>

                            <div className="mb-8 relative w-[350px] print:mb-2">
                                <div className="flex items-end">
                                    <span className="text-[14px] font-bold leading-tight mr-2 print:text-[12px]">የ</span>
                                    <div className="flex-1 border-b border-black h-[22px] flex items-end justify-center font-bold pb-1 text-[13px] print:h-[16px] print:text-[11px] print:pb-0">
                                        {selectedMaterial.category || '—'}
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
                                            {selectedMaterial.responsiblePerson || '—'}
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
                                        {selectedMaterial.purchaseDate || '—'}
                                    </div>
                                    <span className="text-[14px] font-bold whitespace-nowrap leading-tight print:text-[12px]">ዓ.ም</span>

                                    <span className="text-[14px] font-bold whitespace-nowrap ml-8 leading-tight print:text-[12px]">ከ</span>
                                    <div className="flex-1 border-b border-black h-[18px] flex items-end justify-center font-bold text-[14px] print:h-[14px] print:text-[12px]">
                                        {selectedMaterial.vendorName || '—'}
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
                                                        <div className="font-bold text-[13px] print:text-[10px]">{selectedMaterial.materialName}</div>
                                                        {selectedMaterial.description && <div className="text-[10px] text-gray-700 print:text-[8px]">{selectedMaterial.description}</div>}
                                                        {selectedMaterial.image && (
                                                            <div className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 print:hidden">
                                                                <Image src={selectedMaterial.image} alt={selectedMaterial.materialName} fill className="object-cover rounded border border-gray-300" />
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="border border-black text-center print:text-[10px]">{selectedMaterial.model || '—'}</td>
                                                    <td className="border border-black text-center print:text-[10px]">{selectedMaterial.serie || selectedMaterial.serialNumber || '—'}</td>
                                                    <td className="border border-black text-center print:text-[10px]">{selectedMaterial.pageFrom || '—'}</td>
                                                    <td className="border border-black text-center print:text-[10px]">{selectedMaterial.pageTo || '—'}</td>
                                                    <td className="border border-black text-center font-bold print:text-[10px]">{selectedMaterial.quantity}</td>
                                                    <td className="border border-black text-center font-bold print:text-[10px]">{Math.floor(selectedMaterial.unitPrice || 0)}</td>
                                                    <td className="border border-black text-center text-[10px] print:text-[8px]">
                                                        {selectedMaterial.unitPriceCents !== undefined
                                                            ? selectedMaterial.unitPriceCents.toString().padStart(2, '0')
                                                            : Math.round(((selectedMaterial.unitPrice || 0) % 1) * 100).toString().padStart(2, '0')}
                                                    </td>
                                                    <td className="border border-black text-center font-bold bg-[#fcfcfc] print:text-[10px]">{Math.floor(selectedMaterial.totalPrice || 0)}</td>
                                                    <td className="border border-black text-center text-[10px] bg-[#fcfcfc] print:text-[8px]">
                                                        {selectedMaterial.totalPriceCents !== undefined
                                                            ? selectedMaterial.totalPriceCents.toString().padStart(2, '0')
                                                            : Math.round(((selectedMaterial.totalPrice || 0) % 1) * 100).toString().padStart(2, '0')}
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
                                            {selectedMaterial.unitPriceCents !== undefined
                                                ? selectedMaterial.unitPriceCents.toString().padStart(2, '0')
                                                : Math.round(((selectedMaterial.unitPrice || 0) % 1) * 100).toString().padStart(2, '0')}
                                        </td>
                                        <td className="border border-black border-t-[1.5px] text-center font-bold text-[15px] print:text-[12px]">{Math.floor(selectedMaterial.totalPrice || 0)}</td>
                                        <td className="border border-black border-t-[1.5px] text-center font-bold text-[13px] print:text-[11px]">
                                            {selectedMaterial.totalPriceCents !== undefined
                                                ? selectedMaterial.totalPriceCents.toString().padStart(2, '0')
                                                : Math.round(((selectedMaterial.totalPrice || 0) % 1) * 100).toString().padStart(2, '0')}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>

                            <div className="flex justify-between mb-12 print:mb-4">
                                <div className="w-[280px] text-center">
                                    <p className="font-bold text-[15px] print:text-[12px]">አስረካቢው</p>
                                    <p className="text-[12px] italic mb-8 print:mb-2 print:text-[10px]">Deliverer (Donor)</p>
                                    <div className="border-b-[1.5px] border-black pb-1 h-[30px] flex items-end justify-center font-bold print:h-[20px]">
                                        {selectedMaterial.vendorName || '—'}
                                    </div>
                                </div>
                                <div className="w-[280px] text-center">
                                    <p className="font-bold text-[15px] print:text-[12px]">ተረካቢው</p>
                                    <p className="text-[12px] italic mb-8 print:mb-2 print:text-[10px]">Deliverer (Recipient)</p>
                                    <div className="border-b-[1.5px] border-black pb-1 h-[30px] flex items-end justify-center font-bold print:h-[20px]">
                                        {selectedMaterial.delivererRecipient || selectedMaterial.responsiblePerson || '—'}
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
            )}
        </div>
    );
}
