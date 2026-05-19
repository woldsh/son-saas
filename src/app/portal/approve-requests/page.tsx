'use client';

import MaterialRequestView from '@/components/MaterialRequestView';
import TransferApprovalsView from '@/components/TransferApprovalsView';

export default function PortalViewRequestsMDPage() {
    return (
        <div className="pb-12">
            <div className="px-6 pt-4">
                <TransferApprovalsView />
            </div>
            <MaterialRequestView roleOverride="managing_director" />
        </div>
    );
}
