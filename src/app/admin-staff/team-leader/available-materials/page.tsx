'use client';
import { Suspense } from 'react';
import AvailableMaterialsList from '@/components/AvailableMaterialsList';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function TeamLeaderAvailableMaterialsPage() {
    return (
        <ProtectedRoute>
            <div className="p-8 font-sans">
                <Suspense fallback={<div>Loading materials...</div>}>
                    <AvailableMaterialsList />
                </Suspense>
            </div>
        </ProtectedRoute>
    );
}
