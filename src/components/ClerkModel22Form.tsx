'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaCheckCircle, FaTimes, FaPrint, FaTimesCircle, FaSave } from 'react-icons/fa';

import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

interface RequestItem {
    materialId: string;
    materialName: string;
    materialCode: string;
    quantity: number;
    condition: string;
    unit: string;
    materialType: string;
    model?: string;
    remarks?: string;
}

interface MaterialRequest {
    id: string;
    requesterId: string;
    requesterName: string;
    department: string;
    items: RequestItem[];
    // ...other fields if needed
}

interface TableRow {
    serialNo: string;
    description: string;
    model: string;
    serialFrom: string;
    serialTo: string;
    quantity: string;
    unitPriceBirr: string;
    unitPriceCents: string;
    totalPriceBirr: string;
    totalPriceCents: string;
    remarks: string;
}

interface ClerkModel22FormProps {
    request: MaterialRequest;
    onClose: () => void;
    onApprove: (updatedItems: RequestItem[]) => Promise<void>;
    readOnly?: boolean;
}

export default function ClerkModel22Form({ request, onClose, onApprove, readOnly = false }: ClerkModel22FormProps) {
    const [mounted, setMounted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

    // Ensure it renders only on client to avoid hydration mismatch with Portals
    useEffect(() => {
        setMounted(true);
    }, []);

    // Header State
    const [headerData, setHeaderData] = useState({
        receiptNo: '',
        department: request.department || '',
        expenditureRegistryNo: '',
        incomingGoodsEntryNo: '',
        classificationOfStock: '',
        storeNo: '',
        shelfNo: '',
        outgoingGoodsEntryNo: '',
        orderNo: '',
        dateDay: new Date().getDate().toString(),
        dateYear: new Date().getFullYear().toString(),
        forUseOf: '', // "ለ_____________ አገልግሎት በትክክል"
    });

    // Extract items to editable rows
    const [rows, setRows] = useState<TableRow[]>([]);

    useEffect(() => {
        const fetchDefaultsFromMaterialsCollection = async () => {
            if (!request.items || request.items.length === 0 || !db) return;
            
            // 1. We will fetch row prices AND header defaults at the same time
            let newHeaderData: any = null;

            const initRows: TableRow[] = await Promise.all(request.items.map(async (item, idx) => {
                let unitPriceBirr = '';
                let unitPriceCents = '';
                let model = item.model || '';

                // Try to find this material in the DB
                try {
                    let docId = item.materialId;
                    let itemIdx = -1;
                    if (docId && docId.includes('_')) {
                        const parts = docId.split('_');
                        docId = parts[0];
                        itemIdx = parseInt(parts[1], 10);
                    }
                    
                    let matData: any = null;
                    if (docId && !docId.startsWith('new_') && !docId.startsWith('FORM20_')) {
                        const docRef = doc(db!, 'materials', docId);
                        const docSnap = await getDoc(docRef);
                        if (docSnap.exists()) {
                            matData = docSnap.data();
                            console.log("Found material by exact ID:", matData);
                        }
                    } 
                    
                    if (!matData) {
                        console.log("ID missing or fake. Running robust fallback search for:", item.materialName);
                        // Robust Fallback: Search all materials if we have a fake ID
                        const allMatsSnap = await getDocs(collection(db!, 'materials'));
                        for (const d of allMatsSnap.docs) {
                            const data = d.data();
                            // Check top-level
                            if (data.materialName?.trim().toLowerCase() === item.materialName?.trim().toLowerCase()) {
                                matData = data;
                                break;
                            }
                            // Check inside items array (Model 19)
                            if (data.items && Array.isArray(data.items)) {
                                const matchedIdx = data.items.findIndex((i:any) => i.description?.trim().toLowerCase() === item.materialName?.trim().toLowerCase());
                                if (matchedIdx !== -1) {
                                    matData = data;
                                    itemIdx = matchedIdx; // We found the exact sub-item!
                                    break;
                                }
                            }
                        }
                    }

                    if (matData) {
                        console.log("Successfully retrieved material data:", matData);
                        // Grab header defaults from the first found item
                        if (!newHeaderData) {
                            newHeaderData = {
                                classificationOfStock: matData.classificationOfStock || matData.category || '',
                                storeNo: matData.storeNo || matData.storeLocation || '',
                                shelfNo: matData.shelfNo || matData.shelfNumber || '',
                                incomingGoodsEntryNo: matData.receiptNo || matData.incomingGoodsEntryNo || '',
                                expenditureRegistryNo: matData.expenditureRegistryNo || '',
                                outgoingGoodsEntryNo: matData.outgoingGoodsEntryNo || '',
                            };
                            console.log("Populating Header Defaults:", newHeaderData);
                        }

                        if (itemIdx >= 0 && matData.items && matData.items[itemIdx]) {
                            // It's a Model 19 sub-item
                            const subItem = matData.items[itemIdx];
                            unitPriceBirr = subItem.unitPriceBirr || '';
                            unitPriceCents = subItem.unitPriceCents || '';
                            model = subItem.model || model;
                        } else {
                            // Standard item
                            unitPriceBirr = matData.unitPriceBirr || '';
                            unitPriceCents = matData.unitPriceCents || '';
                            model = matData.model || model;
                        }
                    } else {
                        console.log("Could not find material in database for:", item.materialName);
                    }
                } catch (e) {
                    console.error("Error fetching defaults for item", e);
                }

                // Calculate total
                let totalBirr = '';
                let totalCents = '';
                const qty = item.quantity || 0;
                if (qty > 0 && (unitPriceBirr || unitPriceCents)) {
                    const b = parseFloat(unitPriceBirr) || 0;
                    const c = parseFloat(unitPriceCents) || 0;
                    const unitTotal = b + (c / 100);
                    const total = unitTotal * qty;
                    totalBirr = Math.floor(total).toString();
                    totalCents = Math.round((total - Math.floor(total)) * 100).toString().padStart(2, '0');
                }

                return {
                    serialNo: (idx + 1).toString(),
                    description: item.materialName || '',
                    model: model,
                    serialFrom: '',
                    serialTo: '',
                    quantity: qty.toString(),
                    unitPriceBirr,
                    unitPriceCents,
                    totalPriceBirr: totalBirr,
                    totalPriceCents: totalCents,
                    remarks: item.remarks || ''
                };
            }));

            // Update Header if we found defaults
            if (newHeaderData) {
                setHeaderData(prev => ({
                    ...prev,
                    classificationOfStock: newHeaderData.classificationOfStock || prev.classificationOfStock,
                    storeNo: newHeaderData.storeNo || prev.storeNo,
                    shelfNo: newHeaderData.shelfNo || prev.shelfNo,
                    incomingGoodsEntryNo: newHeaderData.incomingGoodsEntryNo || prev.incomingGoodsEntryNo,
                    expenditureRegistryNo: newHeaderData.expenditureRegistryNo || prev.expenditureRegistryNo,
                    outgoingGoodsEntryNo: newHeaderData.outgoingGoodsEntryNo || prev.outgoingGoodsEntryNo,
                }));
            }

            // Pad to at least 10 rows to maintain form structure
            while (initRows.length < 10) {
                initRows.push(createEmptyRow());
            }
            setRows(initRows);
        };

        fetchDefaultsFromMaterialsCollection();
    }, [request.items]);

    const createEmptyRow = (): TableRow => ({
        serialNo: '', description: '', model: '', serialFrom: '', serialTo: '', quantity: '', unitPriceBirr: '', unitPriceCents: '', totalPriceBirr: '', totalPriceCents: '', remarks: ''
    });

    const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setHeaderData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const calculateRowTotal = (row: TableRow): TableRow => {
        const qty = parseFloat(row.quantity) || 0;
        const birr = parseFloat(row.unitPriceBirr) || 0;
        const cents = parseFloat(row.unitPriceCents) || 0;
        if (qty > 0 && (birr > 0 || cents > 0)) {
            const unitTotal = birr + cents / 100;
            const total = unitTotal * qty;
            return {
                ...row,
                totalPriceBirr: Math.floor(total).toString(),
                totalPriceCents: Math.round((total - Math.floor(total)) * 100).toString().padStart(2, '0')
            };
        }
        return { ...row, totalPriceBirr: '', totalPriceCents: '' };
    };

    const handleRowChange = (index: number, field: keyof TableRow, value: string) => {
        setRows(prev => {
            const updated = [...prev];
            updated[index] = calculateRowTotal({ ...updated[index], [field]: value });
            return updated;
        });
    };

    // Grand totals calculation
    let gBirr = 0, gCents = 0;
    rows.forEach(r => {
        gBirr += parseInt(r.totalPriceBirr) || 0;
        gCents += parseInt(r.totalPriceCents) || 0;
    });
    gBirr += Math.floor(gCents / 100); gCents = gCents % 100;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus({ type: null, message: '' });

        try {
            // Re-pack editable rows into RequestItem array
            const finalItems: RequestItem[] = [];
            rows.forEach((row, i) => {
                if (row.description.trim() !== '' && parseFloat(row.quantity) > 0) {
                    const originalItem = request.items[i]; // Try to map to original item if exists to retain ID
                    finalItems.push({
                        materialId: originalItem?.materialId || `new_${i}`,
                        materialName: row.description,
                        materialCode: originalItem?.materialCode || '',
                        quantity: parseFloat(row.quantity) || 0,
                        condition: originalItem?.condition || 'New',
                        unit: originalItem?.unit || 'pcs',
                        materialType: originalItem?.materialType || 'fixed_asset',
                        model: row.model,
                        remarks: row.remarks
                    });
                }
            });

            if (finalItems.length === 0) {
                setSubmitStatus({ type: 'error', message: 'You must issue at least one item with a quantity > 0.' });
                setIsSubmitting(false);
                return;
            }

            // Call the parent's generic logic
            await onApprove(finalItems);
            // Modal will be closed naturally by parent update or we can call onClose
            onClose();

        } catch (error: any) {
            console.error("Submission failed", error);
            setSubmitStatus({ type: 'error', message: error.message || 'Failed to process issuance.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!mounted) return null;

    const inputClasses = "absolute inset-0 bg-transparent border-none outline-none font-bold text-[#0033aa] px-1 font-[Kalam]";
    const thClasses = "border-[1px] border-black p-1 text-[11px] font-bold text-center align-middle bg-white";
    const tdClasses = "border-[1px] border-black p-0 text-center align-middle h-[28px] relative bg-white";

    return createPortal(
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
            display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflowY: 'auto',
            padding: '40px 16px'
        }} onClick={onClose} className="font-serif">

            <div style={{
                background: '#FDFCF8', // Paper color matching Model 19
                width: '100%', maxWidth: '210mm',
                minHeight: '297mm',
                height: 'max-content',
                margin: '0 auto',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                padding: '40px',
                color: '#000',
                position: 'relative',
                borderRadius: 4
            }} onClick={e => e.stopPropagation()} id="printable-receipt" className="print:p-0 print:border-none print:shadow-none">

                <form onSubmit={handleSubmit} className={`w-full ${readOnly ? 'pointer-events-none [&_input]:bg-transparent [&_textarea]:bg-transparent' : ''}`}>

                    {/* Top Action Buttons (Hidden in print) */}
                    <div className="absolute top-4 right-4 flex gap-2 print-hide font-sans z-50 pointer-events-auto">
                        <button type="button" onClick={() => window.print()} className="p-2 bg-gray-100 hover:bg-gray-200 text-slate-800 rounded-full shadow-sm" title="Print Form">
                            <FaPrint size={18} />
                        </button>
                        <button type="button" onClick={onClose} className="p-2 bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-full shadow-sm" title="Close">
                            <FaTimes size={18} />
                        </button>
                    </div>

                    {submitStatus.message && (
                        <div className={`mb-4 p-3 rounded flex items-center gap-2 text-sm font-sans print-hide ${submitStatus.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                            {submitStatus.type === 'success' ? <FaCheckCircle /> : <FaTimesCircle />}
                            <span className="font-semibold">{submitStatus.message}</span>
                        </div>
                    )}

                    {readOnly && (
                        <>
                            {/* Watermark for Audit */}
                            <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -rotate-[25deg] pointer-events-none z-[5] opacity-[0.05] select-none whitespace-nowrap print:hidden">
                                <p className="text-[140px] font-black text-slate-900 border-[24px] border-slate-900 px-24 py-6 rounded-[60px] uppercase tracking-[0.2em]">Digital Receipt</p>
                            </div>
                            
                            {/* Modern Status Badge */}
                            <div className="absolute top-12 left-1/2 -translate-x-1/2 print:hidden z-50 pointer-events-auto">
                                <div className="px-5 py-2 bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-500/30 flex items-center gap-3 animate-bounce-subtle">
                                    <FaCheckCircle className="text-white" />
                                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">Official Audit Record</span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Row 1: Headers */}
                    <div className="flex justify-between items-start mb-4 w-full">
                        {/* Upper Left corner */}
                        <div className="w-[150px]">
                            <p className="text-[14px] font-bold leading-tight">ሞዴል ፳፪</p>
                            <p className="text-[12px] italic">Model 22</p>
                        </div>

                        {/* Top Center: No. */}
                        <div className="flex flex-col items-center ml-20">
                            <div className="flex items-center gap-2 text-[20px] font-black">
                                <span className="italic">No.</span>
                                <span>{headerData.receiptNo}</span>
                            </div>
                        </div>

                        {/* Upper Right corner */}
                        <div className="text-right">
                            <p className="text-[14px] font-bold leading-tight mr-16">ሴሪ ሀ/2ኛ</p>
                            <p className="text-[12px] italic mr-16">Serial B-2nd</p>
                        </div>
                    </div>

                    {/* Row 2: Emblem and Numbered Info List */}
                    <div className="flex justify-between gap-8 mb-6">
                        {/* Left: Emblem and Gov Text */}
                        <div className="w-[400px] flex flex-col items-center justify-start mt-[-20px] shrink-0">
                            <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center shrink-0 mb-3" style={{ filter: 'grayscale(1) contrast(1000%) brightness(1.1)', opacity: 0.9 }}>
                                <img src="https://upload.wikimedia.org/wikipedia/commons/3/3f/Emblem_of_Ethiopia.svg" alt="Emblem of Ethiopia" className="w-full h-full object-contain" />
                            </div>
                            <div className="flex flex-col text-center justify-center w-full relative">
                                <p className="text-[14px] font-bold leading-tight">በኢትዮጵያ ፌዴራላዊ ዲሞክራሲያዊ ሪፐብሊክ</p>
                                <p className="text-[11px] font-bold leading-tight uppercase">The Federal Democratic Republic of Ethiopia</p>
                                <p className="text-[14px] font-bold leading-tight mt-2">የገንዘብ ሚኒስቴር</p>
                                <p className="text-[11px] font-bold leading-tight uppercase">Ministry of Finance</p>

                                {/* Department Input Below Gov Text */}
                                <div className="mt-8 relative w-full px-4">
                                    <div className="flex items-end">
                                        <span className="text-[14px] font-bold leading-tight mr-2">የ</span>
                                        <div className="flex-1 border-b-[1.5px] border-black h-[22px] relative">
                                            <input
                                                type="text"
                                                name="department"
                                                value={headerData.department}
                                                onChange={handleHeaderChange}
                                                readOnly
                                                className="absolute inset-0 bg-transparent border-none outline-none text-[13px] font-bold px-2 text-[#0033aa] font-[Kalam] w-full text-center"
                                            />
                                        </div>
                                    </div>
                                    <div className="text-[11px] italic ml-10 mt-1 leading-none text-center">
                                        Department
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Numbered Header Fields */}
                        <div className="flex-1 text-[11px] space-y-3 font-semibold w-[400px]">
                            <div className="flex items-end">
                                <span className="shrink-0 whitespace-nowrap">1. ገንዘብ ወጪ መዝገብ የተመዘገበት ተራ ቁጥር</span>
                                <div className="flex-1 border-b-[0.5px] border-black ml-3 h-[18px] relative">
                                    <input type="text" name="expenditureRegistryNo" value={headerData.expenditureRegistryNo} onChange={handleHeaderChange} className={inputClasses} />
                                </div>
                            </div>
                            <p className="text-[9px] italic pl-4 -mt-1 font-normal">Item No. in Expenditure Registery</p>

                            <div className="flex items-end">
                                <span className="shrink-0 whitespace-nowrap">2. ዕቃ ገቢ መዝገብ የገባበት ገጽ</span>
                                <div className="flex-1 border-b-[0.5px] border-black ml-3 h-[18px] relative">
                                    <input type="text" name="incomingGoodsEntryNo" value={headerData.incomingGoodsEntryNo} onChange={handleHeaderChange} className={inputClasses} />
                                </div>
                            </div>
                            <p className="text-[9px] italic pl-4 -mt-1 font-normal">No. of entry in the register of incoming goods</p>

                            <div className="flex items-end">
                                <span className="shrink-0 whitespace-nowrap">3. ዕቃው የተሰጠው መደብ</span>
                                <div className="flex-1 border-b-[0.5px] border-black ml-3 h-[18px] relative">
                                    <input type="text" name="classificationOfStock" value={headerData.classificationOfStock} onChange={handleHeaderChange} className={inputClasses} />
                                </div>
                            </div>
                            <p className="text-[9px] italic pl-4 -mt-1 font-normal">Classification of Stock</p>

                            <div className="flex items-end">
                                <span className="shrink-0 whitespace-nowrap">4. ዕቃው የተቀመጠበት መጋዘን ቁጥር</span>
                                <div className="flex-1 border-b-[0.5px] border-black ml-3 h-[18px] relative">
                                    <input type="text" name="storeNo" value={headerData.storeNo} onChange={handleHeaderChange} className={inputClasses} />
                                </div>
                            </div>
                            <p className="text-[9px] italic pl-4 -mt-1 font-normal">Store No.</p>

                            <div className="flex items-end">
                                <span className="shrink-0 whitespace-nowrap">5. የመደርደሪያው ቁጥር</span>
                                <div className="flex-1 border-b-[0.5px] border-black ml-3 h-[18px] relative">
                                    <input type="text" name="shelfNo" value={headerData.shelfNo} onChange={handleHeaderChange} className={inputClasses} />
                                </div>
                            </div>
                            <p className="text-[9px] italic pl-4 -mt-1 font-normal">Shelf No.</p>

                            <div className="flex items-end">
                                <span className="shrink-0 whitespace-nowrap">6. ዕቃው የወጣበት የወጪ መዝገብ የተመዘገበት ተራ ቁጥር</span>
                                <div className="flex-1 border-b-[0.5px] border-black ml-3 h-[18px] relative">
                                    <input type="text" name="outgoingGoodsEntryNo" value={headerData.outgoingGoodsEntryNo} onChange={handleHeaderChange} className={inputClasses} />
                                </div>
                            </div>
                            <p className="text-[9px] italic pl-4 -mt-1 font-normal">No. of entry in the register of outgoing goods</p>
                        </div>
                    </div>

                    {/* Main Title Section */}
                    <div className="text-center mb-6 relative">
                        <p className="text-[20px] font-bold tracking-[0.2em] mb-1">
                            የዕቃ &nbsp;&nbsp;ወይም &nbsp;&nbsp;የንብረት &nbsp;&nbsp;ወጪ &nbsp;&nbsp;ደረሰኝ
                        </p>
                        <p className="text-[13px] font-bold tracking-[0.05em] border-b-[1.5px] border-black pb-0.5 inline-block">
                            RECEIPT FOR ARTICLES OR PROPERTY ISSUED
                        </p>
                    </div>

                    {/* Sentence block */}
                    <div className="text-[13px] leading-[26px] mb-8 font-semibold w-full pr-4 text-justify">
                        <div className="flex items-baseline flex-wrap">
                            <span>እኔ</span>
                            <span className="w-[30%] border-b border-black text-[#0033aa] font-[Kalam] text-[16px] text-center">{request.requesterName}</span>
                            <span className="ml-[2%]">ቀን</span>
                            <span className="w-[10%] border-b border-black text-[#0033aa] font-[Kalam] text-[16px] text-center">{headerData.dateDay}</span>
                            <span>ዓ.ም በቁጥር</span>
                            <span className="flex-1 border-b border-black text-[#0033aa] font-[Kalam] text-[16px] text-center ml-2">
                                <input type="text" name="orderNo" value={headerData.orderNo} onChange={handleHeaderChange} className={`${inputClasses} relative`} />
                            </span>
                        </div>
                        <div className="flex justify-between text-[11px] font-normal italic -mt-2">
                            <span className="ml-10">In accordance with the</span>
                            <span className="ml-[35%]">order No.</span>
                            <span className="mr-[15%]">dated of</span>
                        </div>

                        <div className="flex items-baseline mt-2">
                            <span>መሰረት ቀጥሎ በዝርዝር የተፃፉትን ዕቃዎች ለ</span>
                            <span className="flex-1 border-b border-black text-[#0033aa] font-[Kalam] text-[16px] text-center mx-2 relative h-[20px]">
                                <input type="text" name="forUseOf" value={headerData.forUseOf} onChange={handleHeaderChange} className={`${inputClasses} relative`} />
                            </span>
                            <span>አገልግሎት በትክክል</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-normal italic -mt-2">
                            <span>20&nbsp;<span className="inline-block w-[30px] border-b border-black text-[#0033aa] text-[14px] text-center -mb-2">{headerData.dateYear.substring(2)}</span> here by certify that I have counted correctly and received the articles enumerated below for the use of</span>
                        </div>

                        <div>
                            <span>ቆጥሬ መረከቤን በፊርማየ አረጋግጣለሁ፡፡</span>
                        </div>
                    </div>

                    {/* Table */}
                    <table className="w-full border-collapse border-[1.5px] border-black mb-10">
                        <thead>
                            <tr>
                                <th rowSpan={2} className={`${thClasses} w-[40px]`}>ተ.ቁ<br /><span className="text-[9px] font-normal italic">Serial<br />No.</span></th>
                                <th rowSpan={2} className={`${thClasses} w-[300px]`}>የዕቃው ወይም የንብረት<br />ዓይነት ዝርዝር<br /><span className="text-[9px] font-normal italic">Detailed Description of Articles<br />or property</span></th>
                                <th rowSpan={2} className={`${thClasses} w-[60px]`}>ሞዴል<br /><span className="text-[9px] font-normal italic">Model</span></th>
                                <th colSpan={2} className={`${thClasses}`}>ተከታታይ ቁጥር<br /><span className="text-[9px] font-normal italic">Serial</span></th>
                                <th rowSpan={2} className={`${thClasses} w-[60px]`}>ብዛት<br /><span className="text-[9px] font-normal italic">Quantity</span></th>
                                <th colSpan={2} className={`${thClasses}`}>ያንዱ ዋጋ<br /><span className="text-[9px] font-normal italic">Unit Price</span></th>
                                <th colSpan={2} className={`${thClasses}`}>የዋጋ ድምር<br /><span className="text-[9px] font-normal italic">Total Price</span></th>
                                <th rowSpan={2} className={`${thClasses} w-[70px]`}>ምርመራ<br /><span className="text-[9px] font-normal italic">Remarks</span></th>
                            </tr>
                            <tr>
                                <th className={`${thClasses} w-[45px]`}>ከ<br /><span className="text-[9px] font-normal italic">From</span></th>
                                <th className={`${thClasses} w-[45px]`}>እስከ<br /><span className="text-[9px] font-normal italic">To</span></th>
                                <th className={`${thClasses} w-[45px]`}>ብር<br /><span className="text-[9px] font-normal italic">Birr</span></th>
                                <th className={`${thClasses} w-[20px] p-0`}>ሳ<br /><span className="text-[9px] font-normal italic text-[#000]">C.</span></th>
                                <th className={`${thClasses} w-[45px]`}>ብር<br /><span className="text-[9px] font-normal italic">Birr</span></th>
                                <th className={`${thClasses} w-[20px] p-0`}>ሳ<br /><span className="text-[9px] font-normal italic text-[#000]">C.</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, idx) => (
                                <tr key={idx}>
                                    <td className={tdClasses}>{idx + 1}</td>
                                    {/* Description Column */}
                                    <td className={`${tdClasses} text-left px-2`}>
                                        <input
                                            type="text"
                                            value={row.description}
                                            onChange={(e) => handleRowChange(idx, 'description', e.target.value)}
                                            readOnly={idx < request.items.length}
                                            className={`w-full bg-transparent outline-none font-[Kalam] text-[15px] ${idx < request.items.length ? 'text-[#000]' : 'text-[#0033aa]'}`}
                                        />
                                    </td>
                                    {/* Model Col */}
                                    <td className={tdClasses}>
                                        <input
                                            type="text"
                                            value={row.model}
                                            onChange={(e) => handleRowChange(idx, 'model', e.target.value)}
                                            className="w-full bg-transparent outline-none text-center font-[Kalam] text-[#0033aa] text-[15px]"
                                        />
                                    </td>
                                    {/* Serial From Col */}
                                    <td className={tdClasses}>
                                        <input
                                            type="text"
                                            value={row.serialFrom}
                                            onChange={(e) => handleRowChange(idx, 'serialFrom', e.target.value)}
                                            className="w-full bg-transparent outline-none text-center font-[Kalam] text-[#0033aa] text-[15px]"
                                        />
                                    </td>
                                    {/* Serial To Col */}
                                    <td className={tdClasses}>
                                        <input
                                            type="text"
                                            value={row.serialTo}
                                            onChange={(e) => handleRowChange(idx, 'serialTo', e.target.value)}
                                            className="w-full bg-transparent outline-none text-center font-[Kalam] text-[#0033aa] text-[15px]"
                                        />
                                    </td>
                                    {/* Quantity Col */}
                                    <td className={tdClasses}>
                                        <input
                                            type="number"
                                            min="0"
                                            value={row.quantity}
                                            onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                                            readOnly={idx < request.items.length}
                                            className={`w-full bg-transparent outline-none text-center font-[Kalam] text-[17px] font-bold ${idx < request.items.length ? 'text-[#000]' : 'text-[#e11d48]'}`}
                                        />
                                    </td>
                                    {/* Unit Price Birr */}
                                    <td className={tdClasses}>
                                        <input
                                            type="number"
                                            min="0"
                                            value={row.unitPriceBirr}
                                            onChange={(e) => handleRowChange(idx, 'unitPriceBirr', e.target.value)}
                                            className="w-full bg-transparent outline-none text-center font-[Kalam] text-[#0033aa] text-[15px]"
                                        />
                                    </td>
                                    {/* Unit Price Cents */}
                                    <td className={tdClasses}>
                                        <input
                                            type="number"
                                            min="0"
                                            max="99"
                                            value={row.unitPriceCents}
                                            onChange={(e) => handleRowChange(idx, 'unitPriceCents', e.target.value)}
                                            className="w-full bg-transparent outline-none text-center font-[Kalam] text-[#0033aa] text-[12px]"
                                        />
                                    </td>
                                    {/* Total Birr (Auto Calculated) */}
                                    <td className={tdClasses}>
                                        <span className="font-[Kalam] text-[#e11d48] text-[15px] font-bold">{row.totalPriceBirr}</span>
                                    </td>
                                    {/* Total Cents (Auto Calculated) */}
                                    <td className={tdClasses}>
                                        <span className="font-[Kalam] text-[#e11d48] text-[12px] font-bold">{row.totalPriceCents}</span>
                                    </td>
                                    {/* Remarks Col */}
                                    <td className={tdClasses}>
                                        <input
                                            type="text"
                                            value={row.remarks}
                                            onChange={(e) => handleRowChange(idx, 'remarks', e.target.value)}
                                            className="w-full bg-transparent outline-none text-center font-[Kalam] text-[#0033aa] text-[13px]"
                                        />
                                    </td>
                                </tr>
                            ))}

                            {/* Total Row */}
                            <tr>
                                <td colSpan={8} className="border-[1px] border-black p-1 text-center font-bold text-[14px]">
                                    ድምር <br /> <span className="text-[10px] font-normal italic">Total</span>
                                </td>
                                <td className={`${tdClasses} bg-gray-50`}><span className="font-[Kalam] text-[#e11d48] text-[15px] font-bold">{gBirr || ''}</span></td>
                                <td className={`${tdClasses} bg-gray-50`}><span className="font-[Kalam] text-[#e11d48] text-[12px] font-bold">{gCents ? gCents.toString().padStart(2, '0') : ''}</span></td>
                                <td className={`${tdClasses} bg-gray-50`}></td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Signatures Section */}
                    <div className="flex justify-between mt-12 px-10">
                        <div className="flex flex-col items-center">
                            <span className="w-[180px] border-b-[1.5px] border-black block"></span>
                            <span className="font-bold text-[13px] mt-1">የግምጃ ቤቱ ፊርማ</span>
                            <span className="italic text-[11px]">Store Keeper's Signature</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="w-[180px] border-b-[1.5px] border-black block"></span>
                            <span className="font-bold text-[13px] mt-1">የተቀባይ ፊርማ</span>
                            <span className="italic text-[11px]">Recipient's Signature</span>
                        </div>
                    </div>

                    {/* Form Action Buttons (Hidden when printing) */}
                    <div className="mt-14 flex justify-between gap-4 print-hide font-sans border-t pt-8 px-4 pointer-events-auto">
                        <p className="text-sm text-slate-500 italic max-w-sm">
                            {readOnly ? 'This form is in read-only mode for viewing purposes.' : 'Items marked in blue or red are adjustable. Submitting this form will issue the request securely.'}
                        </p>
                        <div className="flex gap-4">
                            <button type="button" onClick={() => window.print()} className="px-6 py-2.5 bg-gray-100 border border-gray-300 text-slate-800 rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2 font-bold shadow-sm">
                                <FaPrint /> Print Form
                            </button>
                            {!readOnly && (
                                <button type="submit" disabled={isSubmitting} className="px-8 py-2.5 bg-blue-600 focus:ring-4 focus:ring-blue-100 text-white rounded-xl hover:bg-blue-700 transition-colors font-black uppercase text-sm tracking-widest shadow-lg shadow-blue-600/30 flex items-center gap-2">
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <FaSave size={16} /> Issue & Approve
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </form>

                <style>{`
                    @keyframes bounce-subtle {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-5px); }
                    }
                    .animate-bounce-subtle {
                        animation: bounce-subtle 2s ease-in-out infinite;
                    }
                `}</style>
            </div>
        </div>,
        document.body
    );
}


