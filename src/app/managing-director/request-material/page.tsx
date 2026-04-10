'use client';

import { useState } from 'react';
import PaperMaterialRequestForm from '@/components/PaperMaterialRequestForm';
import MaterialSearch from '@/components/MaterialSearch';
import { InventoryProvider } from '@/contexts/InventoryContext';
import ManagingDirectorLayout from '@/components/ManagingDirectorLayout';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ManagingDirectorRequestPage() {
    const { t } = useLanguage();
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
        <ManagingDirectorLayout>
            
            <div className="p-6">
                <InventoryProvider>
                    {view === 'search' ? (
                        <div className="max-w-7xl mx-auto pb-8">
                            <MaterialSearch onSelect={handleSelect} onCancel={() => { }} />
                        </div>
                    ) : (
                        <PaperMaterialRequestForm
                            key={selectedItem?.name}
                            initialItem={selectedItem}
                            onBack={handleBack}
                        />
                    )}
                </InventoryProvider>
            </div>
        </ManagingDirectorLayout>
    );
}
