'use client';


import ManagingDirectorLayout from '@/components/ManagingDirectorLayout';
import MaterialRequestView from '@/components/MaterialRequestView';

export default function ManagingDirectorRequestsPage() {
    return (
        <ManagingDirectorLayout>
            
            <div className="min-h-full">
                <MaterialRequestView />
            </div>
        </ManagingDirectorLayout>
    );
}
