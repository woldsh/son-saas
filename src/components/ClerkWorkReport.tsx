'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import {
    FiDownload, FiFileText, FiSearch, FiCalendar,
    FiPackage, FiCheckCircle, FiUsers, FiTrendingUp,
    FiFilter, FiPrinter, FiChevronLeft, FiChevronRight,
    FiHome, FiUserCheck, FiMapPin
} from 'react-icons/fi';

interface ProcessedItem {
    id: string;
    requesterName: string;
    department: string;
    materialName: string;
    materialCode: string;
    materialType: string;
    quantity: number;
    unit: string;
    status: string;
    processedDate: string;
    rawDate: Date;
}

interface ClerkWorkReportProps {
    stockType?: 'fixed' | 'consumable' | 'all';
    roleType?: 'clerk' | 'keeper' | 'team_leader';
}

export default function ClerkWorkReport({ stockType = 'all', roleType = 'clerk' }: ClerkWorkReportProps) {
    const { user } = useAuth();
    const [items, setItems] = useState<ProcessedItem[]>([]);
    const [registeredItems, setRegisteredItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [reportView, setReportView] = useState<'issued' | 'registered' | 'stock'>('issued');
    const [stockInside, setStockInside] = useState<any[]>([]);
    const [stockOutside, setStockOutside] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterMonth, setFilterMonth] = useState<string>('all');
    const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;
    const tableRef = useRef<HTMLDivElement>(null);

    // Generate years for filter (current year down to 2024)
    const years = useMemo(() => {
        const current = new Date().getFullYear();
        const arr = [];
        for (let y = current; y >= 2024; y--) arr.push(y.toString());
        return arr;
    }, []);

    const months = [
        { v: 'all', l: 'All Months' },
        { v: '0', l: 'January' }, { v: '1', l: 'February' }, { v: '2', l: 'March' },
        { v: '3', l: 'April' }, { v: '4', l: 'May' }, { v: '5', l: 'June' },
        { v: '6', l: 'July' }, { v: '7', l: 'August' }, { v: '8', l: 'September' },
        { v: '9', l: 'October' }, { v: '10', l: 'November' }, { v: '11', l: 'December' }
    ];

    useEffect(() => {
        const fetchData = async () => {
            if (!db || !user) return;
            try {
                // Fetch from User-Report (issued items)
                const reportSnap = await getDocs(collection(db!, 'User-Report'));
                const processed: ProcessedItem[] = [];
                const outside: any[] = [];

                reportSnap.docs.forEach(doc => {
                    const d = doc.data();
                    const matType = (d.materialType || '').toLowerCase();

                    // Filter by stock type
                    if (stockType === 'fixed' && !matType.includes('fixed')) return;
                    if (stockType === 'consumable' && !matType.includes('consumable')) return;

                    // Filter: Only show my issuances (unless team leader)
                    if (roleType !== 'team_leader' && d.approvedBy !== user.uid) return;

                    const dateObj = d.withdrawalDate?.toDate() || d.createdAt?.toDate() || new Date();
                    const itemData = {
                        id: doc.id,
                        requesterName: d.requesterName || 'Unknown',
                        department: d.department || 'General',
                        materialName: d.materialName || 'Unknown',
                        materialCode: d.materialCode || '-',
                        materialType: d.materialType || 'unknown',
                        quantity: parseFloat(d.quantity) || 0,
                        unit: d.unit || 'pcs',
                        status: d.status || 'unknown',
                        processedDate: dateObj.toLocaleDateString('en-GB'),
                        rawDate: dateObj
                    };

                    processed.push(itemData);

                    // If item is actively with a user
                    if (d.status === 'handout_completed' || d.status === 'accepted') {
                        outside.push(itemData);
                    }
                });

                processed.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
                setItems(processed);
                setStockOutside(outside);

                // Fetch Materials (for Registration and Store Inventory)
                const materialsRef = collection(db!, 'materials');
                const materialsSnap = await getDocs(materialsRef);
                const registered: any[] = [];
                const inside: any[] = [];

                materialsSnap.docs.forEach(doc => {
                    const d = doc.data();
                    const matType = (d.materialType || '').toLowerCase();

                    // Filter by stock type
                    if (stockType === 'fixed' && !matType.includes('fixed')) return;
                    if (stockType === 'consumable' && !matType.includes('consumable')) return;

                    const dateObj = d.createdAt ? new Date(d.createdAt) : new Date();
                    const itemsList = d.items ? (Array.isArray(d.items) ? d.items : Object.values(d.items)) : [];

                    itemsList.forEach((item: any) => {
                        const itemMatType = (item.materialType || matType || '').toLowerCase();
                        if (stockType === 'fixed' && itemMatType && !itemMatType.includes('fixed')) return;
                        if (stockType === 'consumable' && itemMatType && !itemMatType.includes('consumable')) return;

                        const displayQty = parseFloat(item.originalQuantity || item.quantity) || 0;
                        const currentQty = parseFloat(item.quantity) || 0;
                        const uBirr = parseFloat(item.unitPriceBirr) || 0;
                        const uCents = parseFloat(item.unitPriceCents) || 0;
                        const unitPrice = uBirr + (uCents / 100);

                        const entry = {
                            id: `${doc.id}-${item.id || Math.random()}`,
                            receiptNo: d.receiptNo || '-',
                            description: item.description || 'Unknown',
                            materialType: itemMatType || 'unknown',
                            quantity: displayQty, // Registration uses original
                            currentQuantity: currentQty, // Inventory uses current
                            unitPrice: unitPrice,
                            totalPrice: unitPrice * displayQty,
                            processedDate: dateObj.toLocaleDateString('en-GB'),
                            rawDate: dateObj,
                            department: d.department || 'General',
                            registeredBy: d.registeredBy
                        };

                        // Add to Registration view only if I registered it (or team leader)
                        if (roleType === 'team_leader' || !d.registeredBy || d.registeredBy === user.uid) {
                            registered.push(entry);
                        }

                        // Add to Store Inventory if it's in stock
                        if (currentQty > 0) {
                            inside.push(entry);
                        }
                    });
                });

                registered.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
                setRegisteredItems(registered);
                setStockInside(inside);

                setLoading(false);
            } catch (error) {
                console.error("Error fetching report data:", error);
                setLoading(false);
            }
        };

        fetchData();
    }, [stockType, user?.uid, roleType]);

    // Combined filter logic
    const filtered = useMemo(() => {
        let source =
            reportView === 'issued' ? items :
                reportView === 'registered' ? registeredItems :
                    [...stockInside, ...stockOutside];

        // For Issuance view, only show accepted items as requested
        if (reportView === 'issued') {
            source = source.filter(i => i.status === 'accepted' || i.status === 'handout_completed');
        }

        return source.filter(item => {
            const searchLower = searchTerm.toLowerCase();
            const matchSearch =
                (item.materialName || item.description || '').toLowerCase().includes(searchLower) ||
                (item.requesterName || '').toLowerCase().includes(searchLower) ||
                (item.receiptNo || '').toLowerCase().includes(searchLower);

            // Date logic
            let matchDate = true;
            if (dateFrom) matchDate = matchDate && item.rawDate >= new Date(dateFrom);
            if (dateTo) {
                const end = new Date(dateTo);
                end.setHours(23, 59, 59);
                matchDate = matchDate && item.rawDate <= end;
            }

            // Month/Year logic
            if (filterMonth !== 'all') {
                matchDate = matchDate && item.rawDate.getMonth().toString() === filterMonth;
            }
            if (filterYear !== 'all') {
                matchDate = matchDate && item.rawDate.getFullYear().toString() === filterYear;
            }

            return matchSearch && matchDate;
        });
    }, [items, registeredItems, stockInside, stockOutside, searchTerm, dateFrom, dateTo, filterMonth, filterYear, reportView]);

    // KPI Stats
    const stats = useMemo(() => {
        if (reportView === 'issued') {
            const acceptedItems = filtered.filter(i => i.status === 'accepted' || i.status === 'handout_completed');
            const totalQty = acceptedItems.reduce((sum, i) => sum + i.quantity, 0);
            const employeeSet = new Set(filtered.map(i => i.requesterName));
            const deptSet = new Set(filtered.map(i => i.department));
            return {
                main1: { label: 'Items Issued', value: filtered.length, icon: FiCheckCircle, color: 'emerald' },
                main2: { label: 'Total Quantity Out', value: totalQty, icon: FiPackage, color: 'blue' },
                main3: { label: 'Employees Served', value: employeeSet.size, icon: FiUsers, color: 'indigo' },
                main4: { label: 'Departments', value: deptSet.size, icon: FiTrendingUp, color: 'amber' },
            };
        } else if (reportView === 'registered') {
            const totalQty = filtered.reduce((sum, i) => sum + i.quantity, 0);
            const totalValue = filtered.reduce((sum, i) => sum + (i.totalPrice || 0), 0);
            const uniqueMaterials = new Set(filtered.map(i => i.description)).size;
            return {
                main1: { label: 'Materials Registered', value: filtered.length, icon: FiFileText, color: 'blue' },
                main2: { label: 'Registered Quantity', value: totalQty.toFixed(0), icon: FiPackage, color: 'emerald' },
                main3: { label: 'Total Value (ETB)', value: totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), icon: FiTrendingUp, color: 'indigo' },
                main4: { label: 'Unique Items', value: uniqueMaterials, icon: FiPackage, color: 'amber' },
            };
        } else {
            const totalIn = stockInside.reduce((sum, i) => sum + i.currentQuantity, 0);
            const totalOut = stockOutside.reduce((sum, i) => sum + i.quantity, 0);
            const totalValueIn = stockInside.reduce((sum, i) => sum + (i.unitPrice * i.currentQuantity), 0);
            return {
                main1: { label: 'Stock in Store', value: totalIn.toFixed(0), icon: FiHome, color: 'emerald' },
                main2: { label: 'Stock with Users', value: totalOut.toFixed(0), icon: FiUserCheck, color: 'blue' },
                main3: { label: 'Total Store Value', value: totalValueIn.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), icon: FiTrendingUp, color: 'indigo' },
                main4: { label: 'Total Items', value: stockInside.length + stockOutside.length, icon: FiPackage, color: 'amber' },
            };
        }
    }, [filtered, reportView, stockInside, stockOutside]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const paginatedItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, dateFrom, dateTo, reportView]);

    // Department breakdown
    const deptBreakdown = useMemo(() => {
        const map: Record<string, { count: number; qty: number }> = {};
        filtered.forEach(i => {
            if (!map[i.department]) map[i.department] = { count: 0, qty: 0 };
            map[i.department].count++;
            map[i.department].qty += i.quantity;
        });
        return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
    }, [filtered]);

    // CSV Export
    const exportCSV = () => {
        let header = '';
        let rows = '';

        if (reportView === 'issued') {
            header = 'No,Employee,Department,Material,Code,Type,Qty,Unit,Status,Date\n';
            rows = filtered.map((item, i) =>
                `${i + 1},"${item.requesterName}","${item.department.replace(/_/g, ' ')}","${item.materialName}","${item.materialCode}","${item.materialType.replace(/_/g, ' ')}",${item.quantity},"${item.unit}","${item.status.replace(/_/g, ' ')}","${item.processedDate}"`
            ).join('\n');
        } else {
            header = 'No,Receipt No,Description,Department,Type,Qty,Unit Price,Total Price,Date\n';
            rows = filtered.map((item, i) =>
                `${i + 1},"${item.receiptNo}","${item.description}","${item.department?.replace(/_/g, ' ') || 'General'}","${item.materialType.replace(/_/g, ' ')}",${item.quantity},${item.unitPrice},${item.totalPrice},"${item.processedDate}"`
            ).join('\n');
        }

        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportView}-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportPDF = () => {
        const titleBase = roleType === 'team_leader' ? 'Procurement Team Leader — Full System Report' :
            roleType === 'keeper' ? 'Store Keeper Report' : 'Stock Clerk Report';
        const title = `${reportView === 'issued' ? 'Issuance' : 'Registration'} ${titleBase}`;
        const dateRange = dateFrom || dateTo ? `Period: ${dateFrom || '...'} to ${dateTo || '...'}` : `Generated: ${new Date().toLocaleDateString('en-GB')}`;

        const tableHTML = reportView === 'issued' ? `
            <thead><tr><th>#</th><th>Employee</th><th>Department</th><th>Material</th><th>Code</th><th>Qty</th><th>Unit</th><th>Date</th></tr></thead>
            <tbody>${filtered.map((item, i) => `
                <tr><td>${i + 1}</td><td>${item.requesterName}</td><td>${item.department.replace(/_/g, ' ')}</td><td>${item.materialName}</td><td>${item.materialCode}</td><td>${item.quantity}</td><td>${item.unit}</td><td>${item.processedDate}</td></tr>`).join('')}
            </tbody>
        ` : `
            <thead><tr><th>#</th><th>Receipt #</th><th>Description</th><th>Department</th><th>Qty</th><th>Unit Price</th><th>Total Price</th><th>Date</th></tr></thead>
            <tbody>${filtered.map((item, i) => `
                <tr><td>${i + 1}</td><td>${item.receiptNo}</td><td>${item.description}</td><td>${item.department?.replace(/_/g, ' ') || 'General'}</td><td style="text-align:center">${item.quantity}</td><td style="text-align:right">${item.unitPrice?.toFixed(2)}</td><td style="text-align:right; font-weight:bold">${item.totalPrice?.toFixed(2)}</td><td>${item.processedDate}</td></tr>`).join('')}
            </tbody>
        `;

        const html = `
        <html><head><title>${title}</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            .subtitle { font-size: 12px; color: #64748b; margin-bottom: 24px; }
            .stats { display: flex; gap: 20px; margin-bottom: 24px; }
            .stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 20px; }
            .stat-val { font-size: 22px; font-weight: 800; color: #1e293b; }
            .stat-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 16px; }
            th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
            td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
            tr:nth-child(even) { background: #fafbfc; }
            .dept-section { margin-top: 30px; }
            .dept-table { width: 50%; }
            .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
            @media print { body { padding: 20px; } }
        </style></head><body>
        <h1>${title}</h1>
        <div class="subtitle">${dateRange} | Total Records: ${filtered.length}</div>
        <div class="stats">
            <div class="stat"><div class="stat-val">${stats.main1.value}</div><div class="stat-label">${stats.main1.label}</div></div>
            <div class="stat"><div class="stat-val">${stats.main2.value}</div><div class="stat-label">${stats.main2.label}</div></div>
            <div class="stat"><div class="stat-val">${stats.main3.value}</div><div class="stat-label">${stats.main3.label}</div></div>
            <div class="stat"><div class="stat-val">${stats.main4.value}</div><div class="stat-label">${stats.main4.label}</div></div>
        </div>
        <table>${tableHTML}</table>
        ${reportView === 'issued' ? `
        <div class="dept-section">
            <h2 style="font-size:14px;margin-bottom:8px;">Department Breakdown</h2>
            <table class="dept-table">
                <thead><tr><th>Department</th><th>Items</th><th>Total Qty</th></tr></thead>
                <tbody>${deptBreakdown.map(([dept, data]) => `
                    <tr><td>${dept.replace(/_/g, ' ')}</td><td>${data.count}</td><td>${data.qty}</td></tr>`).join('')}
                </tbody>
            </table>
        </div>` : ''}
        <div class="footer">Property Management System — Auto-generated Report</div>
        </body></html>`;

        const printWin = window.open('', '_blank');
        if (printWin) {
            printWin.document.write(html);
            printWin.document.close();
            setTimeout(() => printWin.print(), 500);
        }
    };

    const typeLabel = stockType === 'fixed' ? 'Fixed Assets' : stockType === 'consumable' ? 'Consumable Items' : 'All Materials';

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-slate-100 rounded-full"></div>
                    <div className="w-16 h-16 border-4 border-blue-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">{roleType === 'team_leader' ? 'System Work Report' : 'Work Report'}</h2>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button
                                onClick={() => setReportView('issued')}
                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${reportView === 'issued' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Issuance
                            </button>
                            <button
                                onClick={() => setReportView('registered')}
                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${reportView === 'registered' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Registration
                            </button>
                            <button
                                onClick={() => setReportView('stock')}
                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${reportView === 'stock' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Store Status
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                        {typeLabel} — {reportView === 'issued' ? 'Issuance' : 'Registration'} Summary & Export
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-200 active:scale-95">
                        <FiDownload /> CSV
                    </button>
                    <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-200 active:scale-95">
                        <FiPrinter /> PDF
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search employee, material, code, department..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-medium text-slate-700"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* Month Select */}
                    <select
                        value={filterMonth}
                        onChange={e => setFilterMonth(e.target.value)}
                        className="pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer"
                        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2394a3b8\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1rem' }}
                    >
                        {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                    </select>

                    {/* Year Select */}
                    <select
                        value={filterYear}
                        onChange={e => setFilterYear(e.target.value)}
                        className="pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer"
                        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2394a3b8\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1rem' }}
                    >
                        <option value="all">All Years</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>

                    <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden md:block"></div>

                    <div className="relative flex-1 md:flex-none">
                        <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="w-full md:w-36 pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                    </div>
                    <span className="text-slate-400 text-[10px] font-black uppercase">to</span>
                    <div className="relative flex-1 md:flex-none">
                        <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="w-full md:w-36 pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                    </div>
                    {(dateFrom || dateTo || searchTerm || filterMonth !== 'all' || filterYear !== 'all') && (
                        <button onClick={() => { setSearchTerm(''); setDateFrom(''); setDateTo(''); setFilterMonth('all'); setFilterYear('all'); }}
                            className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-all">
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[stats.main1, stats.main2, stats.main3, stats.main4].map((kpi, i) => (
                    <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className={`absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity text-${kpi.color}-600`}>
                            <kpi.icon className="text-7xl" />
                        </div>
                        <div className={`w-10 h-10 rounded-xl bg-${kpi.color}-50 text-${kpi.color}-600 flex items-center justify-center text-lg mb-3`}>
                            <kpi.icon />
                        </div>
                        <p className="text-2xl font-black text-slate-800">{kpi.value}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{kpi.label}</p>
                    </div>
                ))}
            </div>

            {/* Data Table */}
            <div ref={tableRef} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider w-12 text-center">#</th>
                                {reportView === 'issued' ? (
                                    <>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Employee</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Department</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Material</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Code</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider text-center">Qty</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Date</th>
                                    </>
                                ) : reportView === 'registered' ? (
                                    <>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Receipt #</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Description</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Department</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider text-right">Unit Price</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider text-center">Reg. Qty</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider text-right">Total Value</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider text-right">Date</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Material Description</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Location / User</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Type</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider text-center">In Store</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Current Status</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {paginatedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-16 text-center">
                                        <FiFileText className="text-4xl text-slate-200 mx-auto mb-3" />
                                        <p className="text-sm font-bold text-slate-400">No records found</p>
                                        <p className="text-xs text-slate-300 mt-1">Try adjusting your filters</p>
                                    </td>
                                </tr>
                            ) : paginatedItems.map((item, idx) => {
                                const globalIdx = (currentPage - 1) * itemsPerPage + idx + 1;
                                if (reportView === 'issued') {
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">{globalIdx}</td>
                                            <td className="px-4 py-3 font-semibold text-slate-800 text-[13px]">{item.requesterName}</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-semibold capitalize">
                                                    {item.department.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 text-[13px] font-medium">{item.materialName}</td>
                                            <td className="px-4 py-3">
                                                <span className="font-mono text-[11px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">{item.materialCode}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-[11px]">{item.quantity}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${item.status.includes('accepted') ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                    item.status.includes('approved') ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                        'bg-amber-50 text-amber-600 border border-amber-100'
                                                    }`}>
                                                    {item.status.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-xs font-medium">{item.processedDate}</td>
                                        </tr>
                                    );
                                } else if (reportView === 'registered') {
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">{globalIdx}</td>
                                            <td className="px-4 py-3 font-semibold text-slate-800 text-[13px]">{item.receiptNo}</td>
                                            <td className="px-4 py-3 text-slate-700 text-[13px] font-medium">{item.description}</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-semibold capitalize">
                                                    {item.department?.replace(/_/g, ' ') || 'General'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                                                {item.unitPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="font-bold text-slate-800 text-[11px]">{item.quantity}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-indigo-600 text-xs">
                                                {item.totalPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-500 text-xs font-medium">{item.processedDate}</td>
                                        </tr>
                                    );
                                } else {
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">{globalIdx}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="text-[13px] font-bold text-slate-800">{item.materialName || item.description}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">{item.materialCode || item.receiptNo}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.requesterName ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                                                            <FiUserCheck size={12} />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-slate-700">{item.requesterName}</span>
                                                            <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">{item.department}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50/50 px-2 py-1 rounded-lg w-fit">
                                                        <FiHome size={12} />
                                                        <span className="text-[10px] font-black uppercase">Main Store Inventory</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    {item.materialType?.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`text-xs font-black ${item.requesterName ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                                    {item.currentQuantity || item.quantity}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${item.requesterName ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${item.requesterName ? 'text-blue-600' : 'text-emerald-600'}`}>
                                                        {item.requesterName ? 'With Employee' : 'In Stock'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Showing <span className="text-slate-600">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-600">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> of <span className="text-slate-600">{filtered.length}</span> records
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                        >
                            <FiChevronLeft size={20} />
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === page ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-400 hover:bg-white hover:text-slate-600'}`}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                        >
                            <FiChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Department Breakdown */}
            {deptBreakdown.length > 0 && reportView === 'issued' && (
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">Department Breakdown</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {deptBreakdown.map(([dept, data], i) => {
                            const pct = items.length > 0 ? Math.round((data.count / items.length) * 100) : 0;
                            return (
                                <div key={dept} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-700 truncate capitalize">{dept.replace(/_/g, ' ')}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400">{pct}%</span>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-black text-slate-800">{data.count}</p>
                                        <p className="text-[9px] text-slate-400 font-bold">({data.qty} qty)</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
