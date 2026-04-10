'use client';

import React from 'react';
import StockClerkSidebar from '@/components/StockClerkSidebar';
import { SidebarProvider } from '@/contexts/SidebarContext';
import ClerkRegisterForm from '@/components/ClerkRegisterForm';

export default function ClerkRegisterConsumableMaterialPage() {
    return (
        <SidebarProvider>
            <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">
                <StockClerkSidebar stockType="consumable" />

                <div className="flex-1 flex flex-col h-screen overflow-hidden">
                    

                    <main className="flex-1 overflow-y-auto p-4 md:p-8">
                        <ClerkRegisterForm type="consumable" />
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
}
