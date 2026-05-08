'use client';

import React, { useState } from 'react';
import { FaPrint, FaPlus, FaSearch, FaSpinner } from 'react-icons/fa';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

interface StockRecordRow {
    id: string;
    date: string;
    reference: string;
    receiptQty: string;
    receiptUnitPrice: string;
    receiptTotal: string;
    issueQty: string;
    issueUnitPrice: string;
    issueTotal: string;
    balanceQty: string;
    balanceUnitPrice: string;
    balanceTotal: string;
}

interface Transaction {
    date: string;
    reference: string;
    type: 'receipt' | 'issue';
    qty: number;
    unitPrice: number;
    total: number;
}

const createEmptyStockRow = (): StockRecordRow => ({
    id: Math.random().toString(36).slice(2),
    date: '', reference: '',
    receiptQty: '', receiptUnitPrice: '', receiptTotal: '',
    issueQty: '', issueUnitPrice: '', issueTotal: '',
    balanceQty: '', balanceUnitPrice: '', balanceTotal: ''
});

export default function StockRecordCard() {
    const [headerData, setHeaderData] = useState({
        itemDescription: '',
        codeNo: '',
        shelfNo: ''
    });

    const [stockRows, setStockRows] = useState<StockRecordRow[]>(() =>
        Array.from({ length: 15 }, () => createEmptyStockRow())
    );

    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [availableMaterials, setAvailableMaterials] = useState<string[]>([]);

    React.useEffect(() => {
        const fetchMaterials = async () => {
            if (!db) return;
            try {
                const matSnap = await getDocs(collection(db, 'materials'));
                const names = new Set<string>();
                matSnap.forEach(doc => {
                    const d = doc.data();
                    if (d.items && Array.isArray(d.items)) {
                        d.items.forEach((item: any) => {
                            if (item.description) names.add(item.description.trim());
                            if (item.materialName) names.add(item.materialName.trim());
                        });
                    } else if (d.materialName) {
                        names.add(d.materialName.trim());
                    }
                });
                setAvailableMaterials(Array.from(names).filter(Boolean).sort());
            } catch (e) {
                console.error("Failed to load materials", e);
            }
        }
        fetchMaterials();
    }, []);

    const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setHeaderData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleStockRowChange = (index: number, field: keyof StockRecordRow, value: string) => {
        setStockRows(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };

            // Recalculate everything from the changed row downwards
            let currentQty = index > 0 ? parseFloat(updated[index - 1].balanceQty) || 0 : 0;
            let currentTotalValue = index > 0 ? parseFloat(updated[index - 1].balanceTotal) || 0 : 0;

            for (let i = index; i < updated.length; i++) {
                const row = updated[i];

                // 1. Auto-calculate Receipt Total for this row
                const rQty = parseFloat(row.receiptQty) || 0;
                const rPrice = parseFloat(row.receiptUnitPrice) || 0;
                if (rQty && rPrice) row.receiptTotal = (rQty * rPrice).toFixed(2);
                else if (field === 'receiptTotal' && i === index) { /* allow manual override if needed */ }
                else if (!row.receiptQty && !row.receiptUnitPrice) row.receiptTotal = '';

                // 2. Auto-calculate Issue Total for this row
                const iQty = parseFloat(row.issueQty) || 0;
                const iPrice = parseFloat(row.issueUnitPrice) || 0;
                if (iQty && iPrice) row.issueTotal = (iQty * iPrice).toFixed(2);
                else if (field === 'issueTotal' && i === index) { /* allow manual override */ }
                else if (!row.issueQty && !row.issueUnitPrice) row.issueTotal = '';

                // 3. Update Running Balance
                const rowRQty = parseFloat(row.receiptQty) || 0;
                const rowRTotal = parseFloat(row.receiptTotal) || 0;
                const rowIQty = parseFloat(row.issueQty) || 0;
                const rowITotal = parseFloat(row.issueTotal) || 0;

                currentQty = currentQty + rowRQty - rowIQty;
                currentTotalValue = currentTotalValue + rowRTotal - rowITotal;

                row.balanceQty = currentQty > 0 ? currentQty.toString() : (currentQty === 0 ? '0' : '');
                row.balanceTotal = currentTotalValue > 0 ? currentTotalValue.toFixed(2) : (currentTotalValue === 0 ? '0.00' : '');

                // 4. Calculate Balance Unit Price (Average cost)
                if (currentQty > 0 && currentTotalValue > 0) {
                    row.balanceUnitPrice = (currentTotalValue / currentQty).toFixed(2);
                } else if (rPrice > 0) {
                    row.balanceUnitPrice = rPrice.toFixed(2);
                } else if (rowIQty > 0 && iPrice > 0) {
                    row.balanceUnitPrice = iPrice.toFixed(2);
                }
            }

            return updated;
        });
    };

    const addStockRow = () => setStockRows(prev => [...prev, createEmptyStockRow()]);

    const fetchHistory = async () => {
        if (!searchTerm || !db) return;
        setLoading(true);
        try {
            // 1. Fetch Receipts
            const matSnap = await getDocs(collection(db, 'materials'));
            const receipts: Transaction[] = [];
            let codeNoFound = '';
            let shelfNoFound = '';

            matSnap.forEach(doc => {
                const d = doc.data();
                if (d.items && Array.isArray(d.items) && d.formType === 'receipt_for_articles') {
                    d.items.forEach((item: any) => {
                        if (item.description?.trim().toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
                            item.materialName?.trim().toLowerCase().includes(searchTerm.trim().toLowerCase())) {

                            if (!codeNoFound && item.itemNo) codeNoFound = item.itemNo;
                            if (!shelfNoFound && d.shelfNo) shelfNoFound = d.shelfNo;

                            const rQty = Number(item.originalQuantity) || Number(item.quantity) || 0;
                            const rPrice = Number(item.unitPriceBirr) || Number(item.unitPrice) || 0;
                            receipts.push({
                                date: d.day || d.createdAt || new Date().toISOString(),
                                reference: 'የዕቃ ገቢ ቁ. ' + (d.receiptNo || ''),
                                type: 'receipt',
                                qty: rQty,
                                unitPrice: rPrice,
                                total: rQty * rPrice
                            });
                        }
                    });
                }
            });

            // 2. Fetch Issues
            const repSnap = await getDocs(collection(db, 'User-Report'));
            const issues: Transaction[] = [];
            repSnap.forEach(doc => {
                const d = doc.data();
                const status = d.status?.toLowerCase() || '';
                const isIssued = status.includes('approved') ||
                    status.includes('accepted') ||
                    status.includes('handout_completed') ||
                    status.includes('distributed') ||
                    status.includes('handed_over');

                if (d.materialName?.trim().toLowerCase().includes(searchTerm.trim().toLowerCase()) && isIssued) {
                    // Handle Firebase timestamp or ISO string
                    let dateStr = new Date().toISOString();
                    if (d.handoutCompletedAt) dateStr = d.handoutCompletedAt;
                    else if (d.acceptedAt) dateStr = d.acceptedAt;
                    else if (d.withdrawalDate?.toDate) dateStr = d.withdrawalDate.toDate().toISOString();
                    else if (d.createdAt?.toDate) dateStr = d.createdAt.toDate().toISOString();
                    else if (typeof d.createdAt === 'string') dateStr = d.createdAt;

                    issues.push({
                        date: dateStr,
                        reference: 'የዕቃ ወጪ ቁ. ' + (d.requestId?.slice(-4) || d.model22No || ''),
                        type: 'issue',
                        qty: Number(d.quantity) || 0,
                        unitPrice: 0,
                        total: 0
                    });
                }
            });

            // Use receipt quantities directly from Firestore (originalQuantity is already correct)
            const processedReceipts = receipts;

            // Combine and sort chronologically
            const allTransactions = [...processedReceipts, ...issues].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            // Calculate running balance
            let currentBalanceQty = 0;
            let currentBalanceTotal = 0;
            let lastUnitPrice = 0;

            const newRows: StockRecordRow[] = [];

            // Optional: add "Brought forward" (የዞረ ድምር) row if needed, but we'll stick to actuals
            allTransactions.forEach(t => {
                let rQty = '', rPrice = '', rTotal = '';
                let iQty = '', iPrice = '', iTotal = '';

                if (t.type === 'receipt') {
                    rQty = t.qty.toString();
                    rPrice = t.unitPrice.toFixed(2);
                    rTotal = t.total.toFixed(2);
                    lastUnitPrice = t.unitPrice; // update last known price

                    currentBalanceQty += t.qty;
                    currentBalanceTotal += t.total;
                } else {
                    // Issue
                    t.unitPrice = lastUnitPrice;
                    t.total = t.qty * lastUnitPrice;

                    iQty = t.qty.toString();
                    iPrice = t.unitPrice.toFixed(2);
                    iTotal = t.total.toFixed(2);

                    currentBalanceQty -= t.qty;
                    currentBalanceTotal -= t.total;
                }

                // Format date to DD/MM/YY
                const dObj = new Date(t.date);
                const dateFormatted = `${dObj.getDate().toString().padStart(2, '0')}/${(dObj.getMonth() + 1).toString().padStart(2, '0')}/${dObj.getFullYear().toString().slice(-2)}`;

                newRows.push({
                    id: Math.random().toString(36).slice(2),
                    date: dateFormatted,
                    reference: t.reference,
                    receiptQty: rQty, receiptUnitPrice: rPrice, receiptTotal: rTotal,
                    issueQty: iQty, issueUnitPrice: iPrice, issueTotal: iTotal,
                    balanceQty: currentBalanceQty.toString(),
                    balanceUnitPrice: lastUnitPrice.toFixed(2),
                    balanceTotal: currentBalanceTotal.toFixed(2)
                });
            });

            // Fill the rest with empty rows up to 15 minimum
            while (newRows.length < 15) {
                newRows.push(createEmptyStockRow());
            }

            setStockRows(newRows);
            setHeaderData({
                itemDescription: searchTerm,
                codeNo: codeNoFound,
                shelfNo: shelfNoFound
            });

        } catch (error) {
            console.error("Error fetching history:", error);
            alert("Failed to fetch history.");
        }
        setLoading(false);
    };

    const blankInput = "bg-transparent border-none outline-none w-full h-full text-[12px] px-1 text-center font-bold";

    return (
        <div className="max-w-[1200px] mx-auto pb-16 font-sans">
            <div className="flex justify-between items-start mb-6 print:hidden">
                <div className="max-w-3xl">
                    <h1 className="text-2xl font-black text-slate-800">Stock Record Card</h1>
                    <p className="text-sm text-slate-500 mb-4">Manage and print stock records</p>
                </div>
                <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 font-bold shadow-md shadow-blue-200"
                >
                    <FaPrint /> Print Card
                </button>
            </div>

            {/* Auto-fill Search */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6 print:hidden flex items-end gap-4">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Search Material to Auto-fill</label>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Type material name (e.g. Pencil, Paper...)"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                        onKeyDown={e => e.key === 'Enter' && fetchHistory()}
                        list="materials-list"
                    />
                    <datalist id="materials-list">
                        {availableMaterials.map(m => (
                            <option key={m} value={m} />
                        ))}
                    </datalist>
                </div>
                <button
                    onClick={fetchHistory}
                    disabled={loading || !searchTerm}
                    className="px-6 py-2.5 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                >
                    {loading ? <FaSpinner className="animate-spin" /> : <FaSearch />} Generate History
                </button>
            </div>

            {/* Printable Area */}
            <div id="printable-receipt" className="bg-white border border-gray-300 p-8 shadow-sm print:shadow-none print:p-0 print:border-none print:w-full space-y-12 text-[#1a1a1a]">

                {/* --- STOCK RECORD CARD --- */}
                <div>
                    <div className="text-center mb-6">
                        <p className="text-[14px] font-bold leading-tight">የገንዘብና ኢኮኖሚ ልማት ሚኒስቴር</p>
                        <p className="text-[12px] font-bold leading-tight uppercase">MINISTRY OF FINANCE & ECONOMIC DEVELOPMENT</p>

                        <p className="text-[16px] font-bold mt-4 leading-tight">የዕቃ ሪከርድ ካርድ</p>
                        <p className="text-[13px] font-bold leading-tight">Stock Record Card</p>
                    </div>

                    <div className="flex justify-between items-end mb-4 text-[13px] px-4">
                        <div className="flex items-end">
                            <span className="font-bold whitespace-nowrap mr-2">የዕቃው ዝርዝር:-</span>
                            <div className="w-[300px] border-b-[1.5px] border-black border-dashed relative h-[20px]">
                                <input type="text" name="itemDescription" value={headerData.itemDescription} onChange={handleHeaderChange} className="absolute inset-0 bg-transparent border-none outline-none text-[13px] font-bold px-2 text-center print:hidden" />
                                <span className="hidden print:block absolute inset-0 text-[13px] font-bold px-2 text-center">{headerData.itemDescription}</span>
                            </div>
                        </div>
                        <div className="flex gap-12">
                            <div className="flex items-end">
                                <span className="font-bold whitespace-nowrap mr-2">ኮድ:</span>
                                <div className="w-[150px] border-b-[1.5px] border-black border-dashed relative h-[20px]">
                                    <input type="text" name="codeNo" value={headerData.codeNo} onChange={handleHeaderChange} className="absolute inset-0 bg-transparent border-none outline-none text-[13px] font-bold px-2 text-center print:hidden" />
                                    <span className="hidden print:block absolute inset-0 text-[13px] font-bold px-2 text-center">{headerData.codeNo}</span>
                                </div>
                            </div>
                            <div className="flex items-end">
                                <span className="font-bold whitespace-nowrap mr-2">Shelf No.</span>
                                <div className="w-[150px] border-b-[1.5px] border-black border-dashed relative h-[20px]">
                                    <input type="text" name="shelfNo" value={headerData.shelfNo} onChange={handleHeaderChange} className="absolute inset-0 bg-transparent border-none outline-none text-[13px] font-bold px-2 text-center print:hidden" />
                                    <span className="hidden print:block absolute inset-0 text-[13px] font-bold px-2 text-center">{headerData.shelfNo}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <table className="w-full border-collapse border-[1.5px] border-black text-[12px] mb-2">
                        <thead>
                            <tr>
                                <th rowSpan={2} className="border border-black w-[80px] p-1 align-middle">
                                    <div className="font-bold">ቀን</div>
                                    <div className="text-[10px] italic">Date</div>
                                </th>
                                <th rowSpan={2} className="border border-black w-[100px] p-1 align-middle">
                                    <div className="font-bold">ማጣቀሻ</div>
                                    <div className="text-[10px] italic">Posting<br />Reference</div>
                                </th>
                                <th colSpan={3} className="border border-black p-1 text-center bg-gray-50/50">
                                    <div className="font-bold">ገቢ</div>
                                    <div className="text-[10px] italic">Receipt</div>
                                </th>
                                <th colSpan={3} className="border border-black p-1 text-center bg-gray-50/50">
                                    <div className="font-bold">ወጪ</div>
                                    <div className="text-[10px] italic">Issue</div>
                                </th>
                                <th colSpan={3} className="border border-black p-1 text-center bg-gray-50/50">
                                    <div className="font-bold">ሚዛን</div>
                                    <div className="text-[10px] italic">Balance</div>
                                </th>
                            </tr>
                            <tr className="bg-gray-50/30">
                                {/* Receipt */}
                                <th className="border border-black w-[60px] p-1">
                                    <div className="font-bold">ብዛት</div>
                                    <div className="text-[9px] italic">Qty.</div>
                                </th>
                                <th className="border border-black w-[70px] p-1">
                                    <div className="font-bold">ያንዱ ዋጋ</div>
                                    <div className="text-[9px] italic">Unit Price</div>
                                </th>
                                <th className="border border-black w-[80px] p-1">
                                    <div className="font-bold">ጠቅላላ ዋጋ</div>
                                    <div className="text-[9px] italic">Total value</div>
                                </th>
                                {/* Issue */}
                                <th className="border border-black w-[60px] p-1">
                                    <div className="font-bold">ብዛት</div>
                                    <div className="text-[9px] italic">Qty.</div>
                                </th>
                                <th className="border border-black w-[70px] p-1">
                                    <div className="font-bold">ያንዱ ዋጋ</div>
                                    <div className="text-[9px] italic">Unit Price</div>
                                </th>
                                <th className="border border-black w-[80px] p-1">
                                    <div className="font-bold">ጠቅላላ ዋጋ</div>
                                    <div className="text-[9px] italic">Total value</div>
                                </th>
                                {/* Balance */}
                                <th className="border border-black w-[60px] p-1">
                                    <div className="font-bold">ብዛት</div>
                                    <div className="text-[9px] italic">Qty.</div>
                                </th>
                                <th className="border border-black w-[70px] p-1">
                                    <div className="font-bold">ያንዱ ዋጋ</div>
                                    <div className="text-[9px] italic">Unit Price</div>
                                </th>
                                <th className="border border-black w-[80px] p-1">
                                    <div className="font-bold">ጠቅላላ ዋጋ</div>
                                    <div className="text-[9px] italic">Total value</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {stockRows.map((row, i) => (
                                <tr key={row.id} className="h-[28px] hover:bg-slate-50 transition-colors print:h-auto">
                                    <td className="border border-black p-0 relative"><input type="text" value={row.date} onChange={e => handleStockRowChange(i, 'date', e.target.value)} className={`${blankInput} print:hidden`} /><span className="hidden print:block text-[11px] text-center font-bold px-1 py-[2px]">{row.date}</span></td>
                                    <td className="border border-black p-0 relative"><input type="text" value={row.reference} onChange={e => handleStockRowChange(i, 'reference', e.target.value)} className={`${blankInput} print:hidden`} /><span className="hidden print:block text-[11px] text-center font-bold px-1 py-[2px] whitespace-nowrap">{row.reference}</span></td>

                                    <td className="border border-black p-0 relative"><input type="text" value={row.receiptQty} onChange={e => handleStockRowChange(i, 'receiptQty', e.target.value)} className={`${blankInput} print:hidden`} /><span className="hidden print:block text-[11px] text-center font-bold px-1 py-[2px]">{row.receiptQty}</span></td>
                                    <td className="border border-black p-0 relative"><input type="text" value={row.receiptUnitPrice} onChange={e => handleStockRowChange(i, 'receiptUnitPrice', e.target.value)} className={`${blankInput} print:hidden`} /><span className="hidden print:block text-[11px] text-center font-bold px-1 py-[2px]">{row.receiptUnitPrice}</span></td>
                                    <td className="border border-black p-0 relative bg-gray-50/50"><input type="text" value={row.receiptTotal} onChange={e => handleStockRowChange(i, 'receiptTotal', e.target.value)} className={`${blankInput} print:hidden`} /><span className="hidden print:block text-[11px] text-center font-bold px-1 py-[2px]">{row.receiptTotal}</span></td>

                                    <td className="border border-black p-0 relative"><input type="text" value={row.issueQty} onChange={e => handleStockRowChange(i, 'issueQty', e.target.value)} className={`${blankInput} print:hidden`} /><span className="hidden print:block text-[11px] text-center font-bold px-1 py-[2px]">{row.issueQty}</span></td>
                                    <td className="border border-black p-0 relative"><input type="text" value={row.issueUnitPrice} onChange={e => handleStockRowChange(i, 'issueUnitPrice', e.target.value)} className={`${blankInput} print:hidden`} /><span className="hidden print:block text-[11px] text-center font-bold px-1 py-[2px]">{row.issueUnitPrice}</span></td>
                                    <td className="border border-black p-0 relative bg-gray-50/50"><input type="text" value={row.issueTotal} onChange={e => handleStockRowChange(i, 'issueTotal', e.target.value)} className={`${blankInput} print:hidden`} /><span className="hidden print:block text-[11px] text-center font-bold px-1 py-[2px]">{row.issueTotal}</span></td>

                                    <td className="border border-black p-0 relative"><input type="text" value={row.balanceQty} onChange={e => handleStockRowChange(i, 'balanceQty', e.target.value)} className={`${blankInput} print:hidden`} /><span className="hidden print:block text-[11px] text-center font-bold px-1 py-[2px]">{row.balanceQty}</span></td>
                                    <td className="border border-black p-0 relative"><input type="text" value={row.balanceUnitPrice} onChange={e => handleStockRowChange(i, 'balanceUnitPrice', e.target.value)} className={`${blankInput} print:hidden`} /><span className="hidden print:block text-[11px] text-center font-bold px-1 py-[2px]">{row.balanceUnitPrice}</span></td>
                                    <td className="border border-black p-0 relative bg-gray-50/50"><input type="text" value={row.balanceTotal} onChange={e => handleStockRowChange(i, 'balanceTotal', e.target.value)} className={`${blankInput} print:hidden`} /><span className="hidden print:block text-[11px] text-center font-bold px-1 py-[2px]">{row.balanceTotal}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="print:hidden flex justify-end">
                        <button type="button" onClick={addStockRow} className="text-blue-600 font-bold flex items-center gap-1 hover:underline text-[12px]">
                            <FaPlus /> Add Row
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
