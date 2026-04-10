'use client';

import StoreSidebar from '@/components/StoreSidebar';
import MaterialLookup from '@/components/MaterialLookup';
import { SidebarProvider } from '@/contexts/SidebarContext';

export default function SearchMaterialFixedPage() {
    return (
        <SidebarProvider>
            <div className="min-h-screen bg-slate-50 flex">
                <StoreSidebar storeType="fixed" />

                <div className="flex-1 flex flex-col">
                    

                    <main className="flex-1 overflow-y-auto">
                        <MaterialLookup storeType="fixed_asset" />
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
}
