'use client';

import UserManagement from '@/components/UserManagement';

export default function ManageDirectoryPage() {
    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Manage Employees</h1>
                <p className="text-gray-500 mt-1">Audit and manage institutional personnel records, roles, and status.</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
                <div className="p-6 min-h-[600px]">
                    <UserManagement />
                </div>
            </div>
        </div>
    );
}
