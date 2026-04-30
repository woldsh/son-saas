'use client';

import { SidebarProvider } from '@/contexts/SidebarContext';
import AdminSidebar from '@/components/AdminSidebar';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import IdleTimeoutGuard from '@/components/IdleTimeoutGuard';
import { Loader2 } from 'lucide-react';
import { InventoryProvider } from '@/contexts/InventoryContext';
import Header from '@/components/Header';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading } = useAuth();
    const { t } = useLanguage();

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FDFDFE] flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
                    <p className="text-slate-400 text-sm font-bold tracking-widest uppercase">
                        {t('accessing_admin_panel')}
                    </p>
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <SidebarProvider>
            <InventoryProvider>
                <IdleTimeoutGuard />
                <div className="min-h-screen bg-[#F8F9FA] flex relative">
                    <div className="relative z-10 flex w-full">
                        <AdminSidebar />
                        <div className="flex-1 flex flex-col min-w-0">
                            <div className="sticky top-0 z-40">
                                <Header title="Dashboard" />
                            </div>

                            <main className="flex-1 overflow-y-auto relative z-0">
                                {children}
                            </main>
                        </div>
                    </div>
                </div>
            </InventoryProvider>
        </SidebarProvider>
    );
}
