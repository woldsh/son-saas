'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import {
    FiActivity, FiPackage, FiAlertTriangle, FiTrendingUp,
    FiCheckCircle, FiClock, FiXCircle, FiShoppingCart,
    FiDownload, FiPrinter
} from 'react-icons/fi';

interface AnalyticsData {
    totalRequests: number;
    pendingRequests: number;
    completedHandouts: number;
    rejectedRequests: number;
    totalSKU: number;
    inStock: number;
    lowStock: number;
    outOfStock: number;
    expired: number;
    expiringSoon: number;
    totalValue: number;
    fixedAssets: number;
    consumables: number;
    trendData: any[];
    statusData: any[];
    deptData: any[];
    typeData: any[];
    topRequested: any[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white px-4 py-3 border border-gray-200 rounded-lg shadow-lg text-sm">
                <p className="text-gray-500 font-medium mb-1">{label}</p>
                {payload.map((p: any, i: number) => (
                    <p key={i} className="font-bold" style={{ color: p.color }}>{p.value} {p.name}</p>
                ))}
            </div>
        );
    }
    return null;
};

export default function AnalyticsDashboardContent() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!db) return;
            try {
                // Fetch all collections in parallel
                const [requestsSnap, sendToUsersSnap, materialsSnap, userReportSnap] = await Promise.all([
                    getDocs(collection(db, 'Request_materials')),
                    getDocs(collection(db, 'Send_to_Users')),
                    getDocs(collection(db, 'materials')),
                    getDocs(collection(db, 'User-Report')),
                ]);

                const activeRequests = requestsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                const sendToUsers = sendToUsersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                const allRequests: any[] = [...activeRequests, ...sendToUsers];

                // Build material list (handle Model 19 items)
                const allMaterials: any[] = [];
                materialsSnap.docs.forEach(docSnap => {
                    const d = docSnap.data();
                    if (d.items && Array.isArray(d.items) && (d.formType === 'receipt_for_articles' || (d.items.length > 0 && !d.materialName))) {
                        d.items.forEach((item: any, idx: number) => {
                            if (item.description?.trim()) {
                                allMaterials.push({
                                    id: `${docSnap.id}_${idx}`,
                                    materialName: item.description.trim(),
                                    quantity: Number(item.quantity) || 0,
                                    unitPrice: Number(item.unitPriceBirr) || 0,
                                    materialType: d.materialType || 'consumable',
                                    expiryDate: item.expiryDate || d.expiryDate,
                                    category: d.classificationOfStock || 'other',
                                });
                            }
                        });
                    } else if (d.materialName) {
                        allMaterials.push({
                            id: docSnap.id,
                            materialName: d.materialName,
                            quantity: Number(d.quantity) || 0,
                            unitPrice: Number(d.unitPrice) || 0,
                            materialType: d.materialType || 'consumable',
                            expiryDate: d.expiryDate,
                            category: d.category || 'other',
                        });
                    }
                });

                // Stock analysis
                const now = new Date();
                const thirtyDays = new Date(); thirtyDays.setDate(now.getDate() + 30);
                let inStock = 0, lowStock = 0, outOfStock = 0, expired = 0, expiringSoon = 0, totalValue = 0;
                let fixedAssets = 0, consumables = 0;

                allMaterials.forEach(m => {
                    totalValue += m.unitPrice * m.quantity;
                    if (m.materialType === 'fixed_asset') fixedAssets++; else consumables++;
                    if (m.quantity === 0) outOfStock++;
                    else if (m.quantity <= 10) lowStock++;
                    else inStock++;
                    if (m.expiryDate) {
                        const exp = new Date(m.expiryDate);
                        if (exp < now) expired++;
                        else if (exp <= thirtyDays) expiringSoon++;
                    }
                });

                // Request trend (last 7 days)
                const trendData = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(); d.setDate(d.getDate() - (6 - i));
                    return { date: d.toISOString().split('T')[0], name: d.toLocaleDateString('en-US', { weekday: 'short' }), requests: 0 };
                });
                allRequests.forEach((req: any) => {
                    const ts = req.createdAt || req.issued_date;
                    if (ts) {
                        let dObj = typeof ts === 'string' ? new Date(ts) : ts.toDate?.() || ts;
                        if (dObj && !isNaN(dObj.getTime())) {
                            const date = dObj.toISOString().split('T')[0];
                            const match = trendData.find(d => d.date === date);
                            if (match) match.requests++;
                        }
                    }
                });

                // Status breakdown
                let pending = 0, approved = 0, completed = 0, rejected = 0;
                allRequests.forEach((r: any) => {
                    const s = (r.status || '').toLowerCase();
                    if (s === 'completed' || s === 'delivered' || s.includes('handout')) completed++;
                    else if (s.includes('approved') || s.includes('processed')) approved++;
                    else if (s.includes('rejected')) rejected++;
                    else pending++;
                });
                const statusData = [
                    { name: 'Completed', value: completed, color: '#10b981' },
                    { name: 'Approved', value: approved, color: '#3b82f6' },
                    { name: 'Pending', value: pending, color: '#f59e0b' },
                    { name: 'Rejected', value: rejected, color: '#ef4444' },
                ].filter(d => d.value > 0);

                // Department breakdown
                const deptMap: Record<string, number> = {};
                allRequests.forEach((r: any) => {
                    const dept = r.department || r.requester_department || 'Unknown';
                    deptMap[dept] = (deptMap[dept] || 0) + 1;
                });
                const deptData = Object.entries(deptMap)
                    .map(([name, value], i) => ({ name: name.replace(/_/g, ' '), value, color: COLORS[i % COLORS.length] }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 6);

                // Type distribution
                const typeData = [
                    { name: 'Fixed Assets', value: fixedAssets, color: '#6366f1' },
                    { name: 'Consumables', value: consumables, color: '#10b981' },
                ].filter(d => d.value > 0);

                // Top requested items from User-Report
                const itemMap: Record<string, number> = {};
                userReportSnap.docs.forEach(d => {
                    const data = d.data();
                    const name = (data.materialName || '').trim();
                    const qty = Number(data.quantity) || 1;
                    if (name) itemMap[name] = (itemMap[name] || 0) + qty;
                });
                const topRequested = Object.entries(itemMap)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5);

                setData({
                    totalRequests: allRequests.length,
                    pendingRequests: pending,
                    completedHandouts: completed,
                    rejectedRequests: rejected,
                    totalSKU: allMaterials.length,
                    inStock, lowStock, outOfStock,
                    expired, expiringSoon, totalValue,
                    fixedAssets, consumables,
                    trendData, statusData, deptData, typeData, topRequested,
                });
                setLoading(false);
            } catch (err) {
                console.error('Analytics fetch error:', err);
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleExportCSV = () => {
        if (!data) return;
        
        const csvRows = [];
        csvRows.push(['Analytics Report']);
        csvRows.push(['Generated At', new Date().toLocaleString()]);
        csvRows.push([]);
        
        csvRows.push(['--- KPIs ---']);
        csvRows.push(['Metric', 'Value']);
        csvRows.push(['Total SKU Items', data.totalSKU]);
        csvRows.push(['Total Requests', data.totalRequests]);
        csvRows.push(['Pending Requests', data.pendingRequests]);
        csvRows.push(['Completed Handouts', data.completedHandouts]);
        csvRows.push(['Total Value (ETB)', data.totalValue]);
        csvRows.push([]);
        
        csvRows.push(['--- Stock Health ---']);
        csvRows.push(['Status', 'Count']);
        csvRows.push(['In Stock', data.inStock]);
        csvRows.push(['Low Stock', data.lowStock]);
        csvRows.push(['Out of Stock', data.outOfStock]);
        csvRows.push(['Expired', data.expired]);
        csvRows.push(['Expiring Soon (30d)', data.expiringSoon]);
        csvRows.push([]);
        
        csvRows.push(['--- Asset Types ---']);
        csvRows.push(['Type', 'Count']);
        csvRows.push(['Fixed Assets', data.fixedAssets]);
        csvRows.push(['Consumables', data.consumables]);
        csvRows.push([]);
        
        csvRows.push(['--- Top Issued Items ---']);
        csvRows.push(['Item Name', 'Count']);
        data.topRequested.forEach(item => {
            csvRows.push([`"${item.name}"`, item.count]);
        });
        
        const csvContent = csvRows.map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Analytics_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrintPDF = () => {
        window.print();
    };

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div id="printable-page" className="min-h-full bg-gray-50 pb-10">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 lg:px-10 py-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                            <FiActivity className="text-lg" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Analytics Dashboard</h1>
                            <p className="text-sm text-gray-500">Real-time inventory & request insights</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 print:hidden">
                        <button 
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 hover:text-blue-600 transition-colors shadow-sm"
                        >
                            <FiDownload />
                            Export CSV
                        </button>
                        <button 
                            onClick={handlePrintPDF}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            <FiPrinter />
                            Print / PDF
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-6 lg:px-10 pt-5 space-y-5">
                {/* Row 1: Primary KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KpiCard icon={FiPackage} label="Total SKU Items" value={data.totalSKU} color="blue" sub={`${data.fixedAssets} fixed · ${data.consumables} consumable`} />
                    <KpiCard icon={FiShoppingCart} label="Total Requests" value={data.totalRequests} color="indigo" sub={`${data.pendingRequests} pending`} />
                    <KpiCard icon={FiCheckCircle} label="Completed" value={data.completedHandouts} color="green" />
                    <KpiCard icon={FiTrendingUp} label="Total Value" value={`${data.totalValue.toLocaleString()}`} color="purple" sub="ETB" />
                </div>

                {/* Row 2: Stock Health */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StockCard label="In Stock" value={data.inStock} total={data.totalSKU} color="green" icon="✅" />
                    <StockCard label="Low Stock" value={data.lowStock} total={data.totalSKU} color="amber" icon="⚠️" />
                    <StockCard label="Out of Stock" value={data.outOfStock} total={data.totalSKU} color="red" icon="🚫" />
                    <StockCard label="Expired / Expiring" value={data.expired + data.expiringSoon} total={data.totalSKU} color="rose" icon="📅" sub={data.expired > 0 ? `${data.expired} expired, ${data.expiringSoon} soon` : `${data.expiringSoon} expiring soon`} />
                </div>

                {/* Row 3: Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Request Trend */}
                    <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-800">Request Trend</h3>
                                <p className="text-xs text-gray-400">Last 7 days</p>
                            </div>
                            <FiTrendingUp className="text-blue-400" />
                        </div>
                        <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.trendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="requests" name="Requests" stroke="#3b82f6" strokeWidth={2.5} fill="url(#trendGrad)" dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }} activeDot={{ r: 6, fill: '#3b82f6' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Status Breakdown */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-800">Request Status</h3>
                                <p className="text-xs text-gray-400">Distribution</p>
                            </div>
                            <FiActivity className="text-green-400" />
                        </div>
                        <div className="h-[160px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={data.statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value" stroke="none">
                                        {data.statusData.map((entry: any, i: number) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={({ payload }) => payload?.[0] ? (
                                        <div className="bg-white px-3 py-2 border border-gray-200 rounded-lg shadow-lg text-sm">
                                            <span className="font-bold" style={{ color: payload[0].payload.color }}>{payload[0].name}: {payload[0].value}</span>
                                        </div>
                                    ) : null} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 mt-2">
                            {data.statusData.map((s: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }}></div>
                                        <span className="text-gray-600 font-medium">{s.name}</span>
                                    </div>
                                    <span className="font-bold text-gray-800">{s.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Row 4: Department + Type + Top Items */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Department Distribution */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <div className="mb-4">
                            <h3 className="text-sm font-bold text-gray-800">By Department</h3>
                            <p className="text-xs text-gray-400">Request distribution</p>
                        </div>
                        {data.deptData.length > 0 ? (
                            <div className="space-y-3">
                                {data.deptData.map((d: any, i: number) => {
                                    const pct = data.totalRequests > 0 ? Math.round((d.value / data.totalRequests) * 100) : 0;
                                    return (
                                        <div key={i}>
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="text-gray-600 font-medium capitalize truncate max-w-[150px]">{d.name}</span>
                                                <span className="font-bold text-gray-700">{d.value} <span className="text-gray-400">({pct}%)</span></span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2">
                                                <div className="h-2 rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: d.color }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 text-center py-8">No department data</p>
                        )}
                    </div>

                    {/* Asset Type */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <div className="mb-4">
                            <h3 className="text-sm font-bold text-gray-800">Asset Types</h3>
                            <p className="text-xs text-gray-400">Fixed vs Consumable</p>
                        </div>
                        <div className="h-[160px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.typeData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                                    <Bar dataKey="value" name="Items" radius={[6, 6, 0, 0]} barSize={50}>
                                        {data.typeData.map((entry: any, i: number) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <div className="text-center p-2 bg-indigo-50 rounded-lg">
                                <p className="text-lg font-bold text-indigo-700">{data.fixedAssets}</p>
                                <p className="text-[10px] text-indigo-500 font-medium">Fixed Assets</p>
                            </div>
                            <div className="text-center p-2 bg-green-50 rounded-lg">
                                <p className="text-lg font-bold text-green-700">{data.consumables}</p>
                                <p className="text-[10px] text-green-500 font-medium">Consumables</p>
                            </div>
                        </div>
                    </div>

                    {/* Top Requested Items */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <div className="mb-4">
                            <h3 className="text-sm font-bold text-gray-800">Top Issued Items</h3>
                            <p className="text-xs text-gray-400">Most distributed materials</p>
                        </div>
                        {data.topRequested.length > 0 ? (
                            <div className="space-y-3">
                                {data.topRequested.map((item: any, i: number) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white ${i === 0 ? 'bg-blue-600' : i === 1 ? 'bg-blue-400' : 'bg-gray-400'}`}>
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-700 truncate">{item.name}</p>
                                        </div>
                                        <span className="text-sm font-bold text-gray-800">{item.count}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 text-center py-8">No issuance data yet</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Sub-Components ---

function KpiCard({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: string | number; color: string; sub?: string }) {
    const colorMap: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        indigo: 'bg-indigo-50 text-indigo-600',
        purple: 'bg-purple-50 text-purple-600',
    };
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
                    <Icon className="text-base" />
                </div>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
    );
}

function StockCard({ label, value, total, color, icon, sub }: { label: string; value: number; total: number; color: string; icon: string; sub?: string }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    const barColor: Record<string, string> = {
        green: 'bg-green-500',
        amber: 'bg-amber-500',
        red: 'bg-red-500',
        rose: 'bg-rose-500',
    };
    const textColor: Record<string, string> = {
        green: 'text-green-700',
        amber: 'text-amber-700',
        red: 'text-red-700',
        rose: 'text-rose-700',
    };
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">{label}</span>
                <span className="text-base">{icon}</span>
            </div>
            <p className={`text-2xl font-bold ${textColor[color]}`}>{value}</p>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                <div className={`h-1.5 rounded-full transition-all duration-1000 ${barColor[color]}`} style={{ width: `${pct}%` }}></div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">{sub || `${pct}% of inventory`}</p>
        </div>
    );
}
