'use client';

import React, { useState, useEffect } from 'react';
import { FaPrint, FaSearch, FaSpinner, FaHistory, FaPlus } from 'react-icons/fa';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

interface BinCardRow {
    date: string;
    refNo: string;
    received: number | string;
    issued: number | string;
    balance: number | string;
    remark: string;
    timestamp: number;
}

const BinCard: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [availableMaterials, setAvailableMaterials] = useState<string[]>([]);

    const [headerInfo, setHeaderInfo] = useState({
        publicBody: 'Debre Markos University',
        pageNo: '1',
        description: '',
        itemCode: '',
        unit: '',
        minLevel: '',
        maxLevel: '',
        shelfNo: '',
    });

    const [rows, setRows] = useState<BinCardRow[]>([]);

    React.useEffect(() => {
        const fetchMaterials = async () => {
            if (!db) return;
            try {
                const matSnap = await getDocs(collection(db, 'materials'));
                const names = new Set<string>();
                matSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.items && Array.isArray(data.items)) {
                        data.items.forEach((item: any) => {
                            if (item.description) names.add(item.description.trim());
                            if (item.materialName) names.add(item.materialName.trim());
                        });
                    } else if (data.materialName) {
                        names.add(data.materialName.trim());
                    }
                });
                setAvailableMaterials(Array.from(names).filter(Boolean).sort());
            } catch (e) {
                console.error("Failed to load materials", e);
            }
        };
        fetchMaterials();
    }, []);

    const handleAutoFill = async () => {
        if (!searchTerm) return;
        setLoading(true);

        try {
            // 1. Get Header Info (Code, Unit, etc.)
            const allMatsSnapForInfo = await getDocs(collection(db!, 'materials'));
            allMatsSnapForInfo.forEach(doc => {
                const data = doc.data();
                if (data.items && Array.isArray(data.items)) {
                    data.items.forEach((item: any) => {
                        if (item.description?.trim().toLowerCase() === searchTerm.trim().toLowerCase() ||
                            item.materialName?.trim().toLowerCase() === searchTerm.trim().toLowerCase()) {
                            setHeaderInfo(prev => ({
                                ...prev,
                                description: item.description || item.materialName || searchTerm,
                                itemCode: item.itemNo || item.materialCode || '',
                                unit: item.unit || data.unit || '',
                                minLevel: data.minStockLevel || '',
                                maxLevel: data.maxStockLevel || '',
                                shelfNo: data.storeLocation || data.shelfNo || '',
                            }));
                        }
                    });
                } else if (data.materialName?.trim().toLowerCase() === searchTerm.trim().toLowerCase()) {
                    setHeaderInfo(prev => ({
                        ...prev,
                        description: data.materialName || searchTerm,
                        itemCode: data.materialCode || data.itemNo || '',
                        unit: data.unit || '',
                        minLevel: data.minStockLevel || '',
                        maxLevel: data.maxStockLevel || '',
                        shelfNo: data.storeLocation || data.shelfNo || '',
                    }));
                }
            });

            // 2. Get Receipts (Registered) - Check both top-level and items array (Model 19)
            const allMatsSnap = await getDocs(collection(db!, 'materials'));
            const receipts: BinCardRow[] = [];

            allMatsSnap.forEach(doc => {
                const d = doc.data();
                // Check items array for Model 19
                if (d.items && Array.isArray(d.items)) {
                    d.items.forEach((item: any) => {
                        if (item.description?.trim().toLowerCase() === searchTerm.trim().toLowerCase()) {
                            receipts.push({
                                date: d.day || d.createdAt ? new Date(d.day || d.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '',
                                refNo: d.receiptNo ? `የዕቃ ገቢ ቁ. ${d.receiptNo}` : 'የዕቃ ገቢ ቁ. ---',
                                received: Number(item.originalQuantity) || Number(item.quantity) || 0,
                                issued: '-----',
                                balance: 0,
                                remark: '',
                                timestamp: d.createdAt ? new Date(d.createdAt).getTime() : 0
                            });
                        }
                    });
                }
                // Fallback for non-Model 19 materials (top level)
                else if (d.materialName?.trim().toLowerCase() === searchTerm.trim().toLowerCase()) {
                    receipts.push({
                        date: d.dateRegistered || d.createdAt ? new Date(d.dateRegistered || d.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '',
                        refNo: d.receiptNo ? `የዕቃ ገቢ ቁ. ${d.receiptNo}` : 'የዕቃ ገቢ ቁ. ---',
                        received: Number(d.originalQuantity) || Number(d.quantity) || 0,
                        issued: '-----',
                        balance: 0,
                        remark: '',
                        timestamp: d.createdAt ? new Date(d.createdAt).getTime() : 0
                    });
                }
            });

            // 3. Get Issues (User-Report handouts)
            const issueSnap = await getDocs(query(collection(db!, 'User-Report'), where('materialName', '==', searchTerm)));
            const issues = issueSnap.docs.map(doc => {
                const d = doc.data();
                const status = d.status?.toLowerCase() || '';
                const isIssued = status.includes('approved') ||
                    status.includes('accepted') ||
                    status.includes('handout_completed') ||
                    status.includes('distributed') ||
                    status.includes('handed_over');

                if (!isIssued) return null;

                const format = { day: '2-digit', month: '2-digit', year: '2-digit' } as const;
                let dateStr = new Date().toLocaleDateString('en-GB', format);
                let timestamp = d.updatedAt?.toDate?.().getTime() || Date.now();

                if (d.handoutCompletedAt) {
                    dateStr = new Date(d.handoutCompletedAt).toLocaleDateString('en-GB', format);
                    timestamp = new Date(d.handoutCompletedAt).getTime();
                } else if (d.acceptedAt) {
                    dateStr = new Date(d.acceptedAt).toLocaleDateString('en-GB', format);
                    timestamp = new Date(d.acceptedAt).getTime();
                }

                return {
                    date: dateStr,
                    refNo: 'የዕቃ ወጪ ቁ. ' + (d.model22No || d.requestId?.slice(-4) || '---'),
                    received: '-----',
                    issued: Number(d.quantity) || 0,
                    balance: 0,
                    remark: '',
                    timestamp: timestamp
                };
            }).filter(Boolean) as BinCardRow[];

            // Use receipt quantities directly from Firestore (originalQuantity is already correct)

            // Merge and Sort
            const combined = [...receipts, ...issues].sort((a, b) => a.timestamp - b.timestamp);

            // Running Balance
            let currentBalance = 0;
            const calculatedRows = combined.map(item => {
                const rec = typeof item.received === 'number' ? item.received : 0;
                const iss = typeof item.issued === 'number' ? item.issued : 0;
                currentBalance = currentBalance + rec - iss;
                return { ...item, balance: currentBalance };
            });

            setRows(calculatedRows);
        } catch (error) {
            console.error("Error generating history:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddRow = () => {
        const lastBalance = rows.length > 0 ? Number(rows[rows.length - 1].balance) || 0 : 0;
        const newRow: BinCardRow = {
            date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }),
            refNo: '',
            received: '',
            issued: '',
            balance: lastBalance,
            remark: '',
            timestamp: Date.now()
        };
        setRows([...rows, newRow]);
    };

    const handleRowChange = (index: number, field: keyof BinCardRow, value: string) => {
        const updatedRows = [...rows];
        updatedRows[index] = { ...updatedRows[index], [field]: value };
        
        // Recalculate all balances from the changed row onwards
        let currentBalance = 0;
        if (index > 0) {
            currentBalance = Number(updatedRows[index - 1].balance) || 0;
        }
        
        for (let i = index; i < updatedRows.length; i++) {
            const rec = Number(updatedRows[i].received) || 0;
            const iss = Number(updatedRows[i].issued) || 0;
            currentBalance = currentBalance + rec - iss;
            updatedRows[i].balance = currentBalance === 0 && !updatedRows[i].received && !updatedRows[i].issued ? '' : currentBalance;
        }
        
        setRows(updatedRows);
    };

    const blankInput = "bg-transparent border-none outline-none w-full h-full text-[12px] px-1 text-center font-bold";

    return (
        <div className="max-w-5xl mx-auto p-4 bg-white min-h-screen font-sans text-black">
            {/* Control Bar - Hidden in Print */}
            <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4 no-print">
                <div className="flex-1 min-w-[250px] relative">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        list="bin-card-materials-list"
                        type="text"
                        placeholder="Search Material for Bin Card..."
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <datalist id="bin-card-materials-list">
                        {availableMaterials.map(m => <option key={m} value={m} />)}
                    </datalist>
                </div>
                <button
                    onClick={handleAutoFill}
                    disabled={loading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                >
                    {loading ? <FaSpinner className="animate-spin" /> : <FaHistory />}
                    Generate History
                </button>
                <button
                    onClick={handleAddRow}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                    <FaPlus /> Add Row
                </button>
                <button
                    onClick={() => window.print()}
                    className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black flex items-center gap-2 hover:bg-black transition-all"
                >
                    <FaPrint /> Print Card
                </button>
            </div>

            {/* THE BIN CARD DOCUMENT */}
            <div className="print:m-0 print:p-0">
                {/* Ministry Header */}
                <div className="text-center mb-8">
                    <h3 className="text-sm font-bold uppercase tracking-tight">የገንዘብና ኢኮኖሚ ልማት ሚኒስቴር</h3>
                    <h3 className="text-sm font-bold uppercase tracking-tight">Ministry of Finance and Economic Development</h3>
                    <h1 className="text-xl font-black mt-2">ቢን ካርድ</h1>
                    <h1 className="text-xl font-black uppercase">BIN CARD</h1>
                </div>

                {/* Public Body and Page No Row */}
                <div className="flex justify-between items-start mb-6 text-[13px] font-bold">
                    <div className="space-y-1">
                        <p>የመንግስት በ/ቤቱ ሥም</p>
                        <p>Public Body: <span className="border-b border-black min-w-[250px] inline-block text-center">{headerInfo.publicBody}</span></p>
                    </div>
                    <div className="text-right space-y-1">
                        <p>ገጽ ቁጥር</p>
                        <p>Page No. <span className="border-b border-black min-w-[100px] inline-block text-center">{headerInfo.pageNo}</span></p>
                    </div>
                </div>

                {/* Item Info Grid */}
                <div className="grid grid-cols-2 gap-y-4 mb-6 text-[13px] font-bold">
                    <div className="flex flex-col gap-1">
                        <p>የዕቃው ዓይነት / Description of item</p>
                        <p className="border-b border-black w-[90%] font-black text-blue-900 h-6">{headerInfo.description}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                        <p>የዕቃ መለያ / Item code</p>
                        <p className="border-b border-black w-[90%] h-6">{headerInfo.itemCode}</p>
                    </div>

                    <div className="col-span-2 flex justify-between gap-4">
                        <div className="flex-1">
                            <p>መለኪያ / Unit</p>
                            <p className="border-b border-black w-[90%] h-6">{headerInfo.unit}</p>
                        </div>
                        <div className="flex-1 text-center">
                            <p>ዝቅተኛ መጠን / minimum level</p>
                            <p className="border-b border-black w-[90%] mx-auto h-6">{headerInfo.minLevel}</p>
                        </div>
                        <div className="flex-1 text-right">
                            <p>ከፍተኛ መጠን / Max. level</p>
                            <p className="border-b border-black w-[90%] ml-auto h-6">{headerInfo.maxLevel}</p>
                        </div>
                    </div>

                    <div className="col-span-2 mt-2">
                        <p>የማስቀመጫ ቁጥር</p>
                        <p>Shelf No. <span className="border-b border-black min-w-[300px] inline-block h-6">{headerInfo.shelfNo}</span></p>
                    </div>
                </div>

                {/* Main Table */}
                <table className="w-full border-collapse border-[1.5px] border-black">
                    <thead>
                        <tr className="text-center text-[10px] font-black border-b-[1.5px] border-black">
                            <th className="border-r-[1.5px] border-black py-3 px-1 w-24">ቀን<br />Date</th>
                            <th className="border-r-[1.5px] border-black py-3 px-1 w-32">ማጠቃሻ ቁጥር<br />Ref. No.</th>
                            <th className="border-r-[1.5px] border-black py-3 px-1 w-32">የተቀበለው መጠን (ገቢ)<br />Quantity Received</th>
                            <th className="border-r-[1.5px] border-black py-3 px-1 w-32">ወጪ የተደረገ መጠን (ወጪ)<br />Quantity issued</th>
                            <th className="border-r-[1.5px] border-black py-3 px-1 w-28">ከወጪ ቀሪ<br />Balance</th>
                            <th className="py-3 px-1">ምርመራ/አስተያየት<br />Remark</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm font-bold text-center">
                        {rows.length > 0 ? (
                            rows.map((row, i) => (
                                <tr key={i} className="border-b border-black h-[28px] hover:bg-slate-50">
                                    <td className="border-r-[1.5px] border-black p-0">
                                        <input
                                            type="text"
                                            value={row.date}
                                            onChange={(e) => handleRowChange(i, 'date', e.target.value)}
                                            className={blankInput}
                                        />
                                    </td>
                                    <td className="border-r-[1.5px] border-black p-0">
                                        <input
                                            type="text"
                                            value={row.refNo}
                                            onChange={(e) => handleRowChange(i, 'refNo', e.target.value)}
                                            className={blankInput}
                                        />
                                    </td>
                                    <td className="border-r-[1.5px] border-black p-0">
                                        <input
                                            type="text"
                                            value={row.received}
                                            onChange={(e) => handleRowChange(i, 'received', e.target.value)}
                                            className={blankInput}
                                        />
                                    </td>
                                    <td className="border-r-[1.5px] border-black p-0">
                                        <input
                                            type="text"
                                            value={row.issued}
                                            onChange={(e) => handleRowChange(i, 'issued', e.target.value)}
                                            className={blankInput}
                                        />
                                    </td>
                                    <td className="border-r-[1.5px] border-black p-0 font-black text-[13px]">{row.balance}</td>
                                    <td className="p-0 italic text-slate-500">
                                        <input
                                            type="text"
                                            value={row.remark}
                                            onChange={(e) => handleRowChange(i, 'remark', e.target.value)}
                                            className={blankInput}
                                            placeholder="..."
                                        />
                                    </td>
                                </tr>
                            ))
                        ) : (
                            Array.from({ length: 15 }).map((_, i) => (
                                <tr key={i} className="border-b border-black h-10">
                                    <td className="border-r-[1.5px] border-black"></td>
                                    <td className="border-r-[1.5px] border-black"></td>
                                    <td className="border-r-[1.5px] border-black"></td>
                                    <td className="border-r-[1.5px] border-black"></td>
                                    <td className="border-r-[1.5px] border-black"></td>
                                    <td></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <style jsx>{`
                @media print {
                    .no-print { display: none !important; }
                    .max-w-5xl { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
                    table { width: 100% !important; border-width: 2px !important; }
                    th, td { border-width: 2px !important; }
                    h1, h3, p { color: black !important; }
                }
            `}</style>
        </div>
    );
};

export default BinCard;
