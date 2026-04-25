'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';

export interface Material {
    id: string;
    materialName: string;
    materialCode: string;
    image: string;
    quantity: number;
    condition: string;
    category: string;
    unit: string;
    materialType: string;
    description?: string;
    remarks?: string;
    storeLocation?: string;
    tags?: string;
    shelfNumber?: string;
}

interface InventoryContextType {
    materials: Material[];
    loading: boolean;
    error: string | null;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: { children: ReactNode }) {
    const [materials, setMaterials] = useState<Material[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!db) {
            setLoading(false);
            return;
        }

        const q = query(collection(db, 'materials'));

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const materialList: Material[] = [];

                snapshot.docs.forEach(docSnap => {
                    const data = docSnap.data();

                    if (data.materialName) {
                        // Standard material document with top-level materialName
                        materialList.push({
                            id: docSnap.id,
                            ...data
                        } as Material);
                    } else if (data.items && Array.isArray(data.items)) {
                        // Model 19 structure: items[] with description & quantity
                        data.items.forEach((item: any, idx: number) => {
                            if (item.description && item.description.trim()) {
                                materialList.push({
                                    id: `${docSnap.id}_item_${idx}`,
                                    materialName: item.description.trim(),
                                    materialCode: item.model || '',
                                    image: item.imageUrl || '',
                                    quantity: Number(item.quantity) || 0,
                                    condition: 'New',
                                    category: data.classificationOfStock || '',
                                    unit: 'pcs',
                                    materialType: data.materialType || 'consumable',
                                    description: item.description.trim(),
                                } as Material);
                            }
                        });
                    }
                });

                // Sort by materialName client-side
                materialList.sort((a, b) => (a.materialName || '').localeCompare(b.materialName || ''));

                setMaterials(materialList);
                setLoading(false);
            },
            (err) => {
                console.error("Error fetching inventory:", err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    return (
        <InventoryContext.Provider value={{ materials, loading, error }}>
            {children}
        </InventoryContext.Provider>
    );
}

export function useInventory() {
    const context = useContext(InventoryContext);
    if (context === undefined) {
        throw new Error('useInventory must be used within an InventoryProvider');
    }
    return context;
}
