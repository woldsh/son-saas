'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import {
    FiDownload, FiFileText, FiSearch, FiCalendar,
    FiPackage, FiCheckCircle, FiUsers, FiTrendingUp,
    FiFilter, FiPrinter, FiChevronLeft, FiChevronRight
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
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;
    const tableRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!db) return;
            try {
                // Fetch from User-Report (issued items)
                const reportSnap = await getDocs(collection(db!, 'User-Report'));
                const processed: ProcessedItem[] = [];

                reportSnap.docs.forEach(doc => {
                    const d = doc.data();
                    const matType = (d.materialType || '').toLowerCase();
                    
                    // Filter by stock type
                    if (stockType === 'fixed' && !matType.includes('fixed')) return;
                    if (stockType === 'consumable' && !matType.includes('consumable')) return;

                    let dateObj = new Date();
                    if (d.approvedAt?.toDate) dateObj = d.approvedAt.toDate();
                    else if (d.createdAt?.toDate) dateObj = d.createdAt.toDate();
                    else if (d.withdrawalDate?.toDate) dateObj = d.withdrawalDate.toDate();

                    processed.push({
                        id: doc.id,
                        requesterName: d.requesterName || 'Unknown',
                        department: d.department || 'General',
                        materialName: d.materialName || 'Unknown Material',
                        materialCode: d.materialCode || '-',
                        materialType: d.materialType || 'unknown',
                        quantity: d.quantity || 0,
                        unit: d.unit || 'pcs',
                        status: d.status || 'processed',
                        processedDate: dateObj.toLocaleDateString('en-GB'),
                        rawDate: dateObj
                    });
                });

                processed.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
                setItems(processed);
            } catch (err) {
                console.error('Error fetching report data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [stockType]);

    const filtered = useMemo(() => {
        return items.filter(item => {
            const matchSearch = !searchTerm ||
                item.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.department.toLowerCase().includes(searchTerm.toLowerCase());

            let matchDate = true;
            if (dateFrom) {
                matchDate = matchDate && item.rawDate >= new Date(dateFrom);
            }
            if (dateTo) {
                const to = new Date(dateTo);
                to.setHours(23, 59, 59);
                matchDate = matchDate && item.rawDate <= to;
            }
            return matchSearch && matchDate;
        });
    }, [items, searchTerm, dateFrom, dateTo]);

    // KPI Stats
    const stats = useMemo(() => {
        const deptSet = new Set(filtered.map(i => i.department));
        const employeeSet = new Set(filtered.map(i => i.requesterName));
        const totalQty = filtered.reduce((sum, i) => sum + i.quantity, 0);
        return {
            totalIssued: filtered.length,
            totalQuantity: totalQty,
            uniqueDepartments: deptSet.size,
            uniqueEmployees: employeeSet.size
        };
    }, [filtered]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const paginatedItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, dateFrom, dateTo]);

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
        const header = 'No,Employee,Department,Material,Code,Type,Qty,Unit,Status,Date\n';
        const rows = filtered.map((item, i) =>
            `${i + 1},"${item.requesterName}","${item.department.replace(/_/g, ' ')}","${item.materialName}","${item.materialCode}","${item.materialType.replace(/_/g, ' ')}",${item.quantity},"${item.unit}","${item.status.replace(/_/g, ' ')}","${item.processedDate}"`
        ).join('\n');

        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clerk-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportPDF = () => {
        const titleBase = roleType === 'team_leader' ? 'Procurement Team Leader — Full System Report' :
            roleType === 'keeper' ? 'Store Keeper Report' : 'Stock Clerk Report';
        const title = roleType === 'team_leader' ? titleBase :
            stockType === 'fixed' ? `Fixed Assets ${titleBase}` :
            stockType === 'consumable' ? `Consumable Items ${titleBase}` : titleBase;
        const dateRange = dateFrom || dateTo ? `Period: ${dateFrom || '...'} to ${dateTo || '...'}` : `Generated: ${new Date().toLocaleDateString('en-GB')}`;

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
            <div class="stat"><div class="stat-val">${stats.totalIssued}</div><div class="stat-label">Items Issued</div></div>
            <div class="stat"><div class="stat-val">${stats.totalQuantity}</div><div class="stat-label">Total Quantity</div></div>
            <div class="stat"><div class="stat-val">${stats.uniqueEmployees}</div><div class="stat-label">Employees Served</div></div>
            <div class="stat"><div class="stat-val">${stats.uniqueDepartments}</div><div class="stat-label">Departments</div></div>
        </div>
        <table>
            <thead><tr><th>#</th><th>Employee</th><th>Department</th><th>Material</th><th>Code</th><th>Qty</th><th>Unit</th><th>Date</th></tr></thead>
            <tbody>${filtered.map((item, i) => `
                <tr><td>${i + 1}</td><td>${item.requesterName}</td><td>${item.department.replace(/_/g, ' ')}</td><td>${item.materialName}</td><td>${item.materialCode}</td><td>${item.quantity}</td><td>${item.unit}</td><td>${item.processedDate}</td></tr>`).join('')}
            </tbody>
        </table>
        <div class="dept-section">
            <h2 style="font-size:14px;margin-bottom:8px;">Department Breakdown</h2>
            <table class="dept-table">
                <thead><tr><th>Department</th><th>Items</th><th>Total Qty</th></tr></thead>
                <tbody>${deptBreakdown.map(([dept, data]) => `
                    <tr><td>${dept.replace(/_/g, ' ')}</td><td>${data.count}</td><td>${data.qty}</td></tr>`).join('')}
                </tbody>
            </table>
        </div>
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
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{roleType === 'team_leader' ? 'System Work Report' : 'Work Report'}</h2>
                    <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-widest">{typeLabel} — {roleType === 'team_leader' ? 'Full System Overview' : roleType === 'keeper' ? 'Store Keeper Summary' : 'Issuance Summary'} & Export</p>
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

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Items Issued', value: stats.totalIssued, icon: FiCheckCircle, color: 'emerald' },
                    { label: 'Total Quantity', value: stats.totalQuantity, icon: FiPackage, color: 'blue' },
                    { label: 'Employees Served', value: stats.uniqueEmployees, icon: FiUsers, color: 'indigo' },
                    { label: 'Departments', value: stats.uniqueDepartments, icon: FiTrendingUp, color: 'amber' },
                ].map((kpi, i) => (
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
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="w-full md:w-40 pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                    </div>
                    <span className="text-slate-400 text-xs font-bold">to</span>
                    <div className="relative flex-1 md:flex-none">
                        <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="w-full md:w-40 pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                    </div>
                    {(dateFrom || dateTo || searchTerm) && (
                        <button onClick={() => { setSearchTerm(''); setDateFrom(''); setDateTo(''); }}
                            className="px-3 py-2.5 text-xs font-bold text-red-500 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-all">
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Data Table */}
            <div ref={tableRef} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider w-12 text-center">#</th>
                                <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Employee</th>
                                <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Department</th>
                                <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Material</th>
                                <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Code</th>
                                <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider text-center">Qty</th>
                                <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Unit</th>
                                <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {paginatedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-16 text-center">
                                        <FiFileText className="text-4xl text-slate-200 mx-auto mb-3" />
                                        <p className="text-sm font-bold text-slate-400">No records found</p>
                                        <p className="text-xs text-slate-300 mt-1">Try adjusting your filters</p>
                                    </td>
                                </tr>
                            ) : paginatedItems.map((item, idx) => {
                                const globalIdx = (currentPage - 1) * itemsPerPage + idx + 1;
                                const isFixed = item.materialType.toLowerCase().includes('fixed');
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
                                        <td className="px-4 py-3 text-slate-500 text-xs font-medium">{item.unit}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                item.status.includes('accepted') ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                item.status.includes('approved') ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                'bg-amber-50 text-amber-600 border border-amber-100'
                                            }`}>
                                                {item.status.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs font-medium">{item.processedDate}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                        Showing {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} records
                    </span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${currentPage === 1 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600'}`}>
                            <FiChevronLeft />
                        </button>
                        <span className="px-3 py-1.5 text-xs font-bold text-slate-600">{currentPage} / {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${currentPage === totalPages ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600'}`}>
                            <FiChevronRight />
                        </button>
                    </div>
                </div>
            </div>

            {/* Department Breakdown */}
            {deptBreakdown.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">Department Breakdown</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {deptBreakdown.map(([dept, data], i) => {
                            const pct = stats.totalIssued > 0 ? Math.round((data.count / stats.totalIssued) * 100) : 0;
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
