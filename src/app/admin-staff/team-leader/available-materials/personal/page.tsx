'use client';
import AvailableMaterialsList from '@/components/AvailableMaterialsList';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function PersonalAvailableMaterialsPage() {
    return (
        <ProtectedRoute>
            <div className="p-8 font-sans">
                <AvailableMaterialsList mode="personal" />
            </div>
        </ProtectedRoute>
    );
}
