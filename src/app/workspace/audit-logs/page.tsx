'use client';

import AuditLogView from '@/components/AuditLogView';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function WorkspaceAuditLogsPage() {
    return (
        <ProtectedRoute
            allowedRoles={[
                'procurement_team_leader',
                'fixed_asset_stock_clerk',
                'consumable_item_stock_clerk',
                'fixed_asset_store_keeper',
                'consumable_item_store_keeper',
                'chief',
                'managing_director_leader',
            ]}
        >
            <AuditLogView />
        </ProtectedRoute>
    );
}
