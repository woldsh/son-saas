'use client';


import ManagingDirectorLayout from '@/components/ManagingDirectorLayout';
import MaterialRequestView from '@/components/MaterialRequestView';
import TransferApprovalsView from '@/components/TransferApprovalsView';

export default function ManagingDirectorRequestsPage() {
    return (
        <ManagingDirectorLayout>
            <div className="min-h-full">
                <div className="px-6 pt-4">
                    <TransferApprovalsView />
                </div>
                <MaterialRequestView />
            </div>
        </ManagingDirectorLayout>
    );
}
