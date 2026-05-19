'use client';

import UserManagement from '@/components/UserManagement';

export default function ManageDirectoryPage() {
    return (
        <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-1.5">
            <div className="flex items-baseline gap-2">
                <h1 className="text-sm font-bold text-gray-900">Manage Employees</h1>
                <span className="text-[11px] text-gray-400">— Audit and manage personnel records, roles, and status.</span>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-2 md:p-3">
                    <UserManagement />
                </div>
            </div>
        </div>
    );
}
