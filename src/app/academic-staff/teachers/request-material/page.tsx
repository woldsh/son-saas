'use client';

import { useState } from 'react';
import TeacherSidebar from '@/components/TeacherSidebar';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { InventoryProvider } from '@/contexts/InventoryContext';
import PaperMaterialRequestForm from '@/components/PaperMaterialRequestForm';
import MaterialSearch from '@/components/MaterialSearch';

export default function RequestMaterialPage() {
    const [view, setView] = useState<'search' | 'form'>('search');
    const [selectedItem, setSelectedItem] = useState<{ name: string; model?: string } | undefined>(undefined);

    const handleSelect = (name: string, model?: string) => {
        setSelectedItem({ name, model });
        setView('form');
    };

    const handleBack = () => {
        setView('search');
        setSelectedItem(undefined);
    };

    return (
        <SidebarProvider>
            <div className="min-h-screen bg-slate-50 flex font-sans">
                {/* Sidebar */}
                <TeacherSidebar />

                {/* Main Content */}
                <div className="flex-1 flex flex-col h-screen overflow-hidden">
                    

                    <main className="flex-1 overflow-y-auto custom-scrollbar">
                        <InventoryProvider>
                            {view === 'search' ? (
                                <div className="h-full p-6 bg-slate-50">
                                    <div className="max-w-7xl mx-auto pb-8">
                                        <MaterialSearch onSelect={handleSelect} onCancel={() => { }} />
                                    </div>
                                </div>
                            ) : (
                                <PaperMaterialRequestForm
                                    key={selectedItem?.name}
                                    initialItem={selectedItem}
                                    onBack={handleBack}
                                />
                            )}
                        </InventoryProvider>
                    </main>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            `}</style>
        </SidebarProvider>
    );
}
