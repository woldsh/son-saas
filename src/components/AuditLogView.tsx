'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import {
    Activity,
    AlertTriangle,
    CalendarClock,
    CheckCircle,
    Database,
    FileText,
    Globe,
    Monitor,
    Search,
    Server,
    ShieldAlert,
    ShieldCheck,
    User,
    XCircle,
} from 'lucide-react';
import { db } from '@/lib/firebase';

type AuditLog = {
    id: string;
    // Actor Information
    actorId?: string;
    actorName?: string;
    actorEmail?: string | null;
    actorRole?: string | null;
    actorDepartment?: string | null;
    
    // Action Details
    action?: string;
    actionCategory?: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'system' | 'security';
    
    // Target Information
    targetType?: string;
    targetId?: string | null;
    targetName?: string | null;
    
    // Result & Status
    status?: 'success' | 'failure' | 'denied' | 'warning';
    errorMessage?: string | null;
    errorCode?: string | null;
    
    // Source Information
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    browser?: string | null;
    location?: {
        city?: string;
        country?: string;
        region?: string;
    } | null;
    
    // Session & Transaction
    sessionId?: string | null;
    transactionId?: string | null;
    requestId?: string | null;
    
    // System Details
    module?: string | null;
    apiEndpoint?: string | null;
    serviceName?: string | null;
    appVersion?: string | null;
    
    // Change Tracking
    note?: string;
    oldValue?: unknown;
    newValue?: unknown;
    changedFields?: string[];
    changeReason?: string | null;
    
    // Business Context
    workflowId?: string | null;
    approvalChainPosition?: number | null;
    department?: string | null;
    impactLevel?: 'low' | 'medium' | 'high' | 'critical';
    
    // Performance
    duration?: number | null; // in milliseconds
    
    // Compliance
    dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
    complianceTags?: string[];
    retentionPeriod?: number | null; // in days
    
    // Metadata
    metadata?: Record<string, unknown>;
    createdAt?: {
        toDate?: () => Date;
        seconds?: number;
    } | string | null;
};

function formatAction(action?: string) {
    if (!action) return 'Activity';
    return action
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function formatDate(value: AuditLog['createdAt']) {
    if (!value) return 'Pending timestamp';
    const date = typeof value === 'string'
        ? new Date(value)
        : value.toDate?.() || (value.seconds ? new Date(value.seconds * 1000) : null);

    if (!date || Number.isNaN(date.getTime())) return 'Pending timestamp';
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function safeJson(value: unknown) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function getStatusIcon(status?: string) {
    switch (status) {
        case 'success':
            return <CheckCircle className="h-4 w-4 text-green-600" />;
        case 'failure':
            return <XCircle className="h-4 w-4 text-red-600" />;
        case 'denied':
            return <ShieldAlert className="h-4 w-4 text-orange-600" />;
        case 'warning':
            return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
        default:
            return <Activity className="h-4 w-4 text-slate-600" />;
    }
}

function getStatusColor(status?: string) {
    switch (status) {
        case 'success':
            return 'bg-green-50 text-green-700 border-green-200';
        case 'failure':
            return 'bg-red-50 text-red-700 border-red-200';
        case 'denied':
            return 'bg-orange-50 text-orange-700 border-orange-200';
        case 'warning':
            return 'bg-yellow-50 text-yellow-700 border-yellow-200';
        default:
            return 'bg-slate-50 text-slate-700 border-slate-200';
    }
}

function getImpactColor(impact?: string) {
    switch (impact) {
        case 'critical':
            return 'bg-red-100 text-red-800';
        case 'high':
            return 'bg-orange-100 text-orange-800';
        case 'medium':
            return 'bg-yellow-100 text-yellow-800';
        case 'low':
            return 'bg-blue-100 text-blue-800';
        default:
            return 'bg-slate-100 text-slate-800';
    }
}

export default function AuditLogView() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(() => Boolean(db));
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateRange, setDateRange] = useState('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const logsPerPage = 20;

    useEffect(() => {
        if (!db) {
            return;
        }

        const logsQuery = query(
            collection(db, 'activity_logs'),
            orderBy('createdAt', 'desc'),
            limit(500)
        );

        const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
            setLogs(snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
            } as AuditLog)));
            setLoading(false);
        }, (error) => {
            console.error('Failed to load audit logs:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const actions = useMemo(() => {
        const unique = new Set(logs.map((log) => log.action).filter(Boolean) as string[]);
        return Array.from(unique).sort();
    }, [logs]);

    const statuses = useMemo(() => {
        const unique = new Set(logs.map((log) => log.status).filter(Boolean) as string[]);
        return Array.from(unique).sort();
    }, [logs]);

    const filteredLogs = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        
        // Date filtering
        const now = new Date();
        let dateFilteredLogs = logs;
        
        if (dateRange !== 'all') {
            dateFilteredLogs = logs.filter((log) => {
                const logDate = log.createdAt 
                    ? (typeof log.createdAt === 'string' 
                        ? new Date(log.createdAt) 
                        : log.createdAt.toDate?.() || (log.createdAt.seconds ? new Date(log.createdAt.seconds * 1000) : null))
                    : null;
                
                if (!logDate) return false;
                
                const diffTime = now.getTime() - logDate.getTime();
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                
                switch (dateRange) {
                    case 'today':
                        return diffDays < 1;
                    case 'week':
                        return diffDays < 7;
                    case 'month':
                        return diffDays < 30;
                    case '3months':
                        return diffDays < 90;
                    default:
                        return true;
                }
            });
        }
        
        return dateFilteredLogs.filter((log) => {
            const matchesAction = actionFilter === 'all' || log.action === actionFilter;
            const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
            
            const searchable = [
                log.actorName,
                log.actorEmail,
                log.actorRole,
                log.actorDepartment,
                log.action,
                log.targetType,
                log.targetId,
                log.targetName,
                log.note,
                log.ipAddress,
                log.sessionId,
                log.module,
                log.errorMessage,
            ].filter(Boolean).join(' ').toLowerCase();

            return matchesAction && matchesStatus && (!normalizedSearch || searchable.includes(normalizedSearch));
        });
    }, [actionFilter, statusFilter, dateRange, logs, searchTerm]);

    // Pagination
    const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
    const paginatedLogs = useMemo(() => {
        const startIndex = (currentPage - 1) * logsPerPage;
        return filteredLogs.slice(startIndex, startIndex + logsPerPage);
    }, [filteredLogs, currentPage]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, actionFilter, statusFilter, dateRange]);

    const counts = useMemo(() => ({
        total: logs.length,
        success: logs.filter((log) => log.status === 'success').length,
        failure: logs.filter((log) => log.status === 'failure').length,
        denied: logs.filter((log) => log.status === 'denied').length,
        authentication: logs.filter((log) => log.actionCategory === 'authentication').length,
        security: logs.filter((log) => log.actionCategory === 'security' || log.status === 'denied').length,
    }), [logs]);

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="h-10 w-10 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
            </div>
        );
    }

    const handleExportCSV = () => {
        const headers = [
            'Timestamp',
            'Actor',
            'Role',
            'Action',
            'Target',
            'Status',
            'IP Address',
            'Device',
            'Session ID',
            'Module',
            'Error Message',
        ];
        
        const rows = filteredLogs.map((log) => [
            formatDate(log.createdAt),
            log.actorName || 'Unknown',
            log.actorRole || 'N/A',
            formatAction(log.action),
            `${log.targetType || 'N/A'}: ${log.targetName || log.targetId || 'N/A'}`,
            log.status || 'N/A',
            log.ipAddress || 'N/A',
            log.deviceType || 'N/A',
            log.sessionId || 'N/A',
            log.module || 'N/A',
            log.errorMessage || 'N/A',
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-full bg-slate-50 px-5 py-6 lg:px-10">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-blue-600">Governance Audit</p>
                            <h1 className="text-2xl font-black tracking-tight text-slate-950">Audit Log</h1>
                        </div>
                    </div>
                    <p className="mt-3 max-w-2xl text-sm font-medium text-slate-500">
                        Comprehensive chronological record of all system actions, events, and security incidents.
                    </p>
                </div>

                <button
                    onClick={handleExportCSV}
                    className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                >
                    Export to CSV
                </button>
            </div>

            {/* Statistics Cards */}
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Logs</p>
                    <p className="text-xl font-black text-slate-900">{counts.total}</p>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-green-600">Success</p>
                    <p className="text-xl font-black text-green-900">{counts.success}</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-600">Failures</p>
                    <p className="text-xl font-black text-red-900">{counts.failure}</p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-600">Denied</p>
                    <p className="text-xl font-black text-orange-900">{counts.denied}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Auth Events</p>
                    <p className="text-xl font-black text-blue-900">{counts.authentication}</p>
                </div>
                <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-600">Security</p>
                    <p className="text-xl font-black text-purple-900">{counts.security}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Search actor, action, target, IP, session..."
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                        />
                    </div>
                    <select
                        value={actionFilter}
                        onChange={(event) => setActionFilter(event.target.value)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    >
                        <option value="all">All actions</option>
                        {actions.map((action) => (
                            <option key={action} value={action}>{formatAction(action)}</option>
                        ))}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    >
                        <option value="all">All statuses</option>
                        <option value="success">Success</option>
                        <option value="failure">Failure</option>
                        <option value="denied">Denied</option>
                        <option value="warning">Warning</option>
                    </select>
                    <select
                        value={dateRange}
                        onChange={(event) => setDateRange(event.target.value)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    >
                        <option value="all">All time</option>
                        <option value="today">Today</option>
                        <option value="week">Last 7 days</option>
                        <option value="month">Last 30 days</option>
                        <option value="3months">Last 90 days</option>
                    </select>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Showing {paginatedLogs.length} of {filteredLogs.length} logs</span>
                    {(searchTerm || actionFilter !== 'all' || statusFilter !== 'all' || dateRange !== 'all') && (
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setActionFilter('all');
                                setStatusFilter('all');
                                setDateRange('all');
                            }}
                            className="text-blue-600 hover:text-blue-700"
                        >
                            Clear filters
                        </button>
                    )}
                </div>
            </div>

            {/* Logs Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {paginatedLogs.length === 0 ? (
                    <div className="py-16 text-center">
                        <Activity className="mx-auto h-10 w-10 text-slate-300" />
                        <p className="mt-3 text-sm font-bold text-slate-500">No audit logs found.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {paginatedLogs.map((log) => {
                            const isExpanded = expandedId === log.id;
                            return (
                                <div key={log.id} className="p-4 transition-colors hover:bg-slate-50/80">
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                        className="w-full text-left"
                                    >
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="flex gap-3">
                                                <div className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100">
                                                    {getStatusIcon(log.status)}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h2 className="text-sm font-black text-slate-900">{formatAction(log.action)}</h2>
                                                        {log.status && (
                                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${getStatusColor(log.status)}`}>
                                                                {log.status}
                                                            </span>
                                                        )}
                                                        {log.impactLevel && (
                                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${getImpactColor(log.impactLevel)}`}>
                                                                {log.impactLevel}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-1 text-sm font-medium text-slate-600">
                                                        {log.note || `${log.targetType || 'record'} activity`}
                                                    </p>
                                                    {log.errorMessage && (
                                                        <p className="mt-1 text-xs font-bold text-red-600">
                                                            Error: {log.errorMessage}
                                                        </p>
                                                    )}
                                                    
                                                    {/* Primary Info Tags */}
                                                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                                                            <User className="h-3 w-3" /> {log.actorName || 'Unknown actor'}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                                                            <Database className="h-3 w-3" /> {log.targetType || 'record'}: {log.targetName || log.targetId || 'unknown'}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                                                            <CalendarClock className="h-3 w-3" /> {formatDate(log.createdAt)}
                                                        </span>
                                                    </div>

                                                    {/* Secondary Info Tags */}
                                                    {(log.ipAddress || log.deviceType || log.module || log.sessionId) && (
                                                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                                                            {log.ipAddress && (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                                                                    <Globe className="h-3 w-3" /> {log.ipAddress}
                                                                </span>
                                                            )}
                                                            {log.deviceType && (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-1 text-purple-700">
                                                                    <Monitor className="h-3 w-3" /> {log.deviceType}
                                                                </span>
                                                            )}
                                                            {log.module && (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-green-700">
                                                                    <Server className="h-3 w-3" /> {log.module}
                                                                </span>
                                                            )}
                                                            {log.sessionId && (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-orange-700">
                                                                    Session: {log.sessionId.substring(0, 8)}...
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
                                                {log.actorRole || 'public'}
                                            </span>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="mt-4 space-y-3">
                                            {/* Detailed Information Grid */}
                                            <div className="grid gap-3 lg:grid-cols-3">
                                                {/* Actor Details */}
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                    <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                                                        <User className="h-3.5 w-3.5" /> Actor Details
                                                    </p>
                                                    <div className="space-y-1 text-xs font-medium text-slate-700">
                                                        <p><strong>Name:</strong> {log.actorName || 'N/A'}</p>
                                                        <p><strong>Email:</strong> {log.actorEmail || 'N/A'}</p>
                                                        <p><strong>Role:</strong> {log.actorRole || 'N/A'}</p>
                                                        <p><strong>Department:</strong> {log.actorDepartment || 'N/A'}</p>
                                                        <p><strong>Actor ID:</strong> {log.actorId || 'N/A'}</p>
                                                    </div>
                                                </div>

                                                {/* Source Information */}
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                    <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                                                        <Globe className="h-3.5 w-3.5" /> Source Information
                                                    </p>
                                                    <div className="space-y-1 text-xs font-medium text-slate-700">
                                                        <p><strong>IP Address:</strong> {log.ipAddress || 'N/A'}</p>
                                                        <p><strong>Device:</strong> {log.deviceType || 'N/A'}</p>
                                                        <p><strong>Browser:</strong> {log.browser || 'N/A'}</p>
                                                        <p><strong>Location:</strong> {log.location ? `${log.location.city || ''}, ${log.location.country || ''}` : 'N/A'}</p>
                                                        <p><strong>User Agent:</strong> {log.userAgent ? log.userAgent.substring(0, 30) + '...' : 'N/A'}</p>
                                                    </div>
                                                </div>

                                                {/* System Details */}
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                    <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                                                        <Server className="h-3.5 w-3.5" /> System Details
                                                    </p>
                                                    <div className="space-y-1 text-xs font-medium text-slate-700">
                                                        <p><strong>Module:</strong> {log.module || 'N/A'}</p>
                                                        <p><strong>API Endpoint:</strong> {log.apiEndpoint || 'N/A'}</p>
                                                        <p><strong>Service:</strong> {log.serviceName || 'N/A'}</p>
                                                        <p><strong>Version:</strong> {log.appVersion || 'N/A'}</p>
                                                        <p><strong>Duration:</strong> {log.duration ? `${log.duration}ms` : 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Session & Transaction */}
                                            {(log.sessionId || log.transactionId || log.requestId) && (
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                    <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                                                        <Activity className="h-3.5 w-3.5" /> Session & Transaction
                                                    </p>
                                                    <div className="grid gap-2 text-xs font-medium text-slate-700 lg:grid-cols-3">
                                                        <p><strong>Session ID:</strong> {log.sessionId || 'N/A'}</p>
                                                        <p><strong>Transaction ID:</strong> {log.transactionId || 'N/A'}</p>
                                                        <p><strong>Request ID:</strong> {log.requestId || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Business Context */}
                                            {(log.workflowId || log.department || log.dataClassification) && (
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                    <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                                                        <Database className="h-3.5 w-3.5" /> Business Context
                                                    </p>
                                                    <div className="grid gap-2 text-xs font-medium text-slate-700 lg:grid-cols-3">
                                                        {log.workflowId && <p><strong>Workflow ID:</strong> {log.workflowId}</p>}
                                                        {log.department && <p><strong>Department:</strong> {log.department}</p>}
                                                        {log.dataClassification && <p><strong>Data Classification:</strong> {log.dataClassification}</p>}
                                                        {log.approvalChainPosition && <p><strong>Approval Position:</strong> {log.approvalChainPosition}</p>}
                                                        {log.changeReason && <p><strong>Change Reason:</strong> {log.changeReason}</p>}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Compliance Tags */}
                                            {log.complianceTags && log.complianceTags.length > 0 && (
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                    <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                                                        <ShieldCheck className="h-3.5 w-3.5" /> Compliance
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {log.complianceTags.map((tag, idx) => (
                                                            <span key={idx} className="rounded-full bg-purple-100 px-2 py-1 text-xs font-bold text-purple-800">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Changed Fields */}
                                            {log.changedFields && log.changedFields.length > 0 && (
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                    <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                                                        <FileText className="h-3.5 w-3.5" /> Changed Fields
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {log.changedFields.map((field, idx) => (
                                                            <span key={idx} className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-bold text-yellow-800">
                                                                {field}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Old and New Values */}
                                            <div className="grid gap-3 lg:grid-cols-2">
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                    <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                                                        <FileText className="h-3.5 w-3.5" /> New Value
                                                    </p>
                                                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs font-medium text-slate-700">
                                                        {safeJson(log.newValue) || 'No value recorded'}
                                                    </pre>
                                                </div>
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                    <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                                                        <FileText className="h-3.5 w-3.5" /> Previous Value
                                                    </p>
                                                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs font-medium text-slate-700">
                                                        {safeJson(log.oldValue) || 'No previous value recorded'}
                                                    </pre>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="text-sm font-medium text-slate-600">
                        Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            First
                        </button>
                        <button
                            onClick={() => setCurrentPage(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setCurrentPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Next
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Last
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
