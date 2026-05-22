'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar, ComposedChart, Line, RadarChart,
    Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Treemap
} from 'recharts';
import {
    FiActivity, FiPackage, FiAlertTriangle, FiTrendingUp,
    FiCheckCircle, FiClock, FiXCircle, FiShoppingCart,
    FiDownload, FiPrinter, FiArrowUpRight, FiArrowDownRight,
    FiRefreshCw, FiMaximize2, FiMinimize2, FiUsers, FiLayers,
    FiBarChart2, FiPieChart, FiGrid, FiCalendar, FiBox,
    FiDollarSign, FiTarget, FiZap, FiCrosshair, FiDatabase
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

interface AnalyticsData {
    // Core KPIs (all real)
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
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

    // Real computed metrics
    avgProcessingTimeHours: number;
    fulfillmentRate: number;
    rejectionRate: number;
    inventoryTurnover: number;
    avgRequestsPerDay: number;

    // Trend comparisons (current vs previous period)
    requestsTrend: number;
    fulfillmentTrend: number;
    valueTrend: number;

    // Chart data
    trendData: any[];
    statusData: any[];
    deptData: any[];
    categoryData: any[];
    topRequested: any[];
    topRequesters: any[];
    hourlyHeatmap: any[];
    monthlyComparison: any[];

    // Predictive
    predictiveData: any[];
    predictiveAlerts: any[];
    predictiveLabels: Record<string, string>;

    // Activity
    recentActivity: any[];

    // Budget
    budgetByDept: any[];
}

type DateRange = '7d' | '30d' | '90d' | 'all';
type ActiveTab = 'overview' | 'inventory' | 'requests' | 'predictive';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#84cc16'];

// ────────────────────────────────────────────────
// Animated Counter Hook
// ────────────────────────────────────────────────

function useCountUp(end: number, duration = 1200) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let startTime: number | null = null;
        let raf: number;
        const animate = (ts: number) => {
            if (!startTime) startTime = ts;
            const pct = Math.min((ts - startTime) / duration, 1);
            const ease = pct === 1 ? 1 : 1 - Math.pow(2, -10 * pct);
            setCount(Math.floor(end * ease));
            if (pct < 1) raf = requestAnimationFrame(animate);
            else setCount(end);
        };
        raf = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(raf);
    }, [end, duration]);
    return count;
}

const Counter = ({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) => {
    const c = useCountUp(value);
    return <span>{prefix}{c.toLocaleString()}{suffix}</span>;
};

// ────────────────────────────────────────────────
// Tooltip
// ────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900/95 backdrop-blur-xl px-4 py-3 border border-slate-700/50 rounded-xl shadow-2xl text-sm">
            <p className="text-slate-300 font-semibold mb-2 pb-2 border-b border-slate-700/50 text-xs">{label}</p>
            {payload.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2 mb-0.5 last:mb-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-slate-400 text-xs">{p.name}:</span>
                    <span className="text-white font-bold text-xs">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
                </div>
            ))}
        </div>
    );
};

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

function parseDate(ts: any): Date | null {
    if (!ts) return null;
    if (typeof ts === 'string') { const d = new Date(ts); return isNaN(d.getTime()) ? null : d; }
    if (ts.toDate) return ts.toDate();
    if (ts instanceof Date) return ts;
    return null;
}

function getTimeDiffHours(start: Date, end: Date): number {
    return Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

function formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────

export default function AnalyticsDashboardContent() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange>('30d');
    const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [expandedChart, setExpandedChart] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!db) return;
        setLoading(true);
        try {
            const [requestsSnap, sendToUsersSnap, materialsSnap, userReportSnap, auditLogSnap] = await Promise.all([
                getDocs(collection(db, 'Request_materials')),
                getDocs(collection(db, 'Send_to_Users')),
                getDocs(collection(db, 'materials')),
                getDocs(collection(db, 'User-Report')),
                getDocs(collection(db, 'audit_logs')).catch(() => ({ docs: [] }))
            ]);

            const now = new Date();
            const rangeMap: Record<DateRange, number> = { '7d': 7, '30d': 30, '90d': 90, 'all': 36500 };
            const daysLimit = rangeMap[dateRange];
            const cutoff = new Date(now.getTime() - daysLimit * 86400000);
            const prevCutoff = new Date(cutoff.getTime() - daysLimit * 86400000);

            // Parse all requests with dates
            const rawRequests = [
                ...requestsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                ...sendToUsersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            ];

            const allRequestsWithDates = rawRequests.map((r: any) => {
                const date = parseDate(r.createdAt || r.issued_date || r.timestamp);
                return { ...r, _parsedDate: date };
            });

            const currentPeriod = allRequestsWithDates.filter(r => r._parsedDate && r._parsedDate >= cutoff);
            const previousPeriod = allRequestsWithDates.filter(r => r._parsedDate && r._parsedDate >= prevCutoff && r._parsedDate < cutoff);

            // ── Materials ──
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
                                category: d.classificationOfStock || d.category || 'Other',
                                createdAt: parseDate(d.createdAt || d.timestamp)
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
                        category: d.classificationOfStock || d.category || 'Other',
                        createdAt: parseDate(d.createdAt || d.timestamp)
                    });
                }
            });

            // ── Stock Analysis ──
            const thirtyDaysOut = new Date(); thirtyDaysOut.setDate(now.getDate() + 30);
            let inStock = 0, lowStock = 0, outOfStock = 0, expired = 0, expiringSoon = 0, totalValue = 0;
            let fixedAssets = 0, consumables = 0;

            allMaterials.forEach(m => {
                totalValue += (m.unitPrice * m.quantity) || 0;
                if (m.materialType === 'fixed_asset') fixedAssets++; else consumables++;
                if (m.quantity <= 0) outOfStock++;
                else if (m.quantity <= 10) lowStock++;
                else inStock++;
                if (m.expiryDate) {
                    const exp = new Date(m.expiryDate);
                    if (exp < now) expired++;
                    else if (exp <= thirtyDaysOut) expiringSoon++;
                }
            });

            // ── Status Breakdown (Current Period) ──
            let pending = 0, approved = 0, completed = 0, rejected = 0;
            const processingTimes: number[] = [];

            currentPeriod.forEach((r: any) => {
                const s = (r.status || '').toLowerCase();
                if (s === 'completed' || s === 'delivered' || s.includes('handout')) {
                    completed++;
                    // Calculate real processing time
                    const created = r._parsedDate;
                    const completedDate = parseDate(r.completedAt || r.deliveredAt || r.updatedAt);
                    if (created && completedDate) {
                        const hours = getTimeDiffHours(created, completedDate);
                        if (hours > 0 && hours < 720) processingTimes.push(hours); // under 30 days
                    }
                } else if (s.includes('approved') || s.includes('processed')) {
                    approved++;
                } else if (s.includes('rejected')) {
                    rejected++;
                } else {
                    pending++;
                }
            });

            const totalFiltered = pending + approved + completed + rejected;

            // ── Real Metrics ──
            const avgProcessingTimeHours = processingTimes.length > 0
                ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length * 10) / 10
                : 0;

            const fulfillmentRate = totalFiltered > 0 ? Math.round((completed / totalFiltered) * 100) : 0;
            const rejectionRate = totalFiltered > 0 ? Math.round((rejected / totalFiltered) * 100) : 0;

            // Real inventory turnover = total issued / average stock
            const totalIssued = userReportSnap.docs.reduce((sum, d) => sum + (Number(d.data().quantity) || 0), 0);
            const avgStock = allMaterials.length > 0
                ? allMaterials.reduce((sum, m) => sum + m.quantity, 0) / allMaterials.length
                : 1;
            const inventoryTurnover = avgStock > 0 ? Math.round((totalIssued / avgStock) * 10) / 10 : 0;

            // Avg requests per day
            const avgRequestsPerDay = daysLimit > 0 && daysLimit < 36500
                ? Math.round((currentPeriod.length / daysLimit) * 10) / 10
                : Math.round((currentPeriod.length / 365) * 10) / 10;

            // ── Trend Comparisons ──
            const prevCompleted = previousPeriod.filter((r: any) => {
                const s = (r.status || '').toLowerCase();
                return s === 'completed' || s === 'delivered' || s.includes('handout');
            }).length;
            const prevTotal = previousPeriod.length;

            const requestsTrend = prevTotal > 0 ? Math.round(((currentPeriod.length - prevTotal) / prevTotal) * 100 * 10) / 10 : 0;
            const prevFulfillment = prevTotal > 0 ? Math.round((prevCompleted / prevTotal) * 100) : 0;
            const fulfillmentTrend = prevFulfillment > 0 ? Math.round(((fulfillmentRate - prevFulfillment) / prevFulfillment) * 100 * 10) / 10 : 0;

            // Value trend (compare current materials total to prior — simplified as we only have current snapshot)
            const valueTrend = 0; // Can't compute without historical snapshots

            // ── Trend Chart ──
            const trendDays = Math.min(daysLimit, 30);
            const trendData = Array.from({ length: trendDays }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - (trendDays - 1 - i));
                return { date: d.toISOString().split('T')[0], name: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), requests: 0, completed: 0, rejected: 0 };
            });

            currentPeriod.forEach((req: any) => {
                if (req._parsedDate) {
                    const date = req._parsedDate.toISOString().split('T')[0];
                    const match = trendData.find(d => d.date === date);
                    if (match) {
                        match.requests++;
                        const s = (req.status || '').toLowerCase();
                        if (s === 'completed' || s === 'delivered' || s.includes('handout')) match.completed++;
                        if (s.includes('rejected')) match.rejected++;
                    }
                }
            });

            // ── Status Pie ──
            const statusData = [
                { name: 'Completed', value: completed, color: '#10b981' },
                { name: 'Approved', value: approved, color: '#3b82f6' },
                { name: 'Pending', value: pending, color: '#f59e0b' },
                { name: 'Rejected', value: rejected, color: '#ef4444' },
            ].filter(d => d.value > 0);

            // ── Department Breakdown ──
            const deptMap: Record<string, { total: number; completed: number; value: number }> = {};
            currentPeriod.forEach((r: any) => {
                const dept = r.department || r.requester_department || 'Unknown';
                if (!deptMap[dept]) deptMap[dept] = { total: 0, completed: 0, value: 0 };
                deptMap[dept].total++;
                const s = (r.status || '').toLowerCase();
                if (s === 'completed' || s === 'delivered' || s.includes('handout')) deptMap[dept].completed++;
            });
            const deptData = Object.entries(deptMap)
                .map(([name, d], i) => ({
                    name: name.replace(/_/g, ' '),
                    requests: d.total,
                    fulfilled: d.completed,
                    rate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
                    color: COLORS[i % COLORS.length]
                }))
                .sort((a, b) => b.requests - a.requests)
                .slice(0, 8);

            // ── Category Breakdown (Real) ──
            const catMap: Record<string, { count: number; value: number }> = {};
            allMaterials.forEach(m => {
                const cat = m.category || 'Other';
                if (!catMap[cat]) catMap[cat] = { count: 0, value: 0 };
                catMap[cat].count++;
                catMap[cat].value += (m.unitPrice * m.quantity) || 0;
            });
            const categoryData = Object.entries(catMap)
                .map(([name, d], i) => ({ name: name.replace(/_/g, ' '), count: d.count, value: Math.round(d.value), color: COLORS[i % COLORS.length] }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 8);

            // ── Top Requested Items ──
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
                .slice(0, 8);
            const maxTop = topRequested.length > 0 ? topRequested[0].count : 1;

            // ── Top Requesters (Real) ──
            const requesterMap: Record<string, { name: string; count: number; dept: string }> = {};
            currentPeriod.forEach((r: any) => {
                const id = r.requesterId || r.userId || r.id || 'unknown';
                const name = r.requesterName || r.name || 'Unknown User';
                const dept = r.department || r.requester_department || '';
                if (id !== 'unknown' || name !== 'Unknown User') {
                    const key = id !== 'unknown' ? id : name;
                    if (!requesterMap[key]) requesterMap[key] = { name, count: 0, dept };
                    requesterMap[key].count++;
                }
            });
            const topRequesters = Object.values(requesterMap)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            // ── Hourly Heatmap (Real) ──
            const hourMap: Record<number, number> = {};
            for (let h = 0; h < 24; h++) hourMap[h] = 0;
            currentPeriod.forEach((r: any) => {
                if (r._parsedDate) hourMap[r._parsedDate.getHours()]++;
            });
            const maxHourly = Math.max(...Object.values(hourMap), 1);
            const hourlyHeatmap = Object.entries(hourMap).map(([hour, count]) => ({
                hour: `${String(hour).padStart(2, '0')}:00`,
                count,
                intensity: Math.round((count / maxHourly) * 100)
            }));

            // ── Monthly Comparison (Real — last 6 months) ──
            const monthMap: Record<string, { requests: number; completed: number }> = {};
            for (let i = 5; i >= 0; i--) {
                const d = new Date(); d.setMonth(d.getMonth() - i);
                const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                monthMap[key] = { requests: 0, completed: 0 };
            }
            allRequestsWithDates.forEach((r: any) => {
                if (r._parsedDate) {
                    const key = r._parsedDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                    if (monthMap[key]) {
                        monthMap[key].requests++;
                        const s = (r.status || '').toLowerCase();
                        if (s === 'completed' || s === 'delivered' || s.includes('handout')) monthMap[key].completed++;
                    }
                }
            });
            const monthlyComparison = Object.entries(monthMap).map(([name, d]) => ({
                name, requests: d.requests, completed: d.completed
            }));

            // ── Budget by Dept (Real — from materials value) ──
            const priceMap: Record<string, number> = {};
            allMaterials.forEach(m => {
                if (m.materialName) priceMap[m.materialName] = m.unitPrice || 0;
            });

            const budgetDeptMap: Record<string, number> = {};
            userReportSnap.docs.forEach(d => {
                const data = d.data();
                const dept = data.department || data.requester_department || 'Unknown';
                const name = (data.materialName || '').trim();
                const qty = Number(data.quantity) || 1;
                const price = Number(data.unitPrice) || priceMap[name] || 0;
                const val = price * qty;
                budgetDeptMap[dept] = (budgetDeptMap[dept] || 0) + val;
            });
            const budgetByDept = Object.entries(budgetDeptMap)
                .map(([name, value], i) => ({ name: name.replace(/_/g, ' '), value: Math.round(value), color: COLORS[i % COLORS.length] }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 6);

            // ── Recent Activity (Real) ──
            let recentActivity: any[] = [];
            const auditDocs = (auditLogSnap as any).docs || [];
            if (auditDocs.length > 0) {
                recentActivity = auditDocs
                    .map((d: any) => ({ id: d.id, ...d.data() }))
                    .filter((a: any) => parseDate(a.timestamp))
                    .sort((a: any, b: any) => {
                        const at = parseDate(a.timestamp)!.getTime();
                        const bt = parseDate(b.timestamp)!.getTime();
                        return bt - at;
                    })
                    .slice(0, 8);
            }
            if (recentActivity.length === 0) {
                recentActivity = currentPeriod
                    .filter(r => r._parsedDate)
                    .sort((a, b) => b._parsedDate!.getTime() - a._parsedDate!.getTime())
                    .slice(0, 8)
                    .map(r => ({
                        action: `Request ${r.status || 'submitted'}`,
                        userName: r.requesterName || r.name || 'System',
                        timestamp: r._parsedDate,
                        details: r.department || r.requester_department || ''
                    }));
            }

            // ── Predictive Analytics ──
            const nowTime = now.getTime();
            const ACADEMIC_CALENDAR = [
                { name: 'Midterm Exams', start: new Date(nowTime + 15 * 86400000), end: new Date(nowTime + 25 * 86400000), multiplier: 2.5 },
                { name: 'Final Exams', start: new Date(nowTime + 60 * 86400000), end: new Date(nowTime + 75 * 86400000), multiplier: 3.0 }
            ];

            const thirtyDaysAgo = new Date(nowTime - 30 * 86400000);
            const forecastItemMap: Record<string, { totalRequested: number; currentStock: number }> = {};

            allMaterials.forEach(m => {
                if (m.materialName) {
                    forecastItemMap[m.materialName] = { totalRequested: 0, currentStock: m.quantity };
                }
            });

            rawRequests.forEach((req: any) => {
                const dObj = parseDate(req.createdAt || req.issued_date);
                if (dObj && dObj >= thirtyDaysAgo && dObj <= now) {
                    if (req.items && Array.isArray(req.items)) {
                        req.items.forEach((item: any) => {
                            const name = (item.materialName || item.description || '').trim();
                            if (name && forecastItemMap[name]) forecastItemMap[name].totalRequested += (Number(item.quantity) || 1);
                        });
                    } else if (req.materialName) {
                        const name = req.materialName.trim();
                        if (forecastItemMap[name]) forecastItemMap[name].totalRequested += (Number(req.quantity) || 1);
                    }
                }
            });

            const predictiveAlerts: any[] = [];
            const predictiveChartDataMap: Record<string, any> = {};
            const predictiveLabels: Record<string, string> = {};

            for (let i = 0; i <= 60; i++) {
                const d = new Date(nowTime + i * 86400000);
                const dateStr = d.toISOString().split('T')[0];
                predictiveChartDataMap[dateStr] = { date: dateStr, name: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
            }

            const topItemsToForecast = Object.entries(forecastItemMap)
                .filter(([_, d]) => d.totalRequested > 0 && d.currentStock > 0)
                .sort((a, b) => b[1].totalRequested - a[1].totalRequested)
                .slice(0, 3);

            topItemsToForecast.forEach(([name, d], idx) => {
                const baseVelocity = d.totalRequested / 30;
                let sim = d.currentStock;
                let runOutDate: Date | null = null;
                let intersectingEvent: string | null = null;
                predictiveLabels[`item${idx}`] = name;

                for (let i = 0; i <= 60; i++) {
                    const dd = new Date(nowTime + i * 86400000);
                    const dateStr = dd.toISOString().split('T')[0];
                    let daily = baseVelocity;
                    const ev = ACADEMIC_CALENDAR.find(e => dd >= e.start && dd <= e.end);
                    if (ev) {
                        daily *= ev.multiplier;
                        if (!intersectingEvent && sim > 0 && sim - daily <= 0) intersectingEvent = ev.name;
                    }
                    sim -= daily;
                    if (sim < 0) sim = 0;
                    predictiveChartDataMap[dateStr][`item${idx}`] = Math.round(sim);
                    if (sim === 0 && !runOutDate) runOutDate = dd;
                }

                if (runOutDate) {
                    predictiveAlerts.push({
                        itemName: name, currentStock: d.currentStock,
                        velocity: parseFloat(baseVelocity.toFixed(1)),
                        runOutDate, intersectsEvent: intersectingEvent,
                        daysRemaining: Math.floor((runOutDate.getTime() - nowTime) / 86400000)
                    });
                }
            });

            const predictiveData = Object.values(predictiveChartDataMap).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

            setData({
                totalRequests: currentPeriod.length,
                pendingRequests: pending, approvedRequests: approved,
                completedHandouts: completed, rejectedRequests: rejected,
                totalSKU: allMaterials.length,
                inStock, lowStock, outOfStock, expired, expiringSoon, totalValue,
                fixedAssets, consumables,
                avgProcessingTimeHours, fulfillmentRate, rejectionRate,
                inventoryTurnover, avgRequestsPerDay,
                requestsTrend, fulfillmentTrend, valueTrend,
                trendData, statusData, deptData, categoryData,
                topRequested: topRequested.map(t => ({ ...t, pct: Math.round((t.count / maxTop) * 100) })),
                topRequesters, hourlyHeatmap, monthlyComparison,
                predictiveData, predictiveAlerts, predictiveLabels,
                recentActivity, budgetByDept
            });
            setLoading(false);
            setLastRefresh(new Date());
        } catch (err) {
            console.error('Analytics fetch error:', err);
            setLoading(false);
        }
    }, [dateRange]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Auto-refresh every 60s
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchData]);

    if (loading || !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] bg-slate-50">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-slate-200 rounded-full" />
                    <div className="w-20 h-20 border-4 border-indigo-600 rounded-full animate-spin absolute top-0 left-0 border-t-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <FiDatabase className="text-indigo-600 text-xl" />
                    </div>
                </div>
                <p className="mt-6 text-slate-600 font-bold tracking-wide animate-pulse text-sm">Synthesizing Real-Time Data...</p>
                <div className="mt-2 flex gap-1">
                    {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                    ))}
                </div>
            </div>
        );
    }

    const tabs: { id: ActiveTab; label: string; icon: any }[] = [
        { id: 'overview', label: 'Overview', icon: FiGrid },
        { id: 'inventory', label: 'Inventory', icon: FiPackage },
        { id: 'requests', label: 'Requests', icon: FiShoppingCart },
        { id: 'predictive', label: 'AI Forecast', icon: FiCrosshair },
    ];

    return (
        <div id="printable-page" className="min-h-full bg-slate-50 pb-12 selection:bg-indigo-100">
            {/* ═══ PREMIUM HEADER ═══ */}
            <div className="bg-slate-900 border-b border-slate-800 px-6 lg:px-10 pt-8 pb-20 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-32 -mt-32 w-80 h-80 rounded-full bg-indigo-500/8 blur-3xl" />
                <div className="absolute bottom-0 left-1/3 w-60 h-60 rounded-full bg-cyan-500/8 blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-40 h-40 rounded-full bg-purple-500/8 blur-3xl" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 relative">
                            <FiActivity className="text-2xl text-white" />
                            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500 border-2 border-slate-900" />
                            </span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight">Analytics Command Center</h1>
                            <p className="text-sm text-slate-400 mt-1">
                                Real-time intelligence • Last synced {formatTimeAgo(lastRefresh)}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 print:hidden">
                        {/* Auto-Refresh Toggle */}
                        <button
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${autoRefresh ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'}`}
                        >
                            <FiRefreshCw className={autoRefresh ? 'animate-spin' : ''} />
                            {autoRefresh ? 'Live' : 'Auto'}
                        </button>

                        {/* Manual Refresh */}
                        <button onClick={fetchData} className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <FiRefreshCw />
                        </button>

                        {/* Date Range */}
                        <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
                            {(['7d', '30d', '90d', 'all'] as DateRange[]).map(range => (
                                <button
                                    key={range}
                                    onClick={() => setDateRange(range)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${dateRange === range ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                                >
                                    {range === 'all' ? 'ALL' : range.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors">
                            <FiDownload /> Export
                        </button>
                        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-xs font-bold rounded-lg hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-md shadow-indigo-500/20">
                            <FiPrinter /> Report
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-6 lg:px-10 -mt-12 relative z-20">
                {/* ═══ KPI CARDS ═══ */}
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
                    <KpiCard title="Total Requests" value={data.totalRequests} icon={FiShoppingCart} trend={data.requestsTrend} gradient="from-blue-500 to-cyan-400" />
                    <KpiCard title="Fulfillment" value={data.fulfillmentRate} suffix="%" icon={FiCheckCircle} trend={data.fulfillmentTrend} gradient="from-emerald-500 to-teal-400" />
                    <KpiCard title="Avg Process" value={data.avgProcessingTimeHours} suffix="h" icon={FiClock} trend={0} trendGoodDown gradient="from-amber-500 to-orange-400" />
                    <KpiCard title="Rejection Rate" value={data.rejectionRate} suffix="%" icon={FiXCircle} trend={0} trendGoodDown gradient="from-rose-500 to-pink-400" />
                    <KpiCard title="Inventory Value" value={data.totalValue} prefix="ETB " icon={FiDollarSign} trend={data.valueTrend} gradient="from-purple-500 to-pink-500" />
                    <KpiCard title="Daily Velocity" value={data.avgRequestsPerDay} suffix="/day" icon={FiZap} trend={0} gradient="from-indigo-500 to-violet-500" />
                </div>

                {/* ═══ TAB NAVIGATION ═══ */}
                <div className="flex items-center gap-1 bg-white rounded-xl p-1.5 border border-slate-200 shadow-sm mb-8 overflow-x-auto print:hidden">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            <tab.icon className="text-sm" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ═══ TAB CONTENT ═══ */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'overview' && <OverviewTab data={data} expandedChart={expandedChart} setExpandedChart={setExpandedChart} />}
                        {activeTab === 'inventory' && <InventoryTab data={data} />}
                        {activeTab === 'requests' && <RequestsTab data={data} />}
                        {activeTab === 'predictive' && <PredictiveTab data={data} />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );

    function handleExportCSV() {
        if (!data) return;
        const rows: any[] = [];
        rows.push(['Analytics Command Center — Export']);
        rows.push(['Generated', new Date().toLocaleString()]);
        rows.push(['Date Range', dateRange]);
        rows.push([]);
        rows.push(['=== Core Metrics ===']);
        rows.push(['Total Requests', data.totalRequests]);
        rows.push(['Fulfillment Rate', `${data.fulfillmentRate}%`]);
        rows.push(['Rejection Rate', `${data.rejectionRate}%`]);
        rows.push(['Avg Processing (hrs)', data.avgProcessingTimeHours]);
        rows.push(['Daily Velocity', data.avgRequestsPerDay]);
        rows.push([]);
        rows.push(['=== Inventory ===']);
        rows.push(['Total SKU', data.totalSKU]);
        rows.push(['In Stock', data.inStock]);
        rows.push(['Low Stock', data.lowStock]);
        rows.push(['Out of Stock', data.outOfStock]);
        rows.push(['Expired', data.expired]);
        rows.push(['Total Value (ETB)', data.totalValue]);
        rows.push(['Turnover Rate', data.inventoryTurnover]);
        rows.push([]);
        rows.push(['=== Department Consumption ===']);
        rows.push(['Department', 'Requests', 'Fulfilled', 'Rate %']);
        data.deptData.forEach(d => rows.push([`"${d.name}"`, d.requests, d.fulfilled, `${d.rate}%`]));
        rows.push([]);
        rows.push(['=== Top Items ===']);
        rows.push(['Item', 'Quantity']);
        data.topRequested.forEach((t: any) => rows.push([`"${t.name}"`, t.count]));
        rows.push([]);
        rows.push(['=== Top Requesters ===']);
        rows.push(['Name', 'Requests', 'Department']);
        data.topRequesters.forEach(r => rows.push([`"${r.name}"`, r.count, `"${r.dept}"`]));
        rows.push([]);
        rows.push(['=== Budget by Department ===']);
        rows.push(['Department', 'Value (ETB)']);
        data.budgetByDept.forEach(b => rows.push([`"${b.name}"`, b.value]));
        rows.push([]);
        rows.push(['=== Predictive Alerts ===']);
        data.predictiveAlerts.forEach(a => rows.push([`"${a.itemName}"`, `${a.daysRemaining} days left`, `velocity: ${a.velocity}/day`]));

        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Analytics_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// ═══════════════════════════════════════════════
// TAB: OVERVIEW
// ═══════════════════════════════════════════════

function OverviewTab({ data, expandedChart, setExpandedChart }: { data: AnalyticsData; expandedChart: string | null; setExpandedChart: (v: string | null) => void }) {
    return (
        <div className="space-y-6">
            {/* Row 1: Main trend + Status + Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartCard title="Operational Velocity" subtitle="Requests vs Fulfillment trend" className="lg:col-span-2" id="velocity" expanded={expandedChart} setExpanded={setExpandedChart}>
                    <div className={expandedChart === 'velocity' ? 'h-[500px]' : 'h-[300px]'}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={data.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={8} minTickGap={20} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="requests" name="Requests" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#gradReq)" />
                                <Line type="monotone" dataKey="completed" name="Fulfilled" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} />
                                <Line type="monotone" dataKey="rejected" name="Rejected" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                {/* Status + Activity */}
                <div className="space-y-6">
                    <ChartCard title="Status Distribution" subtitle={`${data.totalRequests} total requests`}>
                        <div className="h-[140px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={data.statusData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={4} dataKey="value" stroke="none">
                                        {data.statusData.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                                    </Pie>
                                    <Tooltip content={({ payload }) => payload?.[0] ? (
                                        <div className="bg-slate-900 px-3 py-2 border border-slate-700 rounded-lg shadow-xl text-xs">
                                            <span className="font-bold text-white">{payload[0].name}: {(payload[0].value as number)}</span>
                                        </div>
                                    ) : null} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            {data.statusData.map((s: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                    <span className="text-slate-500">{s.name}</span>
                                    <span className="font-bold text-slate-800 ml-auto">{s.value}</span>
                                </div>
                            ))}
                        </div>
                    </ChartCard>
                </div>
            </div>

            {/* Row 2: Departments + Top Items + Monthly */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartCard title="Department Performance" subtitle="Requests & fulfillment rate">
                    <div className="space-y-4">
                        {data.deptData.length > 0 ? data.deptData.map((d: any, i: number) => (
                            <div key={i}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded text-[9px] font-black text-white flex items-center justify-center" style={{ backgroundColor: d.color }}>{i + 1}</span>
                                        <span className="text-xs font-semibold text-slate-700 truncate max-w-[140px]">{d.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-800">{d.requests}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-bold text-slate-500">{d.rate}%</span>
                                    </div>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round((d.requests / (data.deptData[0]?.requests || 1)) * 100)}%` }} transition={{ duration: 0.8, delay: i * 0.08 }} className="h-full rounded-full" style={{ backgroundColor: d.color }} />
                                </div>
                            </div>
                        )) : <p className="text-sm text-slate-400 text-center py-8">No department data</p>}
                    </div>
                </ChartCard>

                <ChartCard title="High-Velocity Items" subtitle="Most requested materials">
                    <div className="space-y-3">
                        {data.topRequested.length > 0 ? data.topRequested.slice(0, 6).map((item: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all relative overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${item.pct}%` }} transition={{ duration: 0.6 }} className="absolute top-0 left-0 h-full bg-slate-50 -z-10" />
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>#{i + 1}</div>
                                <span className="text-xs font-semibold text-slate-700 truncate flex-1">{item.name}</span>
                                <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-indigo-50 text-indigo-700">{item.count}</span>
                            </div>
                        )) : <p className="text-sm text-slate-400 text-center py-8">No issuance data</p>}
                    </div>
                </ChartCard>

                <ChartCard title="Monthly Comparison" subtitle="6-month trend">
                    <div className="h-[240px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.monthlyComparison} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Bar dataKey="requests" name="Requests" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={18} />
                                <Bar dataKey="completed" name="Fulfilled" fill="#10b981" radius={[4, 4, 0, 0]} barSize={18} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            </div>

            {/* Row 3: Activity Feed + Top Requesters + Hourly Heatmap */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartCard title="Live Activity Feed" subtitle="Latest system events">
                    <div className="divide-y divide-slate-100 -mx-1">
                        {data.recentActivity.length > 0 ? data.recentActivity.map((log: any, i: number) => {
                            const dt = parseDate(log.timestamp);
                            return (
                                <div key={i} className="flex gap-3 py-3 px-1 hover:bg-slate-50 rounded-lg transition-colors">
                                    <div className="mt-1.5 shrink-0">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-indigo-50" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-slate-800 truncate">{log.action || 'System Event'}</p>
                                        <p className="text-[10px] text-slate-500 truncate">{log.userName || log.userEmail || log.details}</p>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap shrink-0">{dt ? formatTimeAgo(dt) : ''}</span>
                                </div>
                            );
                        }) : <p className="text-sm text-slate-400 text-center py-8">No recent activity</p>}
                    </div>
                </ChartCard>

                <ChartCard title="Top Requesters" subtitle="Most active users">
                    <div className="space-y-3">
                        {data.topRequesters.length > 0 ? data.topRequesters.map((u, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-xs font-black text-indigo-700 border border-indigo-200 shrink-0">{u.name.charAt(0).toUpperCase()}</div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800 truncate">{u.name}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{u.dept}</p>
                                </div>
                                <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg shrink-0">{u.count}</span>
                            </div>
                        )) : <p className="text-sm text-slate-400 text-center py-8">No requester data</p>}
                    </div>
                </ChartCard>

                <ChartCard title="Request Time Heatmap" subtitle="Peak activity hours (24h)">
                    <div className="grid grid-cols-6 gap-1.5">
                        {data.hourlyHeatmap.map((h, i) => (
                            <div key={i} className="group relative">
                                <div
                                    className="aspect-square rounded-lg flex items-center justify-center text-[9px] font-bold cursor-default transition-transform hover:scale-110 border border-transparent hover:border-indigo-300"
                                    style={{
                                        backgroundColor: h.intensity > 75 ? '#6366f1' : h.intensity > 50 ? '#818cf8' : h.intensity > 25 ? '#c7d2fe' : '#f1f5f9',
                                        color: h.intensity > 50 ? '#fff' : '#64748b'
                                    }}
                                >
                                    {h.count || ''}
                                </div>
                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                    {h.hour}: {h.count} requests
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center justify-between mt-3 text-[9px] text-slate-400 font-medium">
                        <span>00:00</span>
                        <div className="flex items-center gap-1">
                            <span>Low</span>
                            <div className="flex gap-0.5">
                                {['#f1f5f9', '#c7d2fe', '#818cf8', '#6366f1'].map((c, i) => <div key={i} className="w-3 h-2 rounded-sm" style={{ backgroundColor: c }} />)}
                            </div>
                            <span>High</span>
                        </div>
                        <span>23:00</span>
                    </div>
                </ChartCard>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════
// TAB: INVENTORY
// ═══════════════════════════════════════════════

function InventoryTab({ data }: { data: AnalyticsData }) {
    return (
        <div className="space-y-6">
            {/* Stock Health Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
                <StockMetric title="Total SKU" value={data.totalSKU} icon={FiLayers} color="blue" />
                <StockMetric title="In Stock" value={data.inStock} icon={FiCheckCircle} color="green" />
                <StockMetric title="Low Stock" value={data.lowStock} icon={FiAlertTriangle} color="amber" />
                <StockMetric title="Depleted" value={data.outOfStock} icon={FiXCircle} color="red" />
                <StockMetric title="Expired" value={data.expired} icon={FiClock} color="rose" />
                <StockMetric title="Expiring Soon" value={data.expiringSoon} icon={FiCalendar} color="orange" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Category Breakdown */}
                <ChartCard title="Category Distribution" subtitle="Materials by classification" className="lg:col-span-2">
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.categoryData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }} width={100} />
                                <Tooltip content={<ChartTooltip />} />
                                <Bar dataKey="count" name="Items" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={22}>
                                    {data.categoryData.map((e: any, i: number) => <Cell key={`cell-${i}`} fill={e.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                {/* Asset Mix + Turnover */}
                <div className="space-y-6">
                    <ChartCard title="Asset Composition" subtitle="Fixed vs Consumable">
                        <div className="h-[140px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={[
                                        { name: 'Fixed', value: data.fixedAssets, color: '#6366f1' },
                                        { name: 'Consumable', value: data.consumables, color: '#10b981' }
                                    ]} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={6} dataKey="value" stroke="none">
                                        <Cell fill="#6366f1" />
                                        <Cell fill="#10b981" />
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center gap-6 mt-2 text-xs">
                            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Fixed: <b>{data.fixedAssets}</b></span>
                            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Consumable: <b>{data.consumables}</b></span>
                        </div>
                    </ChartCard>

                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 text-white">
                        <div className="flex items-center gap-2 mb-4">
                            <FiTarget className="text-cyan-400" />
                            <span className="text-sm font-bold">Turnover Rate</span>
                        </div>
                        <div className="text-4xl font-black tracking-tight text-cyan-400">{data.inventoryTurnover}<span className="text-lg text-cyan-300/60">x</span></div>
                        <p className="text-xs text-slate-400 mt-2">Based on total issued ÷ avg stock level</p>
                        <div className="mt-4 pt-4 border-t border-slate-700 text-xs text-slate-400 flex justify-between">
                            <span>Total Value</span>
                            <span className="font-bold text-white">ETB {data.totalValue.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Budget by Department */}
            {data.budgetByDept.length > 0 && (
                <ChartCard title="Budget Consumption by Department" subtitle="Material value distributed to departments (ETB)">
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.budgetByDept} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <Tooltip content={<ChartTooltip />} />
                                <Bar dataKey="value" name="ETB Value" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40}>
                                    {data.budgetByDept.map((e: any, i: number) => <Cell key={`cell-${i}`} fill={e.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════
// TAB: REQUESTS
// ═══════════════════════════════════════════════

function RequestsTab({ data }: { data: AnalyticsData }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
                    <FiClock className="text-amber-600 text-xl mb-3" />
                    <p className="text-3xl font-black text-amber-700"><Counter value={data.pendingRequests} /></p>
                    <p className="text-xs font-semibold text-amber-500 mt-1">Pending</p>
                </div>
                <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5">
                    <FiCheckCircle className="text-blue-600 text-xl mb-3" />
                    <p className="text-3xl font-black text-blue-700"><Counter value={data.approvedRequests} /></p>
                    <p className="text-xs font-semibold text-blue-500 mt-1">Approved</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5">
                    <FiShoppingCart className="text-emerald-600 text-xl mb-3" />
                    <p className="text-3xl font-black text-emerald-700"><Counter value={data.completedHandouts} /></p>
                    <p className="text-xs font-semibold text-emerald-500 mt-1">Fulfilled</p>
                </div>
                <div className="bg-rose-50 rounded-2xl border border-rose-200 p-5">
                    <FiXCircle className="text-rose-600 text-xl mb-3" />
                    <p className="text-3xl font-black text-rose-700"><Counter value={data.rejectedRequests} /></p>
                    <p className="text-xs font-semibold text-rose-500 mt-1">Rejected</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title="Department Fulfillment Rates" subtitle="Completion % by department">
                    <div className="space-y-4">
                        {data.deptData.map((d: any, i: number) => (
                            <div key={i} className="flex items-center gap-4">
                                <span className="text-xs font-semibold text-slate-600 w-28 truncate">{d.name}</span>
                                <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden relative">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${d.rate}%` }} transition={{ duration: 0.8, delay: i * 0.05 }} className="h-full rounded-full" style={{ backgroundColor: d.rate > 70 ? '#10b981' : d.rate > 40 ? '#f59e0b' : '#ef4444' }} />
                                </div>
                                <span className={`text-xs font-black w-10 text-right ${d.rate > 70 ? 'text-emerald-600' : d.rate > 40 ? 'text-amber-600' : 'text-red-600'}`}>{d.rate}%</span>
                            </div>
                        ))}
                    </div>
                </ChartCard>

                <ChartCard title="Monthly Volume" subtitle="Requests & fulfillments over 6 months">
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={data.monthlyComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="monthGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="requests" name="Requests" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#monthGrad)" />
                                <Line type="monotone" dataKey="completed" name="Fulfilled" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════
// TAB: PREDICTIVE / AI FORECAST
// ═══════════════════════════════════════════════

function PredictiveTab({ data }: { data: AnalyticsData }) {
    return (
        <div className="space-y-6">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500" />
                <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
                    <div className="lg:col-span-2 p-6 md:p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center"><FiCrosshair className="text-cyan-400 text-lg" /></div>
                            <div>
                                <h3 className="text-lg font-black text-white">Depletion Forecast Model</h3>
                                <p className="text-xs text-slate-400 mt-0.5">60-day projection factoring academic calendar spikes</p>
                            </div>
                        </div>
                        <div className="h-[320px]">
                            {data.predictiveData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.predictiveData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="pd0" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} /><stop offset="95%" stopColor="#22d3ee" stopOpacity={0} /></linearGradient>
                                            <linearGradient id="pd1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} /><stop offset="95%" stopColor="#f43f5e" stopOpacity={0} /></linearGradient>
                                            <linearGradient id="pd2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} minTickGap={30} dy={8} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                        {data.predictiveLabels['item0'] && <Area type="monotone" dataKey="item0" name={data.predictiveLabels['item0']} stroke="#22d3ee" strokeWidth={3} fill="url(#pd0)" />}
                                        {data.predictiveLabels['item1'] && <Area type="monotone" dataKey="item1" name={data.predictiveLabels['item1']} stroke="#f43f5e" strokeWidth={3} fill="url(#pd1)" />}
                                        {data.predictiveLabels['item2'] && <Area type="monotone" dataKey="item2" name={data.predictiveLabels['item2']} stroke="#f59e0b" strokeWidth={3} fill="url(#pd2)" />}
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-500 font-medium text-sm">Insufficient consumption velocity data for projection</div>
                            )}
                        </div>
                    </div>

                    {/* Alerts */}
                    <div className="p-6 md:p-8 bg-slate-800/50">
                        <h3 className="text-sm font-black text-white mb-5 flex items-center gap-2">
                            <FiAlertTriangle className="text-rose-400" /> Critical Alerts
                        </h3>
                        {data.predictiveAlerts.length > 0 ? (
                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                                {data.predictiveAlerts.sort((a: any, b: any) => a.daysRemaining - b.daysRemaining).map((alert: any, i: number) => (
                                    <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4 relative overflow-hidden">
                                        {alert.daysRemaining < 15 && <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />}
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-slate-200 text-sm truncate max-w-[140px]">{alert.itemName}</span>
                                            <span className={`text-[10px] font-black px-2 py-1 rounded-md ${alert.daysRemaining < 15 ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                {alert.daysRemaining}d
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 space-y-1">
                                            <p>Stock: <b className="text-slate-300">{alert.currentStock}</b> • Velocity: <b className="text-slate-300">{alert.velocity}/day</b></p>
                                            <p>Run out: <b className="text-slate-300">{new Date(alert.runOutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</b></p>
                                            {alert.intersectsEvent && <p className="text-cyan-400 font-semibold mt-1">⚡ Depletes during {alert.intersectsEvent}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3"><FiCheckCircle className="text-2xl text-emerald-400" /></div>
                                <p className="text-sm font-bold text-emerald-400">All Clear</p>
                                <p className="text-xs text-slate-500 mt-1">No critical stockouts in the 60-day forecast window.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════

function ChartCard({ title, subtitle, children, className = '', id, expanded, setExpanded }: {
    title: string; subtitle?: string; children: React.ReactNode; className?: string;
    id?: string; expanded?: string | null; setExpanded?: (v: string | null) => void;
}) {
    const isExpanded = id && expanded === id;
    return (
        <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${isExpanded ? 'col-span-full' : className}`}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                    <h3 className="text-sm font-bold text-slate-800">{title}</h3>
                    {subtitle && <p className="text-[10px] text-slate-500 font-medium mt-0.5">{subtitle}</p>}
                </div>
                {id && setExpanded && (
                    <button onClick={() => setExpanded(isExpanded ? null : id)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors print:hidden">
                        {isExpanded ? <FiMinimize2 className="text-slate-400 text-xs" /> : <FiMaximize2 className="text-slate-400 text-xs" />}
                    </button>
                )}
            </div>
            <div className="p-6">{children}</div>
        </div>
    );
}

function KpiCard({ title, value, prefix = '', suffix = '', icon: Icon, trend, gradient, trendGoodDown = false }: any) {
    const isPos = trend > 0;
    const isGood = trendGoodDown ? !isPos : isPos;
    const TrendIcon = isPos ? FiArrowUpRight : FiArrowDownRight;
    return (
        <motion.div whileHover={{ y: -3 }} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradient} opacity-80`} />
            <div className="flex justify-between items-start mb-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-md`}><Icon className="text-sm" /></div>
                {trend !== 0 && (
                    <div className={`flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${isGood ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        <TrendIcon className="text-[8px]" />{Math.abs(trend)}%
                    </div>
                )}
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{title}</p>
            <p className="text-2xl font-black text-slate-800 tracking-tight">
                {prefix && <span className="text-sm text-slate-400 mr-0.5">{prefix}</span>}
                <Counter value={value} />
                {suffix && <span className="text-sm text-slate-400 ml-0.5">{suffix}</span>}
            </p>
        </motion.div>
    );
}

function StockMetric({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
    const colors: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600 border-blue-200',
        green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        amber: 'bg-amber-50 text-amber-600 border-amber-200',
        red: 'bg-red-50 text-red-600 border-red-200',
        rose: 'bg-rose-50 text-rose-600 border-rose-200',
        orange: 'bg-orange-50 text-orange-600 border-orange-200',
    };
    return (
        <div className={`rounded-2xl border p-4 ${colors[color]}`}>
            <Icon className="text-lg mb-2" />
            <p className="text-2xl font-black"><Counter value={value} /></p>
            <p className="text-[10px] font-bold mt-0.5 opacity-70">{title}</p>
        </div>
    );
}
