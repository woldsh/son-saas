'use client';
import { Suspense } from 'react';
import AvailableMaterialsList from '@/components/AvailableMaterialsList';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function PersonalAvailableMaterialsPage() {
    return (
        <ProtectedRoute>
            <div className="p-8 font-sans">
                <Suspense fallback={<div>Loading materials...</div>}>
                    <AvailableMaterialsList mode="personal" />
                </Suspense>
            </div>
        </ProtectedRoute>
    );
}
