'use client';

import AuditLogView from '@/components/AuditLogView';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function AdminAuditLogsPage() {
    return (
        <ProtectedRoute>
            <AuditLogView />
        </ProtectedRoute>
    );
}
