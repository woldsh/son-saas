'use client';

import TransferInitiator from '@/components/TransferInitiator';

export default function MaterialTransferPage() {
    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">Material Transfer</h1>
                <p className="text-slate-600 mt-1">Initiate a transfer of your assigned assets to another user.</p>
            </div>
            <TransferInitiator />
        </div>
    );
}
