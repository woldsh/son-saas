'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
    Activity,
    CalendarClock,
    Database,
    FileText,
    Search,
    ShieldCheck,
    User,
} from 'lucide-react';
import { db } from '@/lib/firebase';

type AuditLog = {
    id: string;
    actorId?: string;
    actorName?: string;
    actorEmail?: string | null;
    actorRole?: string | null;
    action?: string;
    targetType?: string;
    targetId?: string | null;
    targetName?: string | null;
    note?: string;
    oldValue?: unknown;
    newValue?: unknown;
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

export default function AuditLogView() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(() => Boolean(db));
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        if (!db) {
            return;
        }

        const logsQuery = query(
            collection(db, 'activity_logs'),
            orderBy('createdAt', 'desc'),
            limit(150)
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

    const filteredLogs = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        return logs.filter((log) => {
            const matchesAction = actionFilter === 'all' || log.action === actionFilter;
            const searchable = [
                log.actorName,
                log.actorEmail,
                log.actorRole,
                log.action,
                log.targetType,
                log.targetId,
                log.targetName,
                log.note,
            ].filter(Boolean).join(' ').toLowerCase();

            return matchesAction && (!normalizedSearch || searchable.includes(normalizedSearch));
        });
    }, [actionFilter, logs, searchTerm]);

    const counts = useMemo(() => ({
        total: logs.length,
        registration: logs.filter((log) => log.action?.includes('registered')).length,
        qrViews: logs.filter((log) => log.action === 'asset_qr_profile_viewed').length,
    }), [logs]);

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="h-10 w-10 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
            </div>
        );
    }

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
                        Track who created, viewed, changed, approved, rejected, issued, returned, or transferred system records.
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Logs</p>
                        <p className="text-xl font-black text-slate-900">{counts.total}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registers</p>
                        <p className="text-xl font-black text-slate-900">{counts.registration}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">QR Views</p>
                        <p className="text-xl font-black text-slate-900">{counts.qrViews}</p>
                    </div>
                </div>
            </div>

            <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-[1fr_260px]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Search actor, role, action, target, or note..."
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
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {filteredLogs.length === 0 ? (
                    <div className="py-16 text-center">
                        <Activity className="mx-auto h-10 w-10 text-slate-300" />
                        <p className="mt-3 text-sm font-bold text-slate-500">No audit logs found.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredLogs.map((log) => {
                            const isExpanded = expandedId === log.id;
                            return (
                                <div key={log.id} className="p-4 transition-colors hover:bg-slate-50/80">
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                        className="w-full text-left"
                                    >
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="flex gap-3">
                                                <div className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                                    <Activity className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h2 className="text-sm font-black text-slate-900">{formatAction(log.action)}</h2>
                                                    <p className="mt-1 text-sm font-medium text-slate-600">
                                                        {log.note || `${log.targetType || 'record'} activity`}
                                                    </p>
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
                                                </div>
                                            </div>
                                            <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
                                                {log.actorRole || 'public'}
                                            </span>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
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
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
