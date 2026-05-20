'use client';

import EmployeeReportView from '@/components/EmployeeReportView';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function EmployeeReportPage() {
    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-slate-50/50 p-4 md:p-6">
                <EmployeeReportView />
            </div>
        </ProtectedRoute>
    );
}
