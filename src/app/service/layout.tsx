'use client';

import { SidebarProvider } from '@/contexts/SidebarContext';
import GeneralServiceSidebar from '@/components/GeneralServiceSidebar';

import RequestNotificationBanner from '@/components/RequestNotificationBanner';
import IdleTimeoutGuard from '@/components/IdleTimeoutGuard';
import { InventoryProvider } from '@/contexts/InventoryContext';
import Header from '@/components/Header';

export default function ServiceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SidebarProvider>
            <InventoryProvider>
                <IdleTimeoutGuard />
                <div className="min-h-screen bg-white flex">
                    <GeneralServiceSidebar />
                    <div className="flex-1 flex flex-col min-w-0">
                        <div className="sticky top-0 z-40">
                            <Header title="Service Dashboard" />
                        </div>
                        <RequestNotificationBanner />
                        
                        <main className="flex-1 overflow-y-auto">
                            {children}
                        </main>
                    </div>
                </div>
            </InventoryProvider>
        </SidebarProvider>
    );
}

